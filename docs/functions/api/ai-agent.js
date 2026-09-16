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

  // 2. 自动在最前面插入 system 消息
  const SYSTEM_PROMPT = {
    role: "system",
    content: "你是一个 AI 智能助手 GLM，可以调用工具。当用户需要访问网页、发起 HTTP 请求或执行外部操作时，主动使用工具完成任务，而不是让用户自己去执行。"
  };

  const messages = [
    SYSTEM_PROMPT,
    ...(Array.isArray(body.messages) ? body.messages : [])
  ];

  // 3. 调用模型（流式）
  try {
    const aiResult = await context.env.ai_agent.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages,
        stream: true
      }
    );

    return new Response(aiResult, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache"
      }
    });
  } catch (e) {
    console.error("AI 调用失败:", e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
