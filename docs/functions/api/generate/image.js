export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. 验证 Token
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!env.API_TOKEN || token !== env.API_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. 解析 POST body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { prompt, aspectRatio, seed } = body;
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. 根据长宽比计算宽高（总面积 1024*1024 = 1048576）
  let width, height;
  if (aspectRatio) {
    const [w, h] = aspectRatio.split(":").map(Number);
    if (w && h && w > 0 && h > 0) {
      const total = 1048576;
      const ratio = w / h;
      height = Math.round(Math.sqrt(total / ratio));
      width = Math.round(total / height);
    }
  }

  if (!width || !height) {
    width = 1024;
    height = 1024;
  }

  // 4. 对齐到 16 的倍数
  width = Math.round(width / 16) * 16;
  height = Math.round(height / 16) * 16;

  // 5. 构建模型参数
  const modelParams = { prompt, width, height };
  if (seed !== undefined && seed !== null) {
    modelParams.seed = seed;
  }

  try {
    const response = await env.AI.run(
      "@cf/black-forest-labs/flux-1-schnell",
      modelParams
    );

    const binaryString = atob(response.image);
    const img = Uint8Array.from(binaryString, (m) => m.codePointAt(0));

    return new Response(img, {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Image-Width": String(width),
        "X-Image-Height": String(height),
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
