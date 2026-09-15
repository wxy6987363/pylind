export async function onRequest(context) {
  const response = await context.env.ai_agent.run(
    "@cf/zai-org/glm-4.7-flash",  // 仅改这里
    {
      messages: [
        { role: "user", content: "用 JavaScript 写一个快速排序" }
      ]
    }
  );

  return Response.json(response);
}
