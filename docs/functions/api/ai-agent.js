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

  // 2. System 提示词
  const SYSTEM_PROMPT = {
    role: "system",
    content: "你是一个 AI 智能助手 GLM，可以调用工具。当用户需要访问网页、发起 HTTP 请求或执行外部操作时，主动使用工具完成任务。"
  };

  // 3. 定义工具（这就是你之前缺的部分）
  const tools = [
    {
      type: "function",
      function: {
        name: "http_request",
        description: "向指定 URL 发起 HTTP 请求，返回状态码和响应内容",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "目标 URL" },
            method: {
              type: "string",
              enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
              description: "HTTP 方法，默认 GET"
            },
            headers: {
              type: "object",
              description: "请求头",
              additionalProperties: { type: "string" }
            },
            body: { type: "string", description: "请求体，POST/PUT 时使用" }
          },
          required: ["url"]
        }
      }
    }
  ];

  const messages = [SYSTEM_PROMPT, ...(Array.isArray(body.messages) ? body.messages : [])];

  // 4. 第一轮：把 tools 传给模型，看它是否要调用
  try {
    const firstResult = await context.env.ai_agent.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages,
        tools,              // ← 关键：必须传
        tool_choice: "auto" // ← 让模型自己决定
      }
    );

    const msg = firstResult.choices?.[0]?.message;

    // 5. 如果模型要调工具
    if (msg?.tool_calls?.length) {
      const call = msg.tool_calls[0];
      let args;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = {};
      }

      const method = (args.method || "GET").toUpperCase();
      const url = args.url;
      const headers = args.headers || {};
      const reqBody = args.body;

      // 执行真实请求
      let resultText;
      try {
        const init = { method, headers };
        if (reqBody && !["GET", "HEAD"].includes(method)) {
          init.body = reqBody;
        }
        const r = await fetch(url, init);
        const text = await r.text();
        resultText = JSON.stringify({
          status: r.status,
          contentType: r.headers.get("content-type"),
          body: text.slice(0, 8000)
        });
      } catch (e) {
        resultText = JSON.stringify({ error: e.message });
      }

      // 6. 把工具结果塞回对话，再让模型总结（流式）
      const secondMessages = [
        ...messages,
        msg,
        { role: "tool", tool_call_id: call.id, content: resultText }
      ];

      const finalResult = await context.env.ai_agent.run(
        "@cf/zai-org/glm-4.7-flash",
        { messages: secondMessages, stream: true }
      );

      return new Response(finalResult, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
      });
    }

    // 7. 没调工具，直接流式返回
    const finalResult = await context.env.ai_agent.run(
      "@cf/zai-org/glm-4.7-flash",
      { messages, stream: true }
    );

    return new Response(finalResult, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (e) {
    console.error("AI 调用失败:", e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
