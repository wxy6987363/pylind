export async function onRequest(context) {
  try {
    const body = await context.request.json();

    const aiResult = await context.env.ai_agent.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages: body.messages,
        stream: true  // 关键：开启流式
      }
    );

    // aiResult 就是 SSE 流，直接返回
    return new Response(aiResult, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (e) {
    console.error("AI error:", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
