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
    content: `你是一个 AI 智能助手 GLM，可以调用工具。当用户需要访问网页或执行外部操作时，主动使用工具完成任务。可以连续调用多个工具来完成复杂任务。
重要规则：如果用户给出的 Python 代码中出现了 import layout，你必须先调用 get_doc 工具查询 layout 文档，再基于文档内容回答。`
  };

  // 2. 工具定义
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
        description: "获取当前本地时间，返回时区信息（UTC 偏移）",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_doc",
        description: "查询 layout 模块的文档。当 Python 代码中出现 import layout 时调用，无需任何参数。",
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
  const MAX_ROUNDS = 5;
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;

    const result = await context.env.ai_agent.run(
      "@cf/zai-org/glm-4.7-flash",
      { messages, tools, tool_choice: "auto" }
    );

    const msg = result.choices?.[0]?.message;
    messages.push(msg);

    if (!msg?.tool_calls?.length) break;

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
          if (args.body && !["GET", "HEAD"].includes(method)) init.body = args.body;
          const r = await fetch(args.url, init);
          const text = await r.text();
          toolResult = JSON.stringify({
            status: r.status,
            contentType: r.headers.get("content-type"),
            body: text.slice(0, 8000)
          });
        } else if (call.function.name === "get_current_time") {
          // 本地时区：用 Intl 拿到偏移和本地时间
          const now = new Date();
          const offsetMin = -now.getTimezoneOffset();           // 分钟，东八区为 480
          const sign = offsetMin >= 0 ? "+" : "-";
          const abs = Math.abs(offsetMin);
          const hh = String(Math.floor(abs / 60)).padStart(2, "0");
          const mm = String(abs % 60).padStart(2, "0");
          const utcOffset = `UTC${sign}${hh}:${mm}`;

          // 本地时间字符串
          const local = now.toLocaleString("zh-CN", {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            hour12: false
          });

          toolResult = JSON.stringify({
            localTime: local,
            utcOffset,
            iso: now.toISOString(),
            timestamp: now.getTime()
          });
        } else if (call.function.name === "get_doc") {
          // 固定查询 /res/layout.md，不接受任何参数
          const docUrl = new URL("/res/layout.md", context.request.url).toString();
          const r = await fetch(docUrl);
          if (!r.ok) {
            toolResult = JSON.stringify({ error: `文档获取失败: ${r.status}` });
          } else {
            const text = await r.text();
            toolResult = JSON.stringify({
              url: docUrl,
              content: text.slice(0, 12000)
            });
          }
        } else {
          toolResult = JSON.stringify({ error: `未知工具: ${call.function.name}` });
        }
      } catch (e) {
        toolResult = JSON.stringify({ error: e.message });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: toolResult
      });
    }
  }

  // 5. 最后一轮流式返回
  const finalResult = await context.env.ai_agent.run(
    "@cf/zai-org/glm-4.7-flash",
    { messages, stream: true }
  );

  return new Response(finalResult, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
  });
}
