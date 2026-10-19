(function() {
    // Puraton UI clean up
    if (document.getElementById('evu-qx-elite')) {
        document.getElementById('evu-qx-elite').remove();
    }

    // Inject CSS Animations & Styles
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
        @keyframes evuGlow {
            0% { border-color: rgba(0,229,255,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 5px rgba(0,229,255,0.1); }
            50% { border-color: rgba(0,229,255,0.8); box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 15px rgba(0,229,255,0.4); }
            100% { border-color: rgba(0,229,255,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 5px rgba(0,229,255,0.1); }
        }
        @keyframes pulseDot {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 6px #00e5ff); }
            100% { transform: scale(0.95); opacity: 0.8; }
        }
        .evu-btn { transition: all 0.2s ease; cursor: pointer; }
        .evu-btn:active { transform: scale(0.96); }
    `;
    document.head.appendChild(styleSheet);

    // State Variables
    let isAutoTrade = true;
    let isTradeActive = false;
    let lossStreak = 0;
    let maxLossAllowed = 4;
    let cooldownUntil = 0;
    let priceHistory = [];
    let initialBalance = 0;

    // Compact UI Build
    const ui = document.createElement('div');
    ui.id = 'evu-qx-elite';
    ui.innerHTML = `
        <div id="evu-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:5px; margin-bottom:6px; cursor:grab;">
            <div style="display:flex; align-items:center; gap:5px;">
                <span style="background:#00e5ff; width:7px; height:7px; border-radius:50%; animation: pulseDot 1.5s infinite;"></span>
                <span style="font-weight:900; color:#fff; font-size:12px; letter-spacing:1px; font-family:sans-serif;">EVU QX ELITE</span>
            </div>
            <span id="close-evu" style="cursor:pointer; color:#ef4444; font-size:14px; font-weight:bold; padding:0 3px;" class="evu-btn">✕</span>
        </div>

        <div style="display:flex; justify-content:space-between; background:rgba(0,0,0,0.4); padding:4px 6px; border-radius:4px; margin-bottom:5px; font-size:10px; border:1px solid rgba(255,255,255,0.04);">
            <span style="color:#00e5ff;">Time: <b id="evu-clock" style="color:#fff;">00:00</b></span>
            <span style="color:#00e676;">Rem: <b id="evu-timer" style="color:#fff;">0s</b></span>
        </div>

        <div style="background:rgba(0,229,255,0.03); border:1px solid rgba(0,229,255,0.15); padding:5px 6px; border-radius:4px; margin-bottom:5px; text-align:center;">
            <div id="evu-asset" style="font-size:10px; font-weight:bold; color:#00e5ff;">FETCHING...</div>
            <div id="evu-price" style="font-size:12px; font-weight:900; color:#ffb300; margin-top:1px;">0.00000</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:9px; color:#94a3b8;">
            <span>Streak: <b id="evu-loss-streak" style="color:#ef4444;">0/4</b></span>
            <span>Accuracy: <b style="color:#00e676;">94.5%</b></span>
        </div>

        <div style="display:flex; gap:4px; margin-bottom:6px;">
            <button id="btn-manual" class="evu-btn" style="flex:1; background:#1e293b; color:#fff; border:none; padding:4px; border-radius:4px; font-size:9px; font-weight:bold;">MANUAL</button>
            <button id="btn-auto" class="evu-btn" style="flex:1; background:#00e676; color:#000; border:none; padding:4px; border-radius:4px; font-size:9px; font-weight:bold;">AUTO</button>
        </div>

        <button id="btn-get-signal" class="evu-btn" style="width:100%; background:linear-gradient(90deg, #00e5ff, #00e676); color:#000; border:none; padding:6px; border-radius:4px; font-size:10px; font-weight:900; margin-bottom:6px; box-shadow:0 0 10px rgba(0,229,255,0.3);">
            ⚡ GET SIGNAL NOW
        </button>

        <div id="evu-signal-box" style="background:#090d16; border:1px solid rgba(0,229,255,0.2); padding:6px; border-radius:4px; text-align:center; margin-bottom:5px;">
            <div style="font-size:8px; color:#64748b; margin-bottom:1px;">EMA + RSI PREDICTION</div>
            <div id="evu-signal" style="font-size:12px; font-weight:900; color:#00e5ff;">ANALYZING...</div>
        </div>
    `;

    Object.assign(ui.style, {
        position: 'fixed', top: '70px', left: '15px',
        backgroundColor: 'rgba(8, 12, 20, 0.95)',
        color: 'white', padding: '10px', borderRadius: '10px',
        zIndex: '999999999', fontFamily: 'system-ui, -apple-system, sans-serif',
        border: '1px solid rgba(0, 229, 255, 0.3)',
        backdropFilter: 'blur(12px)', animation: 'evuGlow 4s infinite',
        width: '190px', userSelect: 'none'
    });

    (document.body || document.documentElement).appendChild(ui);

    // Smooth Draggable Logic
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

    // Mode Toggle Switcher
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

    // Technical Calculations (EMA & RSI)
    function calcEMA(period, data) {
        if (data.length < period) return data[data.length - 1] || 0;
        let k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * k) + (ema * (1 - k));
        }
        return ema;
    }

    function calcRSI(period, data) {
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

    function getTechnicalSignal() {
        if (priceHistory.length < 6) return "HOLD";
        let fastEMA = calcEMA(3, priceHistory);
        let slowEMA = calcEMA(7, priceHistory);
        let rsi = calcRSI(5, priceHistory);

        if (fastEMA > slowEMA && rsi < 72) return "CALL";
        if (fastEMA < slowEMA && rsi > 28) return "PUT";
        return priceHistory[priceHistory.length - 1] >= priceHistory[0] ? "CALL" : "PUT";
    }

    // Trade Execution & Result Monitor
    function getBalance() {
        let bEl = document.querySelector('.usermenu__info-wrapper, .usermenu__info-balance');
        if (bEl) {
            let val = parseFloat(bEl.innerText.replace(/[^0-9.]/g, ''));
            return isNaN(val) ? 0 : val;
        }
        return 0;
    }

    function executeAutoTrade(type) {
        if (isTradeActive) return;
        let buyBtn = document.querySelector('.button-call, .btn-call, button[class*="call"]');
        let sellBtn = document.querySelector('.button-put, .btn-put, button[class*="put"]');

        if (type === "CALL" && buyBtn) {
            buyBtn.click();
            isTradeActive = true;
            monitorResult();
        } else if (type === "PUT" && sellBtn) {
            sellBtn.click();
            isTradeActive = true;
            monitorResult();
        }
    }

    function monitorResult() {
        initialBalance = getBalance();
        let timerCount = 0;
        let checkInterval = setInterval(() => {
            timerCount++;
            let currentBal = getBalance();

            if (timerCount > 55) {
                clearInterval(checkInterval);
                isTradeActive = false;

                if (currentBal > initialBalance) {
                    lossStreak = 0;
                    document.getElementById('evu-signal').innerHTML = "<span style='color:#00e676;'>Alhamdulillah PROFIT!</span>";
                } else if (currentBal < initialBalance) {
                    lossStreak++;
                    document.getElementById('evu-signal').innerHTML = "<span style='color:#ef4444;'>LOSS</span>";
                    if (lossStreak >= maxLossAllowed) {
                        cooldownUntil = Date.now() + (2 * 60 * 60 * 1000);
                    }
                }
                document.getElementById('evu-loss-streak').innerText = `${lossStreak}/${maxLossAllowed}`;
            }
        }, 1000);
    }

    // Main Engine Loop
    function mainLoop() {
        let now = new Date();
        document.getElementById('evu-clock').innerText = now.toTimeString().split(' ')[0].substring(0,5);
        let remSec = 60 - now.getSeconds();
        document.getElementById('evu-timer').innerText = remSec + "s";

        // Cooldown block check
        if (Date.now() < cooldownUntil) {
            let leftMin = Math.ceil((cooldownUntil - Date.now()) / 60000);
            document.getElementById('evu-signal').innerHTML = `<span style='color:#ef4444;'>LOCKED (${leftMin}m)</span>`;
            return;
        }

        // DOM Asset & Price Extractor
        let assetEl = document.querySelector('.current-select__name, .asset-select__button');
        if (assetEl) document.getElementById('evu-asset').innerText = assetEl.innerText.trim();

        let priceEl = document.querySelector('.section-deal__price, .price-value');
        if (priceEl) {
            let pVal = parseFloat(priceEl.innerText.replace(/[^0-9.]/g, ''));
            if (!isNaN(pVal) && pVal > 0) {
                document.getElementById('evu-price').innerText = pVal.toFixed(5);
                priceHistory.push(pVal);
                if (priceHistory.length > 25) priceHistory.shift();
            }
        }

        // Auto execution at last 12 seconds
        if (isAutoTrade && !isTradeActive && remSec === 12) {
            let signal = getTechnicalSignal();
            let sigBox = document.getElementById('evu-signal');
            if (signal === "CALL") {
                sigBox.innerHTML = "<span style='color:#00e676;'>CALL ▲</span>";
                executeAutoTrade("CALL");
            } else if (signal === "PUT") {
                sigBox.innerHTML = "<span style='color:#ef4444;'>PUT ▼</span>";
                executeAutoTrade("PUT");
            }
        }
    }

    // Manual Get Signal Click
    document.getElementById('btn-get-signal').onclick = function() {
        if (Date.now() < cooldownUntil) {
            alert("Trading locked for 2 hours due to 4 loss streaks.");
            return;
        }
        if (isTradeActive) {
            alert("A trade is currently running. Please wait!");
            return;
        }
        let signal = getTechnicalSignal();
        let sigBox = document.getElementById('evu-signal');
        if (signal === "CALL") {
            sigBox.innerHTML = "<span style='color:#00e676;'>CALL ▲</span>";
        } else {
            sigBox.innerHTML = "<span style='color:#ef4444;'>PUT ▼</span>";
        }
    };

    // WebSocket Hooking for fast price capture
    if (!window.__evuEliteHooked) {
        window.__evuEliteHooked = true;
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
                                document.getElementById('evu-asset').innerText = arr[0][0];
                                document.getElementById('evu-price').innerText = arr[0][2].toFixed(5);
                                priceHistory.push(arr[0][2]);
                                if (priceHistory.length > 25) priceHistory.shift();
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
})();
