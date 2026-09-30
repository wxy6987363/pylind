// ai.js
const DEFAULT_API_URL = "https://pylind.pages.dev/api/ai-agent/chat";
const DEFAULT_HISTORY_URL = "https://pylind.pages.dev/api/ai-agent/history";

export class AIClient {
	constructor({
		token = "",
		userId = "6f2e5c434fcd4c75",
		apiUrl = DEFAULT_API_URL,
		historyUrl = DEFAULT_HISTORY_URL,
	} = {}) {
		this.apiUrl = apiUrl;
		this.historyUrl = historyUrl;
		this.userId = userId;
		this.token = token;
		this.history = [];   // [{ role, content, reasoning? }, ...]
	}

	clear() {
		this.history = [];
	}

	async loadHistory(token) {
		const useToken = (token || this.token || "").trim();
		if (!useToken) {
			this.history = [];
			return [];
		}

		try {
			const res = await fetch(this.historyUrl, {
				headers: {
					"Authorization": `Bearer ${useToken}`,
				},
			});
			if (!res.ok) {
				console.warn("[AIClient] loadHistory HTTP", res.status);
				this.history = [];
				return [];
			}
			const data = await res.json();
			if (data.success && Array.isArray(data.messages)) {
				this.history = data.messages;
			} else {
				this.history = [];
			}
		} catch (e) {
			console.warn("[AIClient] loadHistory failed:", e);
			this.history = [];
		}
		return this.history;
	}

	async clearHistory(token) {
		const useToken = (token || this.token || "").trim();
		if (useToken) {
			try {
				await fetch(this.historyUrl, {
					method: "POST",
					headers: {
						"Authorization": `Bearer ${useToken}`,
					},
				});
			} catch (e) {
				console.warn("[AIClient] clearHistory failed:", e);
			}
		}
		this.history = [];
	}

	/**
	 * @param {string} text
	 * @param {object} options
	 *   - token
	 *   - context: { fileName, filePath, projectName, code }
	 *   - onContent(chunk)
	 *   - onReasoning(chunk)
	 *   - onToolCall(name, args)
	 *   - onToolResult(name, result)
	 *   - onCredit(delta, credit)
	 *   - onDone(totalCost)
	 *   - onError(err)
	 */
	async send(text, {
		token,
		context,
		onContent,
		onReasoning,
		onToolCall,
		onToolResult,
		onCredit,
		onDone,
		onError
	} = {}) {
		const useToken = (token || this.token || "").trim();
		if (!useToken) {
			const err = new Error("未登录，请先登录");
			onError?.(err);
			throw err;
		}

		// 本地 history 只追加
		const userMsg = { role: "user", content: text };
		this.history.push(userMsg);

		// ★ 全局累加器（思考 + 正文）
		let accumulatedReasoning = "";
		let accumulatedContent = "";

		try {
			const payload = {
				messages: [userMsg],
			};

			if (context && typeof context.code === "string" && context.code.trim()) {
				payload.context = {
					fileName: context.fileName || "",
					filePath: context.filePath || "",
					projectName: context.projectName || "",
					code: context.code.slice(0, 20000),
				};
			}

			const res = await fetch(this.apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${useToken}`,
					"id": this.userId,
				},
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				if (res.status === 401) throw new Error("登录已失效，请重新登录");
				if (res.status === 402) {
					let p = null;
					try {
						p = await res.json();
					} catch {}
					const credit = p?.credit ?? 0;
					throw new Error(`余额不足（当前 ${credit} 分）`);
				}
				throw new Error(`HTTP ${res.status}`);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const {
					done,
					value
				} = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, {
					stream: true
				});
				const parts = buffer.split("\n\n");
				buffer = parts.pop() ?? "";

				for (const part of parts) {
					for (const line of part.split("\n")) {
						if (!line.startsWith("data: ")) continue;
						const data = line.slice(6).trim();
						if (data === "[DONE]") continue;

						let json;
						try {
							json = JSON.parse(data);
						} catch {
							continue;
						}

						try {
							if (json.type === "tool_call") {
								onToolCall?.(json.name, json.args);
								continue;
							}
							if (json.type === "tool_result") {
								onToolResult?.(json.name, json.result);
								continue;
							}
							if (json.type === "credit") {
								onCredit?.(json.delta, json.credit);
								continue;
							}
							if (json.type === "done") {
								onDone?.(json.totalCost ?? 0);
								continue;
							}
							if (json.type === "error") {
								throw new Error(json.message || "AI 服务出错");
							}

							// 普通 chat chunk
							const delta = json.choices?.[0]?.delta;

							// ★ 思考累加
							if (delta?.reasoning) {
								accumulatedReasoning += delta.reasoning;
								onReasoning?.(delta.reasoning);
							}
							// 兼容个别字段名
							if (delta?.reasoning_content) {
								accumulatedReasoning += delta.reasoning_content;
								onReasoning?.(delta.reasoning_content);
							}

							// ★ 正文累加
							if (delta?.content) {
								accumulatedContent += delta.content;
								onContent?.(delta.content);
							}
						} catch (innerErr) {
							if (innerErr && innerErr.message) {
								throw innerErr;
							}
						}
					}
				}
			}

			// ★ 本地 history 追加 assistant（思考 + 正文分开存）
			if (accumulatedContent || accumulatedReasoning) {
				const assistantMsg = {
					role: "assistant",
					content: accumulatedContent.trim(),
				};
				if (accumulatedReasoning.trim()) {
					assistantMsg.reasoning = accumulatedReasoning.trim();
				}
				this.history.push(assistantMsg);
			}

			// 本地保留最近 40 条
			if (this.history.length > 40) {
				this.history = this.history.slice(-40);
			}

			return accumulatedContent;
		} catch (e) {
			onError?.(e);
			throw e;
		}
	}
}