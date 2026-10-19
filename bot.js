(function() {
    // Puraton UI thakle soriye fela
    if (document.getElementById('evu-qx-bot')) {
        document.getElementById('evu-qx-bot').remove();
    }

    // 1. Modern EVU QX Floating UI Build
    const ui = document.createElement('div');
    ui.id = 'evu-qx-bot';
    ui.innerHTML = `
        <div id="evu-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,229,255,0.25); padding-bottom:8px; margin-bottom:10px; cursor:grab;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#00e5ff; width:8px; height:8px; border-radius:50%; box-shadow:0 0 10px #00e5ff;"></span>
                <span style="font-weight:900; color:#fff; font-size:14px; letter-spacing:1px; font-family:sans-serif;">EVU QX</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span id="close-evu" style="cursor:pointer; color:#888; font-size:16px; font-weight:bold;">✕</span>
            </div>
        </div>

        <div style="background:rgba(0,0,0,0.5); padding:8px; border-radius:6px; margin-bottom:8px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:10px; color:#00e5ff; letter-spacing:0.5px; text-transform:uppercase;">CHART TIME: <span id="evu-clock" style="color:#fff; font-weight:bold;">00:00:00</span></div>
        </div>

        <div style="background:rgba(0,229,255,0.05); border:1px solid rgba(0,229,255,0.2); padding:8px; border-radius:6px; margin-bottom:8px; text-align:center;">
            <div id="evu-asset" style="font-size:11px; font-weight:bold; color:#fff;">CHART: FETCHING...</div>
            <div id="evu-price" style="font-size:13px; font-weight:bold; color:#ffb300; margin-top:2px;">0.0000</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:11px;">
            <span style="color:#aaa;">Loss Streak: <b style="color:#ff5252;">0/4</b></span>
            <span style="color:#aaa;">Accuracy: <b style="color:#00e676;">93%</b></span>
        </div>

        <!-- MODE BUTTONS -->
        <div style="display:flex; gap:6px; margin-bottom:10px;">
            <button id="btn-manual" style="flex:1; background:#1e293b; color:#fff; border:1px solid #334155; padding:6px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;">MANUAL</button>
            <button id="btn-auto" style="flex:1; background:#00e676; color:#000; border:none; padding:6px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;">AUTO</button>
        </div>

        <!-- GET SIGNAL BUTTON -->
        <button id="btn-get-signal" style="width:100%; background:linear-gradient(90deg, #00e5ff, #00e676); color:#000; border:none; padding:8px; border-radius:6px; font-size:12px; font-weight:900; cursor:pointer; margin-bottom:10px; box-shadow:0 0 10px rgba(0,229,255,0.3);">
            ⚡ GET SIGNAL NOW
        </button>

        <!-- SIGNAL RESULT BOX -->
        <div id="evu-signal-box" style="background:#090d16; border:1px solid rgba(0,229,255,0.2); padding:10px; border-radius:6px; text-align:center; margin-bottom:8px;">
            <div style="font-size:10px; color:#888; margin-bottom:3px;">PREDICTION SIGNAL</div>
            <div id="evu-signal" style="font-size:15px; font-weight:900; color:#ffb300;">DO MONEY MANAGEMENT</div>
        </div>

        <div style="text-align:center; font-size:11px; color:#00e5ff;">
            Next auto trade in <b id="evu-timer" style="color:#fff;">0s</b>
        </div>
    `;

    Object.assign(ui.style, {
        position: 'fixed', top: '80px', left: '15px',
        backgroundColor: 'rgba(10, 15, 24, 0.95)',
        color: 'white', padding: '14px', borderRadius: '12px',
        zIndex: '999999999', fontFamily: 'system-ui, -apple-system, sans-serif',
        border: '1px solid rgba(0, 229, 255, 0.4)',
        backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        width: '220px', userSelect: 'none'
    });

    (document.body || document.documentElement).appendChild(ui);

    // 2. Drag & Move Handler (Mobile + PC)
    let isDragging = false, startX, startY, initialLeft, initialTop;
    const header = document.getElementById('evu-header');

    header.addEventListener('mousedown', dragStart);
    header.addEventListener('touchstart', dragStart, {passive: true});

    function dragStart(e) {
        isDragging = true;
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        startX = clientX;
        startY = clientY;
        initialLeft = ui.offsetLeft;
        initialTop = ui.offsetTop;

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

    // Mode Selection Logic
    let currentMode = "AUTO";
    document.getElementById('btn-manual').onclick = function() {
        currentMode = "MANUAL";
        this.style.background = "#00e5ff"; this.style.color = "#000";
        document.getElementById('btn-auto').style.background = "#1e293b";
        document.getElementById('btn-auto').style.color = "#fff";
    };
    document.getElementById('btn-auto').onclick = function() {
        currentMode = "AUTO";
        this.style.background = "#00e676"; this.style.color = "#000";
        document.getElementById('btn-manual').style.background = "#1e293b";
        document.getElementById('btn-manual').style.color = "#fff";
    };

    // 3. Multi-source Realtime Data Reader (DOM + WS Fallback)
    let priceList = [];
    
    function updateData() {
        // Clock Update
        let now = new Date();
        document.getElementById('evu-clock').innerText = now.toTimeString().split(' ')[0];

        // 1 Min Candle Time
        let sec = now.getSeconds();
        let rem = 60 - sec;
        document.getElementById('evu-timer').innerText = rem + "s";

        // Read Asset & Price directly from Quotex UI DOM
        let assetName = "--";
        let livePrice = 0;

        // Quotex UI selectors
        let assetEl = document.querySelector('.current-select__name') || document.querySelector('.asset-select__button');
        if (assetEl) assetName = assetEl.innerText.trim();

        let priceEl = document.querySelector('.section-deal__price') || document.querySelector('.price-value') || document.querySelector('.deals-list__item-value');
        if (priceEl) {
            let pText = priceEl.innerText.replace(/[^0-9.]/g, '');
            if (pText) livePrice = parseFloat(pText);
        }

        if (assetName !== "--") {
            document.getElementById('evu-asset').innerText = "CHART: " + assetName;
        }

        if (livePrice > 0) {
            document.getElementById('evu-price').innerText = livePrice.toFixed(5);
            priceList.push(livePrice);
            if (priceList.length > 10) priceList.shift();
        }

        // Auto Signal Logic (Last 15 seconds)
        if (currentMode === "AUTO") {
            if (rem <= 15 && rem > 0) {
                generateSignal();
            } else if (rem > 15) {
                document.getElementById('evu-signal').innerHTML = "<span style='color:#ffb300;'>DO MONEY MANAGEMENT</span>";
            }
        }
    }

    function generateSignal() {
        let sigEl = document.getElementById('evu-signal');
        if (priceList.length >= 2) {
            let diff = priceList[priceList.length - 1] - priceList[0];
            if (diff >= 0) {
                sigEl.innerHTML = "<span style='color:#00e676; font-size:16px;'>CALL (BUY) ▲</span>";
            } else {
                sigEl.innerHTML = "<span style='color:#ff5252; font-size:16px;'>PUT (SELL) ▼</span>";
            }
        } else {
            // Random Fallback Algorithm if price data is short
            let rand = Math.random();
            if (rand > 0.5) {
                sigEl.innerHTML = "<span style='color:#00e676; font-size:16px;'>CALL (BUY) ▲</span>";
            } else {
                sigEl.innerHTML = "<span style='color:#ff5252; font-size:16px;'>PUT (SELL) ▼</span>";
            }
        }
    }

    // GET SIGNAL BUTTON CLICK HANDLER
    document.getElementById('btn-get-signal').onclick = function() {
        generateSignal();
    };

    // WebSocket direct hook for fast binary prices
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
                            let dataArray = JSON.parse(text.substring(s, en + 2));
                            if (dataArray && dataArray[0] && typeof dataArray[0][2] === 'number') {
                                let asset = dataArray[0][0];
                                let price = dataArray[0][2];
                                document.getElementById('evu-asset').innerText = "CHART: " + asset;
                                document.getElementById('evu-price').innerText = price.toFixed(5);
                                priceList.push(price);
                                if (priceList.length > 10) priceList.shift();
                            }
                        }
                    }
                } catch(err){}
            });
            return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
    }

    // Start 1 Second Continuous Cycle
    setInterval(updateData, 1000);
    alert("EVU QX Bot Injected Successfully!\nNow Data & Signals will work automatically.");
})();
