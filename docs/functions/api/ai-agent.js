export async function onRequest(context) {
  // 1. 取 Authorization 头
  const auth = context.request.headers.get("Authorization");

  // 2. 校验格式：必须是 "Bearer xxx"
  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = auth.slice(7).trim(); // 去掉 "Bearer "

  // 3. 跟你预设的密钥比对（建议用环境变量存，别硬编码）
  if (token !== context.env.API_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }

  // 4. 校验通过，继续走 AI 逻辑
  try {
    const body = await context.request.json();
    const aiResult = await context.env.ai_agent.run(
      "@cf/qwen/qwen2.5-coder-32b-instruct",
      { messages: body.messages, stream: true }
    );

    return new Response(aiResult, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache"
      }
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
