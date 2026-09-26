/* ============================================================
   PayPal 支付封装（HTML Plus 原生通道版）— ESM 版本
   两种模式：
     - purchase：购买次数（金额 ↔ 次数兑换，快捷次数 10/50/100/500）
     - donate  ：赞助（随意金额，预设 1/2/5/10）
   对外暴露：
     createPurchaseCheckout(options) -> 实例
     createDonateCheckout(options)   -> 实例
     bindPurchaseButton(options)     -> 实例（自动绑定 trigger 按钮）
     bindDonateButton(options)       -> 实例（自动绑定 trigger 按钮）
   ============================================================ */

/* ------------------------------------------------------------
   公共：样式注入（只注入一次）
   ------------------------------------------------------------ */
const STYLE_ID = 'pp-checkout-style';

function ensureStyle() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.innerHTML = `
    .modal-overlay{position:fixed;inset:0;background:rgba(20,35,27,.45);display:none;justify-content:center;align-items:center;z-index:100;padding:16px}
    .modal-overlay.show{display:flex}
    .modal-overlay .card{position:relative;background:#fff;border-radius:10px;padding:28px;width:100%;max-width:420px;box-shadow:0 6px 24px rgba(46,125,82,.15);max-height:90vh;overflow-y:auto;animation:cardIn .35s cubic-bezier(.34,1.56,.64,1)}
    @keyframes cardIn{0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.03)}100%{opacity:1;transform:scale(1)}}
    .modal-overlay .card .close-btn{position:absolute;top:3px;right:3px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;border-radius:6px;cursor:pointer;color:#8aa398}
    .modal-overlay .card .close-btn svg{width:20px;height:20px}
    .modal-overlay .card .amount-wrap{position:relative;margin-bottom:6px}
    .modal-overlay .card .amount-wrap input{width:100%;font-size:24px;font-weight:600;padding:10px 90px 10px 42px;border:1.5px solid #dce8e0;border-radius:8px;outline:none;background:#f8fbf9;color:#1f2d24;box-sizing:border-box}
    .modal-overlay .card .amount-wrap input:focus{border-color:#2e7d52;background:#fff}
    .modal-overlay .card .currency-symbol{position:absolute;top:50%;left:14px;transform:translateY(-50%);display:flex;align-items:center;color:#2e7d52;pointer-events:none}
    .modal-overlay .card .currency-symbol svg{width:20px;height:20px}
    .modal-overlay .card .currency-trigger{position:absolute;top:50%;right:10px;transform:translateY(-50%);display:flex;align-items:center;gap:4px;border:none;background:transparent;font-size:16px;font-weight:600;color:#2e7d52;cursor:pointer;border-radius:6px}
    .modal-overlay .card .currency-panel{position:absolute;top:calc(100% + 6px);right:0;background:#fff;border-radius:8px;box-shadow:0 6px 20px rgba(46,125,82,.14);padding:6px;display:none;z-index:20;min-width:110px}
    .modal-overlay .card .currency-panel.show{display:block}
    .modal-overlay .card .currency-option{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;color:#3a4a40}
    .modal-overlay .card .currency-option:hover{background:#f0f5f1}
    .modal-overlay .card .currency-option.active{background:rgba(46,125,82,.08);color:#2e7d52;font-weight:600}
    .modal-overlay .card .currency-option .check{width:14px;height:14px;opacity:0;color:#2e7d52}
    .modal-overlay .card .currency-option.active .check{opacity:1}
    .modal-overlay .card .currency-option .check svg{width:12px;height:12px}
    .modal-overlay .card .exchange-hint{font-size:12px;color:#8aa398;text-align:right;padding-right:4px;margin-bottom:14px;min-height:18px}
    .modal-overlay .card .exchange-hint strong{color:#2e7d52;font-weight:600}
    .modal-overlay .card .quick{display:flex;gap:6px;margin-bottom:16px}
    .modal-overlay .card .quick button{flex:1;padding:8px 0;font-size:13px;color:#3a4a40;background:#f0f5f1;border:none;border-radius:6px;cursor:pointer}
    .modal-overlay .card .quick button:hover{background:#e1ede6;color:#2e7d52}
    .modal-overlay .card .paypal-wrap{position:relative;min-height:44px}
    .modal-overlay .card .pay-btn{display:block;width:100%;padding:14px 0;font-size:15px;font-weight:600;color:#fff;background:#2e7d52;border:none;border-radius:6px;cursor:pointer}
    .modal-overlay .card .pay-btn:disabled{background:#a9c4b4;cursor:not-allowed}
    .modal-overlay .card .supported{margin-top:16px;text-align:center}
    .modal-overlay .card .supported img{height:auto;width:50%}
  `;
	document.head.appendChild(style);
}

/* ------------------------------------------------------------
   货币图标（只存 path d，便于形变）
   CNY 与 JPY 都是「¥」字形，这里做细微差异以便切换时可见形变
   ------------------------------------------------------------ */
const SYMBOLS_PATH = {
	USD: "M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
	CNY: "M6 4l6 7 6-7M12 11v9M7 13h10M7 17h10",
	EUR: "M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10",
	GBP: "M6 21h12M6 13h8M6 21c3-2 4-5 4-8V6a3 3 0 0 1 6 0",
	CHF: "M10 22 V4 H18 M10 12 H16 M6 20 H14 M-12 -12",
	JPY: "M6 4l6 7 6-7M12 11v9M7 13h10M7 17h10",
};

function symbolSvg(d) {
	return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

/* ------------------------------------------------------------
   原生 SVG 形变工具（采样 + 逐点插值）
   ------------------------------------------------------------ */
const _svgNS = "http://www.w3.org/2000/svg";
const _sampleCache = new Map();

function _samplePath(d, samplesPerSub = 28) {
	if (_sampleCache.has(d)) return _sampleCache.get(d);
	const p = document.createElementNS(_svgNS, "path");
	const holder = document.createElementNS(_svgNS, "svg");
	holder.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
	holder.appendChild(p);
	document.body.appendChild(holder);

	const subPaths = d.match(/[Mm][^Mm]*/g) || [d];
	const result = subPaths.map(sp => {
		p.setAttribute("d", sp);
		const len = p.getTotalLength();
		const pts = [];
		for (let i = 0; i <= samplesPerSub; i++) {
			const pt = p.getPointAtLength((len * i) / samplesPerSub);
			pts.push({
				x: pt.x,
				y: pt.y
			});
		}
		return pts;
	});

	document.body.removeChild(holder);
	_sampleCache.set(d, result);
	return result;
}

function _alignShapes(a, b) {
	const nSub = Math.max(a.length, b.length);
	const nPts = Math.max(a[0].length, b[0].length);
	const norm = (shapes) => {
		const out = [];
		for (let i = 0; i < nSub; i++) {
			const sp = shapes[i] || shapes[shapes.length - 1];
			const pts = [];
			for (let j = 0; j < nPts; j++) {
				pts.push({
					...sp[Math.min(j, sp.length - 1)]
				});
			}
			out.push(pts);
		}
		return out;
	};
	return {
		a: norm(a),
		b: norm(b)
	};
}

function _lerpShapes(a, b, t) {
	const parts = [];
	for (let i = 0; i < a.length; i++) {
		const sa = a[i],
			sb = b[i];
		let str = "";
		for (let j = 0; j < sa.length; j++) {
			const x = sa[j].x + (sb[j].x - sa[j].x) * t;
			const y = sa[j].y + (sb[j].y - sa[j].y) * t;
			str += (j === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
		}
		parts.push(str);
	}
	return parts.join("");
}

function morphPath(pathEl, fromD, toD, duration = 380) {
	if (fromD === toD) return; // 字形相同，不形变
	const {
		a,
		b
	} = _alignShapes(_samplePath(fromD), _samplePath(toD));
	const start = performance.now();
	if (pathEl._morphRaf) cancelAnimationFrame(pathEl._morphRaf);

	function tick(now) {
		let t = (now - start) / duration;
		if (t > 1) t = 1;
		const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
		pathEl.setAttribute("d", _lerpShapes(a, b, e));
		if (t < 1) pathEl._morphRaf = requestAnimationFrame(tick);
	}
	pathEl._morphRaf = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------
   公共：获取 PayPal 原生支付通道
   ------------------------------------------------------------ */
let _payChannel = null;

function getPayPalChannel() {
	return new Promise((resolve, reject) => {
		if (_payChannel) return resolve(_payChannel);
		if (typeof plus === 'undefined' || !plus.payment) {
			return reject(new Error('plus.payment 不可用，请在 5+ App 环境中运行'));
		}
		plus.payment.getChannels((channels) => {
			const ch = channels.find(c => c.id === 'paypal');
			if (!ch) return reject(new Error('未找到 paypal 支付通道，请在 manifest 中勾选'));
			_payChannel = ch;
			resolve(ch);
		}, (err) => reject(err));
	});
}

/* ------------------------------------------------------------
   支持的货币列表（统一驱动面板）
   ------------------------------------------------------------ */
const CURRENCIES = ['CNY', 'USD', 'EUR', 'GBP', 'CHF', 'JPY'];

/* ============================================================
   核心工厂
   options:
     mode: 'purchase' | 'donate'  （必填）
     clientId, env, currency, amount,
     onSuccess, onCancel, onError,
     basePrice, baseTimes,        （仅 purchase 用）
     donatePresets: [1,2,5,10]    （仅 donate 用，默认 [1,2,5,10]）
     quickTimes:  [10,50,100,500] （仅 purchase 用，默认 10/50/100/500）
     trigger,                     （可选，绑触发按钮）
     title                        （可选，模态框标题，默认无）
   ============================================================ */
export function createPayPalCheckout(options) {
	ensureStyle();

	const {
		mode = 'purchase',
			clientId,
			env = 'sandbox',
			currency: defaultCurrency = 'USD',
			amount: defaultAmount,
			onSuccess,
			onCancel,
			onError,
			basePrice: bp = {
				USD: 1,
				CNY: 6.5,
				EUR: 0.85,
				GBP: 0.8,
				CHF: 0.8,
				JPY: 150
			},
			baseTimes: bt = 100,
			donatePresets = [1, 2, 5, 10],
			quickTimes = [10, 50, 100, 500],
			trigger,
			title = '',
	} = options;

	if (mode !== 'purchase' && mode !== 'donate') {
		throw new Error("mode 必须是 'purchase' 或 'donate'");
	}

	// 默认金额：购买 0.10，赞助 5
	const initialAmount = defaultAmount != null ?
		defaultAmount :
		(mode === 'donate' ? 5 : 0.10);

	// 服务端下单 / 捕获接口
	const API_BASE = env === 'live' ?
		'https://pylind.pages.dev/api/paypal' :
		'https://pylind.pages.dev/paypal';

	// ---------- 状态 ----------
	let currentCurrency = defaultCurrency;
	let overlayEl = null;

	// ---------- 兑换计算（仅 purchase 有意义）----------
	function calcTimesFor(amount, currency) {
		const base = bp[currency] || 1;
		return Math.round(bt * (parseFloat(amount) || 0) / base);
	}

	function calcTimes(amount) {
		return calcTimesFor(amount, currentCurrency);
	}

	function calcAmount(times) {
		const base = bp[currentCurrency] || 1;
		return ((times / bt) * base).toFixed(2);
	}

	// ---------- 生成 HTML ----------
	const uid = 'pp_' + Math.random().toString(36).slice(2, 9);

	const quickButtonsHtml = mode === 'purchase' ?
		quickTimes.map(t => `<button data-times="${t}">${t}</button>`).join('') :
		donatePresets.map(v => `<button data-amount="${v}">${v}</button>`).join('');

	// 用 CURRENCIES 统一生成面板项
	const currencyOptionsHtml = CURRENCIES.map(cur => `
    <div class="currency-option${currentCurrency === cur ? ' active' : ''}" data-cur="${cur}">
      <span>${cur}</span>
      <span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>
    </div>`).join('');

	const html = `
    <div class="modal-overlay" id="ppOverlay_${uid}">
      <div class="card">
        <button class="close-btn" id="ppClose_${uid}" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        ${title ? `<div style="font-size:16px;font-weight:600;color:#1f2d24;margin-bottom:14px">${title}</div>` : ''}
        <div class="amount-wrap">
          <span class="currency-symbol" id="ppSym_${uid}">${symbolSvg(SYMBOLS_PATH[currentCurrency])}</span>
          <input id="ppAmount_${uid}" type="number" min="0.01" step="0.01" value="${initialAmount}" />
          <button class="currency-trigger" id="ppCurBtn_${uid}" type="button"><span id="ppCurLabel_${uid}">${currentCurrency}</span></button>
          <div class="currency-panel" id="ppCurPanel_${uid}">
            ${currencyOptionsHtml}
          </div>
        </div>
        <div class="exchange-hint" id="ppHint_${uid}"></div>
        <div class="quick" id="ppQuick_${uid}">${quickButtonsHtml}</div>
        <div class="paypal-wrap">
          <button class="pay-btn" id="ppPay_${uid}" type="button">PayPal</button>
        </div>
        <div class="supported">
          <img src="https://www.paypalobjects.com/webstatic/mktg/logo/AM_mc_vs_dc_ae.jpg" alt="Accepted Payment Methods" />
        </div>
      </div>
    </div>`;

	const wrapper = document.createElement('div');
	wrapper.innerHTML = html;
	document.body.appendChild(wrapper.firstElementChild);

	// ---------- DOM 引用 ----------
	const overlay = document.getElementById(`ppOverlay_${uid}`);
	const closeBtn = document.getElementById(`ppClose_${uid}`);
	const amountInput = document.getElementById(`ppAmount_${uid}`);
	const currencySymbol = document.getElementById(`ppSym_${uid}`);
	const currencyLabel = document.getElementById(`ppCurLabel_${uid}`);
	const exchangeHint = document.getElementById(`ppHint_${uid}`);
	const curBtn = document.getElementById(`ppCurBtn_${uid}`);
	const curPanel = document.getElementById(`ppCurPanel_${uid}`);
	const payBtn = document.getElementById(`ppPay_${uid}`);
	const quickBox = document.getElementById(`ppQuick_${uid}`);

	overlayEl = overlay;

	// ---------- UI ----------
	function updateHint() {
		if (mode === 'purchase') {
			const times = calcTimes(amountInput.value);
			exchangeHint.innerHTML = `Exchangeable: <strong>${times.toLocaleString()}</strong> times`;
		} else {
			exchangeHint.innerHTML = '';
		}
	}

	function openModal() {
		overlay.classList.add('show');
		document.body.style.overflow = 'hidden';
		updateHint();
	}

	function closeModal() {
		overlay.classList.remove('show');
		document.body.style.overflow = '';
	}

	// ---------- 事件 ----------
	closeBtn.addEventListener('click', closeModal);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) closeModal();
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeModal();
	});
	amountInput.addEventListener('input', updateHint);

	curBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		curPanel.classList.toggle('show');
	});

	curPanel.querySelectorAll('.currency-option').forEach(opt => {
		opt.addEventListener('click', () => {
			curPanel.querySelectorAll('.currency-option').forEach(o => o.classList.remove('active'));
			opt.classList.add('active');

			const nextCur = opt.dataset.cur;
			if (nextCur !== currentCurrency) {
				const pathEl = currencySymbol.querySelector('path');
				const fromD = SYMBOLS_PATH[currentCurrency];
				const toD = SYMBOLS_PATH[nextCur];
				if (pathEl && fromD && toD) {
					morphPath(pathEl, fromD, toD, 380);
				} else {
					currencySymbol.innerHTML = symbolSvg(SYMBOLS_PATH[nextCur]);
				}
				currentCurrency = nextCur;
			}
			currencyLabel.textContent = currentCurrency;
			curPanel.classList.remove('show');
			updateHint();
		});
	});

	document.addEventListener('click', (e) => {
		if (!e.target.closest(`#ppAmount_${uid}`) && !e.target.closest(`#ppCurBtn_${uid}`)) {
			curPanel.classList.remove('show');
		}
	});

	// 快捷按钮：购买=次数，赞助=金额
	quickBox.querySelectorAll('button').forEach(btn => {
		btn.addEventListener('click', () => {
			if (mode === 'purchase') {
				const times = parseInt(btn.dataset.times, 10);
				amountInput.value = calcAmount(times);
			} else {
				amountInput.value = btn.dataset.amount;
			}
			updateHint();
		});
	});

	// ---------- 服务端下单 / 捕获 ----------
	async function createOrder(rawAmount, currency) {
		const value = parseFloat(rawAmount).toFixed(2);
		const res = await fetch(`${API_BASE}/order?amount=${value}&currency=${currency}`);
		return res.text();
	}
	async function captureOrder(orderId) {
		const res = await fetch(`${API_BASE}/capture`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				orderId
			}),
		});
		return res.json();
	}

	// ---------- 发起支付 ----------
	async function startPayment() {
		const rawAmount = amountInput.value || (mode === 'donate' ? '5' : '10');
		const paidAmount = parseFloat(rawAmount) || 0;
		const paidCurrency = currentCurrency;

		if (!(paidAmount > 0)) {
			if (typeof onError === 'function') onError(new Error('金额必须大于 0'));
			else alert('Amount must be greater than 0');
			return;
		}

		const earnedTimes = mode === 'purchase' ?
			calcTimesFor(paidAmount, paidCurrency) :
			0;

		payBtn.disabled = true;
		payBtn.textContent = 'Processing...';

		try {
			// 1. 服务端创建 PayPal 订单
			const orderId = await createOrder(rawAmount, paidCurrency);

			// 2. 获取原生通道
			const channel = await getPayPalChannel();

			// 3. 组装参数
			const orderInfo = {
				orderId,
				clientId,
				currency: paidCurrency,
				environment: env === 'live' ? 'live' : 'sandbox',
			};

			// 4. 调起原生支付
			plus.payment.request(
				channel,
				orderInfo,
				async (result) => {
						console.log(JSON.stringify(result));
						try {
							const captureRes = await captureOrder(orderId);
							if (captureRes.success) {
								if (typeof onSuccess === 'function') {
									const payload = {
										data: result,
										amount: paidAmount,
										currency: paidCurrency,
										result: captureRes,
										mode,
									};
									if (mode === 'purchase') payload.times = earnedTimes;
									onSuccess(payload);
								}
								closeModal();
							} else {
								const err = new Error(captureRes.error || 'Capture failed');
								if (typeof onError === 'function') onError(err);
								else alert('Failed: ' + err.message);
							}
						} catch (err) {
							if (typeof onError === 'function') onError(err);
							else alert('Network error: ' + err.message);
						} finally {
							payBtn.disabled = false;
							payBtn.textContent = 'PayPal';
						}
					},
					(err) => {
						const msg = (err && (err.message || err.code)) || 'payment failed';
						const isCancel = /cancel/i.test(String(msg));
						if (isCancel) {
							if (typeof onCancel === 'function') onCancel();
						} else {
							if (typeof onError === 'function') onError(new Error(msg));
							else alert('Error: ' + msg);
						}
						payBtn.disabled = false;
						payBtn.textContent = 'PayPal';
					}
			);
		} catch (err) {
			console.error(err);
			if (typeof onError === 'function') onError(err);
			else alert('Error: ' + err.message);
			payBtn.disabled = false;
			payBtn.textContent = 'PayPal';
		}
	}

	payBtn.addEventListener('click', startPayment);

	// ---------- 绑定触发按钮 ----------
	if (trigger) {
		const el = typeof trigger === 'string' ? document.querySelector(trigger) : trigger;
		if (el) el.addEventListener('click', openModal);
	}

	// ---------- 暴露 API ----------
	return {
		mode,
		open: openModal,
		close: closeModal,
		getCurrency: () => currentCurrency,
		getAmount: () => amountInput.value,
		pay: startPayment,
		overlay: overlayEl,
	};
}

/* ============================================================
   对外：购买次数
   ============================================================ */
export function purchase(options = {}) {
	return createPayPalCheckout(Object.assign({}, options, {
		mode: 'purchase'
	}));
}

/* ============================================================
   对外：赞助 donate
   ============================================================ */
export function donate(options = {}) {
	return createPayPalCheckout(Object.assign({
		donatePresets: [1, 2, 5, 10],
	}, options, {
		mode: 'donate'
	}));
}