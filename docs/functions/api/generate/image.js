// 1. 验证 Token
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

  const { prompt, seed } = body;
  let { width, height } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. 默认尺寸
  width = Number(width) || 1024;
  height = Number(height) || 1024;

  // 4. 限制范围 256-1920，并对齐到 64 的倍数
  width = Math.min(1920, Math.max(256, Math.round(width / 64) * 64));
  height = Math.min(1920, Math.max(256, Math.round(height / 64) * 64));

  // 5. 构建 FormData
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(width));
  form.append("height", String(height));
  if (seed !== undefined && seed !== null) {
    form.append("seed", String(seed));
  }

  const formResponse = new Response(form);
  const formStream = formResponse.body;
  const formContentType = formResponse.headers.get("content-type");

  try {
    const response = await env.AI.run(
      "@cf/black-forest-labs/flux-2-klein-4b",
      {
        multipart: {
          body: formStream,
          contentType: formContentType,
        },
      }
    );

    const base64Image = response.result?.image || response.image;
    if (!base64Image) {
      throw new Error("No image in response");
    }

    const binaryString = atob(base64Image);
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
