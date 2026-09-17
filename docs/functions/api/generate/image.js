export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const prompt = url.searchParams.get("prompt") || "a beautiful sunset";

  // env.AI 已在 Dashboard 中绑定
  const response = await env.AI.run(
    "@cf/black-forest-labs/flux-1-schnell",
    { prompt }
  );

  // 解码 base64 为二进制图像
  const binaryString = atob(response.image);
  const img = Uint8Array.from(binaryString, (m) => m.codePointAt(0));

  return new Response(img, {
    headers: { "Content-Type": "image/jpeg" },
  });
}
