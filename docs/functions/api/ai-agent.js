import { runWithTools } from "@cloudflare/ai-utils";

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

  // 2. 用 runWithTools 做嵌入式工具调用
  try {
    const response = await runWithTools(
      context.env.ai_agent,  // 你的 AI binding
      "@cf/zai-org/glm-4.7-flash",
      {
        messages: body.messages,
        tools: [
          {
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
            },
            // 关键：直接内联执行函数，框架自动调用
            function: async ({ url, method = "GET", headers = {}, body: reqBody }) => {
              const init = { method, headers };
              if (reqBody && !["GET", "HEAD"].includes(method)) init.body = reqBody;

              const r = await fetch(url, init);
              const text = await r.text();

              return JSON.stringify({
                status: r.status,
                contentType: r.headers.get("content-type"),
                body: text.slice(0, 8000)
              });
            }
          }
        ]
      },
      {
        streamFinalResponse: true  // 最终回答流式返回
      }
    );

    return new Response(response, {
      headers: { "Content-Type": "text/event-stream" }
    });
  } catch (e) {
    console.error("AI 调用失败:", e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
