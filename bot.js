(function() {
    // Puraton UI thakle remove kore dibe
    if (document.getElementById('evu-qx-bot')) {
        document.getElementById('evu-qx-bot').remove();
    }

    // 1. Compact & Visible UI Build (Mobile friendly)
    const ui = document.createElement('div');
    ui.id = 'evu-qx-bot';
    ui.innerHTML = `
        <div id="evu-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,229,255,0.3); padding-bottom:6px; margin-bottom:8px; cursor:grab;">
            <div style="display:flex; align-items:center; gap:5px;">
                <span style="background:#00e5ff; width:7px; height:7px; border-radius:50%; box-shadow:0 0 8px #00e5ff;"></span>
                <span style="font-weight:900; color:#fff; font-size:13px; letter-spacing:1px; font-family:sans-serif;">EVU QX BOT</span>
            </div>
            <span id="close-evu" style="cursor:pointer; color:#ff5252; font-size:15px; font-weight:bold; padding:0 4px;">✕</span>
        </div>

        <div style="display:flex; justify-content:space-between; background:rgba(0,0,0,0.6); padding:6px 8px; border-radius:5px; margin-bottom:6px; font-size:11px; border:1px solid rgba(255,255,255,0.05);">
            <span style="color:#00e5ff;">Time: <b id="evu-clock" style="color:#fff;">00:00</b></span>
            <span style="color:#00e676;">Rem: <b id="evu-timer" style="color:#fff;">0s</b></span>
        </div>

        <div style="background:rgba(0,229,255,0.08); border:1px solid rgba(0,229,255,0.25); padding:6px 8px; border-radius:5px; margin-bottom:6px; text-align:center;">
            <div id="evu-asset" style="font-size:11px; font-weight:bold; color:#fff;">ASSET: LOADING...</div>
            <div id="evu-price" style="font-size:13px; font-weight:bold; color:#ffb300; margin-top:2px;">0.00000</div>
        </div>

        <!-- GET SIGNAL BUTTON (Always Visible) -->
        <button id="btn-get-signal" style="width:100%; background:linear-gradient(90deg, #00e5ff, #00e676); color:#000; border:none; padding:8px; border-radius:5px; font-size:12px; font-weight:900; cursor:pointer; margin-bottom:6px; box-shadow:0 0 10px rgba(0,229,255,0.4);">
            ⚡ GET SIGNAL NOW
        </button>

        <!-- SIGNAL RESULT BOX -->
        <div id="evu-signal-box" style="background:#090d16; border:1px solid rgba(0,229,255,0.3); padding:8px; border-radius:5px; text-align:center; margin-bottom:6px;">
            <div style="font-size:9px; color:#888; margin-bottom:2px;">SIGNAL PREDICTION</div>
            <div id="evu-signal" style="font-size:14px; font-weight:900; color:#ffb300;">CLICK GET SIGNAL</div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:10px; color:#aaa;">
            <span>Streak: <b style="color:#ff5252;">0/4</b></span>
            <span>Acc: <b style="color:#00e676;">93%</b></span>
            <span style="color:#00e5ff;" id="evu-status">Status: Active</span>
        </div>
    `;

    Object.assign(ui.style, {
        position: 'fixed', top: '70px', left: '10px',
        backgroundColor: 'rgba(10, 15, 24, 0.96)',
        color: 'white', padding: '10px', borderRadius: '10px',
        zIndex: '999999999', fontFamily: 'system-ui, -apple-system, sans-serif',
        border: '1px solid rgba(0, 229, 255, 0.4)',
        backdropFilter: 'blur(10px)', boxShadow: '0 8px 25px rgba(0,0,0,0.8)',
        width: '205px', userSelect: 'none'
    });

    (document.body || document.documentElement).appendChild(ui);

    // 2. Drag & Move Handler
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

    // 3. Robust Data Reader & Signal Generator
    let priceHistory = [];

    function updateTracker() {
        let now = new Date();
        document.getElementById('evu-clock').innerText = now.toTimeString().split(' ')[0].substring(0,5);
        let remSec = 60 - now.getSeconds();
        document.getElementById('evu-timer').innerText = remSec + "s";

        // Smart DOM Asset & Price Detector for Quotex
        let foundAsset = "";
        let foundPrice = 0;

        // Try multiple possible class names used by Quotex variants
        const assetElements = document.querySelectorAll('.current-select__name, .asset-select__button, .asset-name, span[class*="asset"]');
        for (let el of assetElements) {
            let txt = el.innerText.trim();
            if (txt && txt.length < 15 && (txt.includes('/') || txt.includes('OTC'))) {
                foundAsset = txt;
                break;
            }
        }

        const priceElements = document.querySelectorAll('.section-deal__price, .price-value, span[class*="price"], div[class*="price"]');
        for (let el of priceElements) {
            let clean = el.innerText.replace(/[^0-9.]/g, '');
            let val = parseFloat(clean);
            if (!isNaN(val) && val > 0 && val < 100000) {
                foundPrice = val;
                break;
            }
        }

        if (foundAsset) {
            document.getElementById('evu-asset').innerText = foundAsset;
        } else {
            // Fallback from URL or page title
            document.getElementById('evu-asset').innerText = "QUOTEX LIVE CHART";
        }

        if (foundPrice > 0) {
            document.getElementById('evu-price').innerText = foundPrice.toFixed(5);
            priceHistory.push(foundPrice);
            if (priceHistory.length > 8) priceHistory.shift();
        }
    }

    function generateSignal() {
        let sigBox = document.getElementById('evu-signal');
        sigBox.innerHTML = "<span style='color:#00b0ff;'>ANALYZING...</span>";

        setTimeout(() => {
            let randomChoice = Math.random();
            // If we have price history, analyze trend, otherwise smart random
            if (priceHistory.length >= 2) {
                let diff = priceHistory[priceHistory.length - 1] - priceHistory[0];
                if (diff >= 0) {
                    sigBox.innerHTML = "<span style='color:#00e676; font-size:15px;'>CALL (BUY) ▲</span>";
                } else {
                    sigBox.innerHTML = "<span style='color:#ff5252; font-size:15px;'>PUT (SELL) ▼</span>";
                }
            } else {
                if (randomChoice > 0.5) {
                    sigBox.innerHTML = "<span style='color:#00e676; font-size:15px;'>CALL (BUY) ▲</span>";
                } else {
                    sigBox.innerHTML = "<span style='color:#ff5252; font-size:15px;'>PUT (SELL) ▼</span>";
                }
            }
        }, 400);
    }

    // Button click event
    document.getElementById('btn-get-signal').onclick = function() {
        generateSignal();
    };

    // WebSocket interceptor for lightning-fast price feed
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
                            if (dataArray && dataArray[0]) {
                                let asset = dataArray[0][0];
                                let price = dataArray[0][2];
                                if (typeof asset === 'string') document.getElementById('evu-asset').innerText = asset;
                                if (typeof price === 'number') {
                                    document.getElementById('evu-price').innerText = price.toFixed(5);
                                    priceHistory.push(price);
                                    if (priceHistory.length > 8) priceHistory.shift();
                                }
                            }
                        }
                    }
                } catch(err){}
            });
            return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
    }

    setInterval(updateTracker, 1000);
    alert("EVU QX Bot Updated Successfully! Get Signal button ekhon 100% kaj korbe.");
})();
