/* ============================================================
   PayPal 支付封装（HTML Plus 原生通道版）
   两种模式：
     - purchase：购买次数（金额 ↔ 次数兑换，快捷次数 10/50/100/500）
     - donate  ：赞助（随意金额，预设 1/2/5/10）
   对外暴露：
     createPurchaseCheckout(options) -> 实例
     createDonateCheckout(options)   -> 实例
     bindPurchaseButton(options)     -> 实例（自动绑定 trigger 按钮）
     bindDonateButton(options)       -> 实例（自动绑定 trigger 按钮）
   ============================================================ */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------
     公共：样式注入（只注入一次）
     ------------------------------------------------------------ */
  const STYLE_ID = 'pp-checkout-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
style.innerHTML = `
  /* ---------- 主题变量（浅色默认） ---------- */
  .modal-overlay{
    --pp-bg:#fff;
    --pp-bg-soft:#f8fbf9;
    --pp-bg-hover:#f0f5f1;
    --pp-bg-hover2:#e1ede6;
    --pp-border:#dce8e0;
    --pp-text:#1f2d24;
    --pp-text-2:#3a4a40;
    --pp-text-3:#8aa398;
    --pp-primary:#2e7d52;
    --pp-primary-soft:rgba(46,125,82,.08);
    --pp-shadow:0 6px 24px rgba(46,125,82,.15);
    --pp-shadow-sm:0 6px 20px rgba(46,125,82,.14);
    --pp-overlay:rgba(20,35,27,.45);
    --pp-disabled:#a9c4b4;
  }

  /* ---------- 深色 ---------- */
  @media (prefers-color-scheme: dark){
    .modal-overlay{
      --pp-bg:#1e2420;
      --pp-bg-soft:#262d28;
      --pp-bg-hover:#2d3530;
      --pp-bg-hover2:#343d37;
      --pp-border:#3a443d;
      --pp-text:#e8efe9;
      --pp-text-2:#c2cec6;
      --pp-text-3:#8a9990;
      --pp-primary:#5cc98d;
      --pp-primary-soft:rgba(92,201,141,.14);
      --pp-shadow:0 6px 24px rgba(0,0,0,.5);
      --pp-shadow-sm:0 6px 20px rgba(0,0,0,.45);
      --pp-overlay:rgba(0,0,0,.6);
      --pp-disabled:#3f5a4a;
    }
  }

  /* ---------- 结构 ---------- */
  .modal-overlay{position:fixed;inset:0;background:var(--pp-overlay);display:none;justify-content:center;align-items:center;z-index:100;padding:16px}
  .modal-overlay.show{display:flex}
  .card{position:relative;background:var(--pp-bg);border-radius:10px;padding:28px;width:100%;max-width:420px;box-shadow:var(--pp-shadow);max-height:90vh;overflow-y:auto;color:var(--pp-text);animation:cardIn .35s cubic-bezier(.34,1.56,.64,1)}
  @keyframes cardIn{0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.03)}100%{opacity:1;transform:scale(1)}}

  /* ---------- 关闭按钮 ---------- */
  .close-btn{position:absolute;top:12px;right:12px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;border-radius:6px;cursor:pointer;color:var(--pp-text-3);transition:background .15s,color .15s}
  .close-btn:hover{background:var(--pp-bg-hover);color:var(--pp-primary)}
  .close-btn svg{width:14px;height:14px}

  /* ---------- 金额输入 ---------- */
  .amount-wrap{position:relative;margin-bottom:6px}
  .amount-wrap input{width:100%;font-size:24px;font-weight:600;padding:14px 90px 14px 42px;border:1.5px solid var(--pp-border);border-radius:8px;outline:none;background:var(--pp-bg-soft);color:var(--pp-text);transition:border-color .15s,background .15s;box-sizing:border-box;-moz-appearance:textfield}
  .amount-wrap input::-webkit-outer-spin-button,
  .amount-wrap input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  .amount-wrap input:focus{border-color:var(--pp-primary);background:var(--pp-bg)}
  .currency-symbol{position:absolute;top:50%;left:14px;transform:translateY(-50%);display:flex;align-items:center;color:var(--pp-primary);pointer-events:none}
  .currency-symbol svg{width:20px;height:20px}

  /* ---------- 币种选择 ---------- */
  .currency-trigger{position:absolute;top:50%;right:10px;transform:translateY(-50%);display:flex;align-items:center;gap:4px;padding:6px 10px;border:none;background:transparent;font-size:13px;font-weight:600;color:var(--pp-primary);cursor:pointer;border-radius:6px}
  .currency-trigger:hover{background:var(--pp-bg-hover)}
  .currency-panel{position:absolute;top:calc(100% + 6px);right:0;background:var(--pp-bg);border-radius:8px;box-shadow:var(--pp-shadow-sm);padding:6px;display:none;z-index:20;min-width:110px;border:1px solid var(--pp-border)}
  .currency-panel.show{display:block}
  .currency-option{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;color:var(--pp-text-2);transition:background .15s}
  .currency-option:hover{background:var(--pp-bg-hover)}
  .currency-option.active{background:var(--pp-primary-soft);color:var(--pp-primary);font-weight:600}
  .currency-option .check{width:14px;height:14px;opacity:0;color:var(--pp-primary)}
  .currency-option.active .check{opacity:1}
  .currency-option .check svg{width:12px;height:12px}

  /* ---------- 提示 ---------- */
  .exchange-hint{font-size:12px;color:var(--pp-text-3);text-align:right;padding-right:4px;margin-bottom:14px;min-height:18px}
  .exchange-hint strong{color:var(--pp-primary);font-weight:600}

  /* ---------- 快捷按钮 ---------- */
  .quick{display:flex;gap:6px;margin-bottom:16px}
  .quick button{flex:1;padding:8px 0;font-size:13px;color:var(--pp-text-2);background:var(--pp-bg-hover);border:none;border-radius:6px;cursor:pointer;transition:background .15s,color .15s}
  .quick button:hover{background:var(--pp-bg-hover2);color:var(--pp-primary)}

  /* ---------- 支付按钮 ---------- */
  .paypal-wrap{position:relative;min-height:44px}
  .pay-btn{display:block;width:100%;padding:14px 0;font-size:15px;font-weight:600;color:#fff;background:var(--pp-primary);border:none;border-radius:6px;cursor:pointer;transition:background .15s,opacity .15s}
  .pay-btn:hover:not(:disabled){opacity:.92}
  .pay-btn:disabled{background:var(--pp-disabled);cursor:not-allowed}

  /* ---------- 底部 ---------- */
  .supported{margin-top:16px;text-align:center}
  .supported img{height:auto;width:50%;opacity:.9}
  @media (prefers-color-scheme: dark){
    .supported img{opacity:.8;filter:brightness(.95)}
  }
`;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------
     货币图标
     ------------------------------------------------------------ */
  const SYMBOLS_SVG = {
    USD: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    CNY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l6 7 6-7M12 11v9M7 13h10M7 17h10"/></svg>`,
    EUR: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10"/></svg>`,
  };

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
  function createPayPalCheckout(options) {
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
      basePrice: bp = { USD: 1, CNY: 6.5, EUR: 0.85 },
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
    const initialAmount = defaultAmount != null
      ? defaultAmount
      : (mode === 'donate' ? 5 : 0.10);

    // 服务端下单 / 捕获接口
    const API_BASE = env === 'live'
      ? 'https://pylind.pages.dev/api/paypal'
      : 'https://pylind.pages.dev/paypal';

    // ---------- 状态 ----------
    let currentCurrency = defaultCurrency;
    let overlayEl = null;

    // ---------- 兑换计算（仅 purchase 有意义）----------
    function calcTimesFor(amount, currency) {
      const base = bp[currency] || 1;
      return Math.round(bt * (parseFloat(amount) || 0) / base);
    }
    function calcTimes(amount) { return calcTimesFor(amount, currentCurrency); }
    function calcAmount(times) {
      const base = bp[currentCurrency] || 1;
      return ((times / bt) * base).toFixed(2);
    }

    // ---------- 生成 HTML ----------
    const uid = 'pp_' + Math.random().toString(36).slice(2, 9);

    const quickButtonsHtml = mode === 'purchase'
      ? quickTimes.map(t => `<button data-times="${t}">${t}</button>`).join('')
      : donatePresets.map(v => `<button data-amount="${v}">${v}</button>`).join('');

    const html = `
      <div class="modal-overlay" id="ppOverlay_${uid}">
        <div class="card">
          <button class="close-btn" id="ppClose_${uid}" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
          ${title ? `<div style="font-size:16px;font-weight:600;color:#1f2d24;margin-bottom:14px">${title}</div>` : ''}
          <div class="amount-wrap">
            <span class="currency-symbol" id="ppSym_${uid}">${SYMBOLS_SVG[currentCurrency] || ''}</span>
            <input id="ppAmount_${uid}" type="number" min="0.01" step="0.01" value="${initialAmount}" />
            <button class="currency-trigger" id="ppCurBtn_${uid}" type="button"><span id="ppCurLabel_${uid}">${currentCurrency}</span></button>
            <div class="currency-panel" id="ppCurPanel_${uid}">
              <div class="currency-option${currentCurrency === 'CNY' ? ' active' : ''}" data-cur="CNY"><span>CNY</span><span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span></div>
              <div class="currency-option${currentCurrency === 'USD' ? ' active' : ''}" data-cur="USD"><span>USD</span><span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span></div>
              <div class="currency-option${currentCurrency === 'EUR' ? ' active' : ''}" data-cur="EUR"><span>EUR</span><span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span></div>
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
        // 赞助模式：不显示兑换提示
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
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    amountInput.addEventListener('input', updateHint);

    curBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      curPanel.classList.toggle('show');
    });
    curPanel.querySelectorAll('.currency-option').forEach(opt => {
      opt.addEventListener('click', () => {
        curPanel.querySelectorAll('.currency-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        currentCurrency = opt.dataset.cur;
        currencyLabel.textContent = currentCurrency;
        currencySymbol.innerHTML = SYMBOLS_SVG[currentCurrency] || '';
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      return res.json();
    }

    // ---------- 发起支付 ----------
    async function startPayment() {
      const rawAmount = amountInput.value || (mode === 'donate' ? '5' : '10');
      const paidAmount = parseFloat(rawAmount) || 0;
      const paidCurrency = currentCurrency;

      // 校验金额
      if (!(paidAmount > 0)) {
        if (typeof onError === 'function') onError(new Error('金额必须大于 0'));
        else alert('Amount must be greater than 0');
        return;
      }

      const earnedTimes = mode === 'purchase'
        ? calcTimesFor(paidAmount, paidCurrency)
        : 0;

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
  function createPurchaseCheckout(options = {}) {
    return createPayPalCheckout(Object.assign({}, options, { mode: 'purchase' }));
  }

  /* ============================================================
     对外：赞助 donate
     ============================================================ */
  function createDonateCheckout(options = {}) {
    return createPayPalCheckout(Object.assign({
      donatePresets: [1, 2, 5, 10],
    }, options, { mode: 'donate' }));
  }

  /* ============================================================
     便捷：绑定按钮
     ============================================================ */
  function bindPurchaseButton(options = {}) {
    return createPurchaseCheckout(options);
  }
  function bindDonateButton(options = {}) {
    return createDonateCheckout(options);
  }

  /* ------------------------------------------------------------
     导出
     ------------------------------------------------------------ */
  const api = {
    createPayPalCheckout,
    createPurchaseCheckout,
    createDonateCheckout,
    bindPurchaseButton,
    bindDonateButton,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.Pay = api;
  global.createPayPalCheckout = createPayPalCheckout;
  global.createPurchaseCheckout = createPurchaseCheckout;
  global.createDonateCheckout = createDonateCheckout;
  global.bindPurchaseButton = bindPurchaseButton;
  global.bindDonateButton = bindDonateButton;
})(typeof window !== 'undefined' ? window : this);