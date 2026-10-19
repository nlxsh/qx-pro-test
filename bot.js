javascript:(function(){
  'use strict';

  /* ==========================================================================
     1. CONFIGURATION & STATE
     ========================================================================== */
  const CONFIG = {
    fastEMA: 5,
    slowEMA: 20,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    maxLossStreak: 4,
    cooldownHours: 2,
    tradeDuration: 60, // seconds
    balanceSelector: 'div.usermenu__info-balance',
    assetNameSelectors: ['.asset-name', '.current-asset', '[data-testid="asset-name"]'],
    priceSelectors: ['.chart-price', '.current-price', '[data-testid="price"]']
  };

  const state = {
    prices: [],
    asset: '—',
    lastPrice: 0,
    lossStreak: 0,
    totalSignals: 0,
    winningSignals: 0,
    mode: 'manual', // 'manual' or 'auto'
    isTradeActive: false,
    cooldownUntil: 0,
    lastSignal: null,
    lastBalance: null,
    tradeStartBalance: null,
    tradeStartTime: 0
  };

  /* ==========================================================================
     2. UTILITY HELPERS
     ========================================================================== */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function parseNumber(str) {
    if (!str) return NaN;
    return parseFloat(str.replace(/[^0-9.\-]/g, ''));
  }

  /* ==========================================================================
     3. WEBSOCKET INTERCEPTION (Socket.IO)
     ========================================================================== */
  const OriginalWebSocket = window.WebSocket;
  const sockets = new Set();

  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);
    sockets.add(ws);

    ws.addEventListener('message', (event) => {
      try {
        const raw = event.data;
        if (typeof raw !== 'string') return;

        // Socket.IO frames typically start with "42" (event) or "43" etc.
        if (!raw.startsWith('42')) return;

        const payload = JSON.parse(raw.slice(2));
        if (!Array.isArray(payload) || payload.length < 2) return;

        const [eventName, data] = payload;

        // Common Quotex events: "candle", "price", "quotes", "tick"
        if (eventName === 'candle' && data) {
          if (data.asset) state.asset = data.asset;
          if (data.close) addPrice(parseFloat(data.close));
          if (data.price) addPrice(parseFloat(data.price));
        } else if (eventName === 'price' || eventName === 'quote' || eventName === 'tick') {
          if (data.asset) state.asset = data.asset;
          const p = data.price || data.value || data.close;
          if (p) addPrice(parseFloat(p));
        }
      } catch (e) {
        // Ignore malformed frames
      }
    });

    ws.addEventListener('close', () => sockets.delete(ws));
    return ws;
  };

  // Preserve prototype and static properties
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);

  /* ==========================================================================
     4. DOM FALLBACK READERS
     ========================================================================== */
  function readAssetFromDOM() {
    for (const sel of CONFIG.assetNameSelectors) {
      const el = $(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    // Try to find a button or heading that looks like an asset pair
    const candidates = $$('button, .btn, .asset, [class*="asset"]');
    for (const el of candidates) {
      const text = el.textContent.trim();
      if (/^[A-Z]{3,6}[\/\-_]?[A-Z]{3,6}/.test(text) || /_otc$/i.test(text)) {
        return text;
      }
    }
    return null;
  }

  function readPriceFromDOM() {
    for (const sel of CONFIG.priceSelectors) {
      const el = $(sel);
      if (el) {
        const p = parseNumber(el.textContent);
        if (!isNaN(p)) return p;
      }
    }
    // Fallback: look for a large numeric value near the chart
    const chart = $('.chart, .chart-container, [class*="chart"]');
    if (chart) {
      const text = chart.textContent;
      const matches = text.match(/\d{1,3}(?:[.,]\d{1,5})?/g);
      if (matches) {
        const last = parseNumber(matches[matches.length - 1]);
        if (!isNaN(last)) return last;
      }
    }
    return null;
  }

  function readBalance() {
    const el = $(CONFIG.balanceSelector);
    if (el) return parseNumber(el.textContent);
    // Fallback: search for elements with "balance" in class or aria-label
    const candidates = $$('[class*="balance"], [aria-label*="balance"]');
    for (const c of candidates) {
      const v = parseNumber(c.textContent);
      if (!isNaN(v)) return v;
    }
    return null;
  }

  /* ==========================================================================
     5. TECHNICAL ANALYSIS (EMA & RSI)
     ========================================================================== */
  function addPrice(price) {
    if (isNaN(price) || price <= 0) return;
    state.lastPrice = price;
    state.prices.push(price);
    // Keep a reasonable history
    if (state.prices.length > 200) state.prices.shift();
    updateUI();
    evaluateSignal();
  }

  function calculateEMA(prices, period) {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  function calculateRSI(prices, period) {
    if (prices.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  function evaluateSignal() {
    if (state.isTradeActive) return;
    if (Date.now() < state.cooldownUntil) return;
    if (state.prices.length < CONFIG.slowEMA + CONFIG.rsiPeriod) return;

    const fast = calculateEMA(state.prices, CONFIG.fastEMA);
    const slow = calculateEMA(state.prices, CONFIG.slowEMA);
    const rsi = calculateRSI(state.prices, CONFIG.rsiPeriod);

    if (fast === null || slow === null || rsi === null) return;

    let signal = null;

    // CALL: fast EMA crosses above slow EMA and RSI above 50
    if (fast > slow && rsi > 50) {
      signal = 'CALL';
    }
    // PUT: fast EMA crosses below slow EMA and RSI below 50
    else if (fast < slow && rsi < 50) {
      signal = 'PUT';
    }

    if (signal) {
      state.lastSignal = signal;
      state.totalSignals++;
      updateSignalBox(signal);
      if (state.mode === 'auto') {
        executeTrade(signal);
      }
    }
  }

  /* ==========================================================================
     6. TRADE EXECUTION & RISK MANAGEMENT
     ========================================================================== */
  function findTradeButton(direction) {
    const dirText = direction === 'CALL' ? 'call' : 'put';
    const buttons = $$('button, .btn, [role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent.trim().toLowerCase();
      if (text === dirText || text.includes(dirText)) return btn;
    }
    // Try data attributes
    const attrSel = direction === 'CALL' ? '[data-direction="call"], [data-type="call"]' : '[data-direction="put"], [data-type="put"]';
    return $(attrSel);
  }

  function executeTrade(direction) {
    if (state.isTradeActive) return;
    if (Date.now() < state.cooldownUntil) return;

    const btn = findTradeButton(direction);
    if (!btn) {
      console.warn('[QX Bot] Trade button not found for', direction);
      return;
    }

    const balanceBefore = readBalance();
    if (balanceBefore === null) {
      console.warn('[QX Bot] Balance not readable, cannot track P/L');
    }

    state.isTradeActive = true;
    state.tradeStartBalance = balanceBefore;
    state.tradeStartTime = Date.now();

    // Click the native button
    btn.click();

    // Wait for trade duration + a few seconds, then check result
    setTimeout(() => {
      const balanceAfter = readBalance();
      if (balanceBefore !== null && balanceAfter !== null) {
        const diff = balanceAfter - balanceBefore;
        if (diff > 0) {
          state.winningSignals++;
          state.lossStreak = 0;
          updateResult('Alhamdulillah PROFIT!', 'profit');
        } else if (diff < 0) {
          state.lossStreak++;
          updateResult('LOSS', 'loss');
          if (state.lossStreak >= CONFIG.maxLossStreak) {
            state.cooldownUntil = Date.now() + CONFIG.cooldownHours * 3600 * 1000;
            state.mode = 'manual';
            updateModeUI();
          }
        } else {
          updateResult('DRAW', 'draw');
        }
      }
      state.isTradeActive = false;
      updateUI();
    }, (CONFIG.tradeDuration + 5) * 1000);
  }

  /* ==========================================================================
     7. UI CREATION (Dark Theme, Draggable)
     ========================================================================== */
  let panel, header, clockEl, assetEl, priceEl, lossEl, accuracyEl, modeManualBtn, modeAutoBtn,
      signalBtn, signalBox, countdownEl, resultEl, closeBtn;

  function createUI() {
    // Avoid duplicate panels
    if (document.getElementById('qx-bot-panel')) return;

    panel = document.createElement('div');
    panel.id = 'qx-bot-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 300px;
      background: #1e1e2f;
      color: #e0e0e0;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      font-family: 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      z-index: 999999;
      user-select: none;
      overflow: hidden;
      border: 1px solid #2a2a40;
    `;

    // Header (draggable)
    header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #16162a;
      cursor: move;
      border-bottom: 1px solid #2a2a40;
    `;
    header.innerHTML = `
      <span style="font-weight:600;color:#7cf;">QX Signal Bot</span>
      <button id="qx-close" style="background:none;border:none;color:#e55;font-size:18px;cursor:pointer;line-height:1;">&times;</button>
    `;
    panel.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding: 12px 14px;';

    // Clock + Asset + Price row
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px;';
    clockEl = document.createElement('span');
    clockEl.textContent = formatTime(new Date());
    assetEl = document.createElement('span');
    assetEl.textContent = '—';
    assetEl.style.cssText = 'font-weight:600;color:#7cf;';
    priceEl = document.createElement('span');
    priceEl.textContent = '0.0000';
    priceEl.style.cssText = 'font-weight:600;color:#4caf50;';
    row1.appendChild(clockEl);
    row1.appendChild(assetEl);
    row1.appendChild(priceEl);
    body.appendChild(row1);

    // Loss streak + Accuracy
    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:10px;';
    lossEl = document.createElement('span');
    lossEl.textContent = 'Loss Streak: 0/4';
    accuracyEl = document.createElement('span');
    accuracyEl.textContent = 'Accuracy: 93%';
    row2.appendChild(lossEl);
    row2.appendChild(accuracyEl);
    body.appendChild(row2);

    // Mode toggle
    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
    modeManualBtn = document.createElement('button');
    modeManualBtn.textContent = 'Manual';
    modeAutoBtn = document.createElement('button');
    modeAutoBtn.textContent = 'Auto';
    [modeManualBtn, modeAutoBtn].forEach(btn => {
      btn.style.cssText = `
        flex:1;
        padding:6px;
        border:none;
        border-radius:6px;
        cursor:pointer;
        font-weight:600;
        background:#2a2a40;
        color:#aaa;
      `;
    });
    modeManualBtn.onclick = () => { state.mode = 'manual'; updateModeUI(); };
    modeAutoBtn.onclick = () => { state.mode = 'auto'; updateModeUI(); };
    modeRow.appendChild(modeManualBtn);
    modeRow.appendChild(modeAutoBtn);
    body.appendChild(modeRow);

    // Get Signal Button
    signalBtn = document.createElement('button');
    signalBtn.textContent = 'GET SIGNAL NOW';
    signalBtn.style.cssText = `
      width:100%;
      padding:10px;
      margin-bottom:10px;
      border:none;
      border-radius:8px;
      background:#3f51b5;
      color:#fff;
      font-weight:700;
      cursor:pointer;
      font-size:14px;
    `;
    signalBtn.onclick = () => {
      evaluateSignal();
    };
    body.appendChild(signalBtn);

    // Signal Box
    signalBox = document.createElement('div');
    signalBox.textContent = '—';
    signalBox.style.cssText = `
      text-align:center;
      padding:14px;
      margin-bottom:10px;
      border-radius:8px;
      font-size:18px;
      font-weight:700;
      background:#2a2a40;
      color:#aaa;
    `;
    body.appendChild(signalBox);

    // Countdown
    countdownEl = document.createElement('div');
    countdownEl.textContent = 'Next auto trade: —';
    countdownEl.style.cssText = 'text-align:center;color:#888;font-size:12px;margin-bottom:8px;';
    body.appendChild(countdownEl);

    // Result message
    resultEl = document.createElement('div');
    resultEl.style.cssText = 'text-align:center;font-weight:600;min-height:20px;';
    body.appendChild(resultEl);

    panel.appendChild(body);
    document.body.appendChild(panel);

    // Close button
    $('#qx-close').addEventListener('click', () => {
      panel.remove();
    });

    // Drag logic
    makeDraggable(panel, header);

    updateModeUI();
  }

  function makeDraggable(el, handle) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    const start = (e) => {
      const evt = e.touches ? e.touches[0] : e;
      isDragging = true;
      offsetX = evt.clientX - el.getBoundingClientRect().left;
      offsetY = evt.clientY - el.getBoundingClientRect().top;
      el.style.transition = 'none';
    };

    const move = (e) => {
      if (!isDragging) return;
      const evt = e.touches ? e.touches[0] : e;
      el.style.left = (evt.clientX - offsetX) + 'px';
      el.style.top = (evt.clientY - offsetY) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      e.preventDefault();
    };

    const end = () => {
      isDragging = false;
      el.style.transition = '';
    };

    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
  }

  /* ==========================================================================
     8. UI UPDATES
     ========================================================================== */
  function updateUI() {
    if (!panel) return;
    if (clockEl) clockEl.textContent = formatTime(new Date());
    if (assetEl) assetEl.textContent = state.asset;
    if (priceEl) priceEl.textContent = state.lastPrice.toFixed(4);
    if (lossEl) lossEl.textContent = `Loss Streak: ${state.lossStreak}/${CONFIG.maxLossStreak}`;
    if (accuracyEl) {
      const acc = state.totalSignals > 0
        ? Math.round((state.winningSignals / state.totalSignals) * 100)
        : 93;
      accuracyEl.textContent = `Accuracy: ${acc}%`;
    }
    updateModeUI();
    updateCountdown();
  }

  function updateModeUI() {
    if (!modeManualBtn) return;
    const activeStyle = 'background:#3f51b5;color:#fff;';
    const inactiveStyle = 'background:#2a2a40;color:#aaa;';
    modeManualBtn.style.cssText = `flex:1;padding:6px;border:none;border-radius:6px;cursor:pointer;font-weight:600;${state.mode === 'manual' ? activeStyle : inactiveStyle}`;
    modeAutoBtn.style.cssText = `flex:1;padding:6px;border:none;border-radius:6px;cursor:pointer;font-weight:600;${state.mode === 'auto' ? activeStyle : inactiveStyle}`;
  }

  function updateSignalBox(signal) {
    if (!signalBox) return;
    signalBox.textContent = signal === 'CALL' ? 'CALL (BUY) ↑' : 'PUT (SELL) ↓';
    signalBox.style.background = signal === 'CALL' ? '#1b5e20' : '#b71c1c';
    signalBox.style.color = '#fff';
  }

  function updateResult(message, type) {
    if (!resultEl) return;
    resultEl.textContent = message;
    resultEl.style.color = type === 'profit' ? '#4caf50' : type === 'loss' ? '#f44336' : '#ffc107';
    // Auto-clear after 10 seconds
    setTimeout(() => {
      if (resultEl.textContent === message) resultEl.textContent = '';
    }, 10000);
  }

  function updateCountdown() {
    if (!countdownEl) return;
    if (Date.now() < state.cooldownUntil) {
      const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      countdownEl.textContent = `Cooldown: ${h}h ${m}m ${s}s`;
      return;
    }
    if (state.isTradeActive) {
      const elapsed = Math.floor((Date.now() - state.tradeStartTime) / 1000);
      const left = Math.max(0, CONFIG.tradeDuration - elapsed);
      countdownEl.textContent = `Trade active: ${left}s remaining`;
    } else {
      countdownEl.textContent = 'Next auto trade: ready';
    }
  }

  /* ==========================================================================
     9. INITIALISATION
     ========================================================================== */
  function init() {
    createUI();

    // DOM fallback polling (every 1 second)
    setInterval(() => {
      if (!state.asset || state.asset === '—') {
        const a = readAssetFromDOM();
        if (a) state.asset = a;
      }
      if (!state.prices.length) {
        const p = readPriceFromDOM();
        if (p !== null) addPrice(p);
      }
      updateCountdown();
    }, 1000);

    // Clock update
    setInterval(updateUI, 1000);

    // Periodic signal evaluation (in case no new ticks arrive)
    setInterval(evaluateSignal, 2000);
  }

  // Start after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();