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

  const body = await context.request.json();

  // 2. 定义通用 HTTP 请求工具
  const tools = [
    {
      type: "function",
      function: {
        name: "http_request",
        description: "向指定 URL 发起 HTTP 请求，支持自定义 method、headers 和 body，返回响应状态码、content-type 和响应内容。",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "完整的目标 URL，例如 https://api.example.com/data"
            },
            method: {
              type: "string",
              enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"],
              description: "HTTP 请求方法，默认 GET"
            },
            headers: {
              type: "object",
              description: "可选的请求头键值对，例如 {\"Content-Type\":\"application/json\"}",
              additionalProperties: { type: "string" }
            },
            body: {
              type: "string",
              description: "可选的请求体，POST/PUT/PATCH 时使用"
            }
          },
          required: ["url"]
        }
      }
    }
  ];

  // 3. 第一轮：让模型决定是否调用工具
  let aiResult = await context.env.ai_agent.run(
    "@cf/qwen/qwen2.5-coder-32b-instruct",
    {
      messages: body.messages,
      tools,
      tool_choice: "auto"
    }
  );

  const msg = aiResult.choices?.[0]?.message;

  // 4. 如果模型要调工具
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

    // 5. 发起真实请求
    let resultText = "";
    try {
      const init = { method, headers };
      if (reqBody && !["GET", "HEAD"].includes(method)) {
        init.body = reqBody;
      }

      const r = await fetch(url, init);
      const contentType = r.headers.get("content-type") || "unknown";
      const text = await r.text();

      resultText = JSON.stringify({
        status: r.status,
        statusText: r.statusText,
        contentType,
        body: text.slice(0, 8192) // 截断，防止超 token
      });
    } catch (e) {
      resultText = JSON.stringify({
        error: e.message
      });
    }

    // 6. 把结果塞回对话，让模型总结
    const secondMessages = [
      ...body.messages,
      msg,
      {
        role: "tool",
        tool_call_id: call.id,
        content: resultText
      }
    ];

    aiResult = await context.env.ai_agent.run(
      "@cf/qwen/qwen2.5-coder-32b-instruct",
      { messages: secondMessages, stream: true }
    );

    return new Response(aiResult, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache"
      }
    });
  }

  // 7. 没调用工具，直接返回普通对话
  const finalResult = await context.env.ai_agent.run(
    "@cf/qwen/qwen2.5-coder-32b-instruct",
    { messages: body.messages, stream: true }
  );

  return new Response(finalResult, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
}
