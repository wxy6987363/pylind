// ai.js
const DEFAULT_API_URL = "https://pylind.pages.dev/api/ai-agent/chat";

export class AIClient {
  constructor({ token, userId = "6f2e5c434fcd4c75", apiUrl = DEFAULT_API_URL }) {
    if (!token) throw new Error("缺少 token");
    this.apiUrl = apiUrl;
	this.userId = userId;
    this.token = token;
    this.history = [];
  }

  clear() {
    this.history = [];
  }

  async send(text, { onContent, onReasoning, onToolCall, onToolResult, onDone, onError } = {}) {
    this.history.push({ role: "user", content: text });

    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`,
		  "id": this.userId
        },
        body: JSON.stringify({ messages: this.history })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);

              if (json.type === "tool_call") {
                onToolCall?.(json.name, json.args);
                continue;
              }
              if (json.type === "tool_result") {
                onToolResult?.(json.name, json.result);
                continue;
              }
              if (json.type === "error") {
                throw new Error(json.message);
              }

              const delta = json.choices?.[0]?.delta;
              if (delta?.reasoning) onReasoning?.(delta.reasoning);
              if (delta?.content) {
                fullText += delta.content;
                onContent?.(delta.content);
              }
            } catch {}
          }
        }
      }

      this.history.push({ role: "assistant", content: fullText });
      onDone?.();
      return fullText;
    } catch (e) {
      onError?.(e);
      throw e;
    }
  }
}