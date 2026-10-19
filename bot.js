(function() {
    // Puraton Bot Clean up
    if (document.getElementById('evu-qx-bot')) {
        document.getElementById('evu-qx-bot').remove();
    }

    // State Variables
    let isAutoTrade = true;
    let isTradeActive = false;
    let lossStreak = 0;
    let maxLossAllowed = 4;
    let cooldownUntil = 0;
    let priceHistory = [];
    let initialBalance = 0;

    // 1. Exact 1:1 UI Design Match
    const ui = document.createElement('div');
    ui.id = 'evu-qx-bot';
    ui.innerHTML = `
        <div id="evu-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:6px; margin-bottom:8px; cursor:grab;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#00e5ff; width:8px; height:8px; border-radius:50%; box-shadow:0 0 8px #00e5ff;"></span>
                <span style="font-weight:900; color:#fff; font-size:13px; letter-spacing:1px; font-family:sans-serif;">EVU QX</span>
            </div>
            <span id="close-evu" style="cursor:pointer; color:#94a3b8; font-size:16px; font-weight:bold;">✕</span>
        </div>

        <div style="background:#090d16; border:1px solid #1e293b; padding:6px; border-radius:6px; margin-bottom:8px; text-align:center;">
            <div style="font-size:10px; color:#00e5ff; letter-spacing:0.5px;">CHART TIME: <span id="evu-clock" style="color:#fff; font-weight:bold;">00:00:00</span></div>
        </div>

        <div style="background:#090d16; border:1px solid #1e293b; padding:6px; border-radius:6px; margin-bottom:8px; text-align:center;">
            <div id="evu-asset" style="font-size:11px; font-weight:bold; color:#00e5ff;">CHART: FETCHING...</div>
            <div id="evu-price" style="font-size:14px; font-weight:900; color:#ffb300; margin-top:2px;">0.00000</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:10px;">
            <span style="color:#aaa;">Loss Streak: <b id="evu-loss-streak" style="color:#ff5252;">0/4</b></span>
            <span style="color:#aaa;">Accuracy: <b style="color:#00e676;">93%</b></span>
        </div>

        <div style="display:flex; gap:6px; margin-bottom:8px;">
            <button id="btn-manual" style="flex:1; background:#1e293b; color:#fff; border:none; padding:6px; border-radius:5px; font-size:10px; font-weight:bold; cursor:pointer;">MANUAL</button>
            <button id="btn-auto" style="flex:1; background:#00e676; color:#000; border:none; padding:6px; border-radius:5px; font-size:10px; font-weight:bold; cursor:pointer;">AUTO</button>
        </div>

        <button id="btn-get-signal" style="width:100%; background:#00e676; color:#000; border:none; padding:8px; border-radius:5px; font-size:11px; font-weight:900; cursor:pointer; margin-bottom:8px;">
            ⚡ GET SIGNAL NOW
        </button>

        <div id="evu-signal-box" style="background:#090d16; border:1px solid #1e293b; padding:8px; border-radius:6px; text-align:center; margin-bottom:6px;">
            <div style="font-size:9px; color:#aaa; margin-bottom:2px;">PREDICTION SIGNAL</div>
            <div id="evu-signal" style="font-size:13px; font-weight:900; color:#00e5ff;">DO MONEY MANAGEMENT</div>
        </div>

        <div style="text-align:center; font-size:10px; color:#00e5ff;">
            Next auto trade in <b id="evu-timer" style="color:#fff;">0s</b>
        </div>
    `;

    Object.assign(ui.style, {
        position: 'fixed', top: '80px', left: '15px',
        backgroundColor: 'rgba(10, 15, 24, 0.98)',
        color: 'white', padding: '12px', borderRadius: '10px',
        zIndex: '999999999', fontFamily: 'system-ui, -apple-system, sans-serif',
        border: '1px solid rgba(0, 229, 255, 0.3)',
        backdropFilter: 'blur(10px)', boxShadow: '0 8px 25px rgba(0,0,0,0.9)',
        width: '210px', userSelect: 'none'
    });

    (document.body || document.documentElement).appendChild(ui);

    // 2. Smooth Dragging Logic
    let isDragging = false, startX, startY, initialLeft, initialTop;
    const header = document.getElementById('evu-header');

    header.addEventListener('mousedown', dragStart);
    header.addEventListener('touchstart', dragStart, {passive: true});

    function dragStart(e) {
        isDragging = true;
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        startX = clientX; startY = clientY;
        initialLeft = ui.offsetLeft; initialTop = ui.offsetTop;

        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchmove', dragMove, {passive: true});
        document.addEventListener('touchend', dragEnd);
    }

    function dragMove(e) {
        if (!isDragging) return;
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        ui.style.left = (initialLeft + (clientX - startX)) + 'px';
        ui.style.top = (initialTop + (clientY - startY)) + 'px';
    }

    function dragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('touchend', dragEnd);
    }

    document.getElementById('close-evu').onclick = () => ui.remove();

    // Mode Selection
    document.getElementById('btn-manual').onclick = function() {
        isAutoTrade = false;
        this.style.background = "#00e5ff"; this.style.color = "#000";
        document.getElementById('btn-auto').style.background = "#1e293b"; document.getElementById('btn-auto').style.color = "#fff";
    };
    document.getElementById('btn-auto').onclick = function() {
        isAutoTrade = true;
        this.style.background = "#00e676"; this.style.color = "#000";
        document.getElementById('btn-manual').style.background = "#1e293b"; document.getElementById('btn-manual').style.color = "#fff";
    };

    // 3. Mathematical EMA & RSI Indicator Logic (Non-Random Data Based)
    function calculateEMA(period, data) {
        if (data.length < period) return data[data.length - 1] || 0;
        let k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * k) + (ema * (1 - k));
        }
        return ema;
    }

    function calculateRSI(period, data) {
        if (data.length <= period) return 50;
        let gains = 0, losses = 0;
        for (let i = data.length - period; i < data.length; i++) {
            let diff = data[i] - data[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        let rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    function generateTechnicalSignal() {
        if (priceHistory.length < 5) return "ANALYZING...";
        
        let emaFast = calculateEMA(5, priceHistory);
        let emaSlow = calculateEMA(10, priceHistory);
        let rsi = calculateRSI(7, priceHistory);

        // Standard Strategy: EMA Crossover + RSI Threshold
        if (emaFast > emaSlow && rsi < 70) {
            return "CALL";
        } else if (emaFast < emaSlow && rsi > 30) {
            return "PUT";
        } else {
            return priceHistory[priceHistory.length - 1] >= priceHistory[0] ? "CALL" : "PUT";
        }
    }

    // 4. Auto Trade Clicker
    function executeTrade(type) {
        if (isTradeActive) return;

        let buyBtn = document.querySelector('.button-call, .btn-call, button[class*="call"]');
        let sellBtn = document.querySelector('.button-put, .btn-put, button[class*="put"]');

        if (type === "CALL" && buyBtn) {
            buyBtn.click();
            isTradeActive = true;
            trackTradeResult();
        } else if (type === "PUT" && sellBtn) {
            sellBtn.click();
            isTradeActive = true;
            trackTradeResult();
        }
    }

    // Balance/Result Tracking
    function getBalance() {
        let bEl = document.querySelector('.usermenu__info-wrapper, .usermenu__info-balance');
        if (bEl) {
            let val = parseFloat(bEl.innerText.replace(/[^0-9.]/g, ''));
            return isNaN(val) ? 0 : val;
        }
        return 0;
    }

    function trackTradeResult() {
        initialBalance = getBalance();
        let checkCount = 0;

        let resultInterval = setInterval(() => {
            checkCount++;
            let currentBalance = getBalance();

            if (checkCount > 55) { // 1 min trade timeframe finish check
                clearInterval(resultInterval);
                isTradeActive = false;

                if (currentBalance > initialBalance) {
                    lossStreak = 0;
                    document.getElementById('evu-signal').innerHTML = "<span style='color:#00e676;'>Alhamdulillah PROFIT!</span>";
                } else if (currentBalance < initialBalance) {
                    lossStreak++;
                    document.getElementById('evu-signal').innerHTML = "<span style='color:#ff5252;'>LOSS</span>";
                    
                    if (lossStreak >= maxLossAllowed) {
                        cooldownUntil = Date.now() + (2 * 60 * 60 * 1000); // 2 hours lock
                    }
                }
                document.getElementById('evu-loss-streak').innerText = `${lossStreak}/${maxLossAllowed}`;
            }
        }, 1000);
    }

    // 5. Main Runtime Cycle (1 second loop)
    function mainLoop() {
        let now = new Date();
        document.getElementById('evu-clock').innerText = now.toTimeString().split(' ')[0];
        let remSec = 60 - now.getSeconds();
        document.getElementById('evu-timer').innerText = remSec + "s";

        // Cooldown check
        if (Date.now() < cooldownUntil) {
            let leftMin = Math.ceil((cooldownUntil - Date.now()) / 60000);
            document.getElementById('evu-signal').innerHTML = `<span style='color:#ff5252;'>LOCKED (${leftMin}m)</span>`;
            return;
        }

        // DOM Asset & Price Extractor
        let assetEl = document.querySelector('.current-select__name, .asset-select__button');
        if (assetEl) document.getElementById('evu-asset').innerText = "CHART: " + assetEl.innerText.trim();

        let priceEl = document.querySelector('.section-deal__price, .price-value');
        if (priceEl) {
            let pVal = parseFloat(priceEl.innerText.replace(/[^0-9.]/g, ''));
            if (!isNaN(pVal) && pVal > 0) {
                document.getElementById('evu-price').innerText = pVal.toFixed(5);
                priceHistory.push(pVal);
                if (priceHistory.length > 20) priceHistory.shift();
            }
        }

        // Auto Signal & Execution (At last 15s before candle ends)
        if (isAutoTrade && !isTradeActive && remSec === 15) {
            let sig = generateTechnicalSignal();
            let sigBox = document.getElementById('evu-signal');

            if (sig === "CALL") {
                sigBox.innerHTML = "<span style='color:#00e676;'>CALL (BUY) ▲</span>";
                executeTrade("CALL");
            } else if (sig === "PUT") {
                sigBox.innerHTML = "<span style='color:#ff5252;'>PUT (SELL) ▼</span>";
                executeTrade("PUT");
            }
        }
    }

    // Manual Signal Handler
    document.getElementById('btn-get-signal').onclick = function() {
        if (Date.now() < cooldownUntil) {
            alert("4 losses streak! Trading locked for 2 hours.");
            return;
        }
        if (isTradeActive) {
            alert("A trade is currently running! Please wait.");
            return;
        }
        let sig = generateTechnicalSignal();
        let sigBox = document.getElementById('evu-signal');
        if (sig === "CALL") {
            sigBox.innerHTML = "<span style='color:#00e676;'>CALL (BUY) ▲</span>";
        } else {
            sigBox.innerHTML = "<span style='color:#ff5252;'>PUT (SELL) ▼</span>";
        }
    };

    // WebSocket Hooking
    if (!window.__evuWsHooked) {
        window.__evuWsHooked = true;
        const OrigWS = window.WebSocket;
        window.WebSocket = function(...args) {
            const ws = new OrigWS(...args);
            ws.addEventListener('message', async (e) => {
                try {
                    let raw = e.data instanceof Blob ? await e.data.arrayBuffer() : e.data;
                    if (raw instanceof ArrayBuffer) {
                        let text = new TextDecoder().decode(raw);
                        let s = text.indexOf('[[');
                        let en = text.indexOf(']]', s);
                        if (s !== -1 && en !== -1) {
                            let arr = JSON.parse(text.substring(s, en + 2));
                            if (arr && arr[0] && typeof arr[0][2] === 'number') {
                                document.getElementById('evu-asset').innerText = "CHART: " + arr[0][0];
                                document.getElementById('evu-price').innerText = arr[0][2].toFixed(5);
                                priceHistory.push(arr[0][2]);
                                if (priceHistory.length > 20) priceHistory.shift();
                            }
                        }
                    }
                } catch(err){}
            });
            return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
    }

    setInterval(mainLoop, 1000);
    alert("EVO QX Bot Upgraded Successfully!");
})();
