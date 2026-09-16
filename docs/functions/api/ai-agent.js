export async function onRequest(context) {
  // 1. Bearer 校验
  const auth = context.request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = auth.slice(7).trim();
  if (token !== context.env.API_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const SYSTEM_PROMPT = {
    role: "system",
    content: "你是一个 AI 智能助手 GLM，可以调用工具。当用户需要访问网页或执行外部操作时，主动使用工具完成任务。可以连续调用多个工具来完成复杂任务。"
  };

  // 2. 定义多个工具
  const tools = [
    {
      type: "function",
      function: {
        name: "http_request",
        description: "向指定 URL 发起 HTTP 请求",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "目标 URL" },
            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "HTTP 方法，默认 GET" },
            headers: { type: "object", additionalProperties: { type: "string" } },
            body: { type: "string", description: "请求体" }
          },
          required: ["url"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_current_time",
        description: "获取当前系统时间",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    }
  ];

  const messages = [SYSTEM_PROMPT, ...(Array.isArray(body.messages) ? body.messages : [])];

  // 3. 多轮工具调用循环
  const MAX_ROUNDS = 5;  // 防止无限循环
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;

    // 每一轮都让模型决定是否调用工具
    const result = await context.env.ai_agent.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages,
        tools,
        tool_choice: "auto"
      }
    );

    const msg = result.choices?.[0]?.message;
    messages.push(msg);

    // 如果模型不再调用工具，跳出循环
    if (!msg?.tool_calls?.length) {
      break;
    }

    // 4. 执行本轮所有工具调用
    for (const call of msg.tool_calls) {
      let args;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = {};
      }

      let toolResult;
      try {
        if (call.function.name === "http_request") {
          const method = (args.method || "GET").toUpperCase();
          const init = { method, headers: args.headers || {} };
          if (args.body && !["GET", "HEAD"].includes(method)) {
            init.body = args.body;
          }
          const r = await fetch(args.url, init);
          const text = await r.text();
          toolResult = JSON.stringify({
            status: r.status,
            contentType: r.headers.get("content-type"),
            body: text.slice(0, 8000)
          });
        } else if (call.function.name === "get_current_time") {
          toolResult = JSON.stringify({
            time: new Date().toISOString(),
            timestamp: Date.now()
          });
        } else {
          toolResult = JSON.stringify({ error: `未知工具: ${call.function.name}` });
        }
      } catch (e) {
        toolResult = JSON.stringify({ error: e.message });
      }

      // 把工具结果塞回对话
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: toolResult
      });
    }
    // 循环继续，让模型基于工具结果决定下一步
  }

  // 5. 最后一轮用流式返回最终回答
  const finalResult = await context.env.ai_agent.run(
    "@cf/zai-org/glm-4.7-flash",
    {
      messages,
      stream: true
    }
  );

  return new Response(finalResult, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
}
