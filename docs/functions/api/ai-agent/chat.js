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
    content: `你是一个 AI 智能助手，可以调用工具。当用户需要访问网页或执行外部操作时，主动使用工具完成任务。可以连续调用多个工具来完成复杂任务。
重要规则：如果用户给出的 Python 代码中出现了 import layout，你必须先调用 get_doc 工具查询 layout 文档，再基于文档内容回答。
当用户要求生成图片时，调用 generate_image 工具，并把返回的 markdown 字段原样输出，不要修改或截断。`
  };

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
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "get_doc",
        description: "查询 layout 模块的文档。当 Python 代码中出现 import layout 时调用，无需任何参数。",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "generate_image",
        description: "根据提示词生成图像。返回 Markdown 图片语法 ![](data:image/jpeg;base64,...)，可直接展示。",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "图像提示词" },
            width: { type: "number", description: "宽度，256-1920，64 的倍数，默认 1024" },
            height: { type: "number", description: "高度，256-1920，64 的倍数，默认 1024" },
            seed: { type: "number", description: "随机种子，可选" }
          },
          required: ["prompt"]
        }
      }
    }
  ];

  const messages = [SYSTEM_PROMPT, ...(Array.isArray(body.messages) ? body.messages : [])];

  // 2. 用 TransformStream 手动构造 SSE，边执行工具边推状态
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sse = (obj) => writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  // 后台执行，立即返回 readable 给前端
  (async () => {
    try {
      const MAX_ROUNDS = 5;
      let round = 0;

      while (round < MAX_ROUNDS) {
        round++;

        const result = await context.env.AI.run(
          "@cf/zai-org/glm-4.7-flash",
          { messages, tools, tool_choice: "auto" }
        );

        const msg = result.choices?.[0]?.message;
        messages.push(msg);

        if (!msg?.tool_calls?.length) break;

        // 本轮每个工具调用都推一条状态
        for (const call of msg.tool_calls) {
          let args;
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            args = {};
          }

          // 通知前端：开始调用工具
          await sse({
            type: "tool_call",
            name: call.function.name,
            args
          });

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
              const now = new Date();
              const offsetMin = -now.getTimezoneOffset();
              const sign = offsetMin >= 0 ? "+" : "-";
              const abs = Math.abs(offsetMin);
              const hh = String(Math.floor(abs / 60)).padStart(2, "0");
              const mm = String(abs % 60).padStart(2, "0");
              const utcOffset = `UTC${sign}${hh}:${mm}`;
              const local = now.toLocaleString("zh-CN", {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                hour12: false
              });
              toolResult = JSON.stringify({ localTime: local, utcOffset, iso: now.toISOString(), timestamp: now.getTime() });
            } else if (call.function.name === "get_doc") {
              const docUrl = new URL("/res/layout.md", context.request.url).toString();
              const r = await fetch(docUrl);
              if (!r.ok) {
                toolResult = JSON.stringify({ error: `文档获取失败: ${r.status}` });
              } else {
                const text = await r.text();
                toolResult = JSON.stringify({ url: docUrl, content: text.slice(0, 12000) });
              }
            } else if (call.function.name === "generate_image") {
              const p = args.prompt;
              if (!p) {
                toolResult = JSON.stringify({ error: "缺少 prompt" });
              } else {
                let w = Number(args.width) || 1024;
                let h = Number(args.height) || 1024;
                w = Math.min(1920, Math.max(256, Math.round(w / 64) * 64));
                h = Math.min(1920, Math.max(256, Math.round(h / 64) * 64));

                const form = new FormData();
                form.append("prompt", p);
                form.append("width", String(w));
                form.append("height", String(h));
                if (args.seed !== undefined && args.seed !== null) {
                  form.append("seed", String(args.seed));
                }

                const formResponse = new Response(form);
                const imageResp = await context.env.AI.run(
                  "@cf/black-forest-labs/flux-2-klein-4b",
                  {
                    multipart: {
                      body: formResponse.body,
                      contentType: formResponse.headers.get("content-type"),
                    },
                  }
                );

                const b64 = imageResp.result?.image || imageResp.image;
                if (!b64) {
                  toolResult = JSON.stringify({ error: "图像生成失败" });
                } else {
                  toolResult = JSON.stringify({
                    width: w,
                    height: h,
                    markdown: `![generated](data:image/jpeg;base64,${b64})`
                  });
                }
              }
            } else {
              toolResult = JSON.stringify({ error: `未知工具: ${call.function.name}` });
            }
          } catch (e) {
            toolResult = JSON.stringify({ error: e.message });
          }

          // 通知前端：工具执行完成（generate_image 完整推送，避免截断 base64）
          await sse({
            type: "tool_result",
            name: call.function.name,
            result: call.function.name === "generate_image"
              ? toolResult
              : toolResult.slice(0, 500)
          });

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult
          });
        }
      }

      // 3. 最后一轮流式返回最终回答
      const finalResult = await context.env.AI.run(
        "@cf/zai-org/glm-4.7-flash",
        { messages, stream: true }
      );

      const reader = finalResult.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }

      await writer.close();
    } catch (e) {
      await sse({ type: "error", message: e.message });
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
}
