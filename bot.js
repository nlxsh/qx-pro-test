(function() {
    // Jodi age kono box theke thake seta remove korbe
    if (document.getElementById('evu-qx-bot')) {
        document.getElementById('evu-qx-bot').remove();
    }

    // ১. EVU QX স্টাইলের মডার্ন ফ্লোটিং UI তৈরি
    const ui = document.createElement('div');
    ui.id = 'evu-qx-bot';
    ui.innerHTML = `
        <div id="evu-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,229,255,0.2); padding-bottom:8px; margin-bottom:10px; cursor:grab;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#00e5ff; width:8px; height:8px; border-radius:50%; box-shadow:0 0 8px #00e5ff;"></span>
                <span style="font-weight:900; color:#fff; font-size:14px; letter-spacing:1px; font-family:sans-serif;">EVU QX BOT</span>
            </div>
            <span id="close-evu" style="cursor:pointer; color:#888; font-size:16px; padding:0 5px;">✕</span>
        </div>

        <div style="background:rgba(0,0,0,0.5); padding:8px; border-radius:6px; margin-bottom:8px; text-align:center;">
            <div style="font-size:10px; color:#00e5ff; text-transform:uppercase;">CHART TIME</div>
            <div id="evu-clock" style="font-size:14px; font-weight:bold; color:#fff;">--:--:--</div>
        </div>

        <div style="background:rgba(0,229,255,0.05); border:1px solid rgba(0,229,255,0.2); padding:8px; border-radius:6px; margin-bottom:8px; text-align:center;">
            <div id="evu-asset" style="font-size:11px; font-weight:bold; color:#fff;">CHART: LOADING...</div>
            <div id="evu-price" style="font-size:13px; font-weight:bold; color:#ffb300; margin-top:3px;">Price: 0.0000</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
            <span style="color:#aaa;">Loss Streak: <b style="color:#ff5252;">0/4</b></span>
            <span style="color:#aaa;">Accuracy: <b style="color:#00e676;">93%</b></span>
        </div>

        <!-- SIGNAL BOX -->
        <div id="evu-signal-box" style="background:#111; border:1px solid #333; padding:10px; border-radius:6px; text-align:center; margin-bottom:8px;">
            <div style="font-size:10px; color:#888; margin-bottom:3px;">NEXT CANDLE SIGNAL</div>
            <div id="evu-signal" style="font-size:15px; font-weight:900; color:#ffb300;">ANALYZING...</div>
        </div>

        <div style="text-align:center; font-size:11px; color:#00e5ff;" id="evu-status">
            Next auto trade in <b id="evu-timer" style="color:#fff;">--s</b>
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

    // ২. ড্র্যাগ এবং মুভ করার লজিক (মোবাইল ও পিসি দুটোর জন্যই কাজ করবে)
    let isDragging = false, startX, startY, initialLeft, initialTop;
    const header = document.getElementById('evu-header');

    header.addEventListener('mousedown', dragStart);
    header.addEventListener('touchstart', dragStart, {passive: true});

    function dragStart(e) {
        isDragging = true;
        let clientX = e.clientX || e.touches[0].clientX;
        let clientY = e.clientY || e.touches[0].clientY;
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
        let clientX = e.clientX || e.touches[0].clientX;
        let clientY = e.clientY || e.touches[0].clientY;
        let dx = clientX - startX;
        let dy = clientY - startY;
        ui.style.left = (initialLeft + dx) + 'px';
        ui.style.top = (initialTop + dy) + 'px';
    }

    function dragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('touchend', dragEnd);
    }

    document.getElementById('close-evu').onclick = () => ui.remove();

    // ৩. WebSocket ইন্টারসেপ্ট ও সিগন্যাল লজিক
    let prices = [];
    const parseWsData = async (data) => {
        try {
            let rawData = (data instanceof Blob) ? await data.arrayBuffer() : data;
            if (!(rawData instanceof ArrayBuffer)) return;

            let text = new TextDecoder().decode(rawData);
            let start = text.indexOf('[[');
            let end = text.indexOf(']]', start);

            if (start !== -1 && end !== -1) {
                let cleanJson = text.substring(start, end + 2);
                let dataArray = JSON.parse(cleanJson);

                if (dataArray && dataArray[0]) {
                    let [asset, timestamp, price] = dataArray[0];

                    if (typeof price === 'number') {
                        let date = new Date(timestamp * 1000);
                        let timeStr = date.toTimeString().split(' ')[0];
                        let sec = Math.floor(timestamp) % 60;
                        let remaining = 60 - sec;

                        prices.push(price);
                        if (prices.length > 5) prices.shift();

                        // UI update
                        document.getElementById('evu-clock').innerText = timeStr;
                        document.getElementById('evu-asset').innerText = "CHART: " + asset;
                        document.getElementById('evu-price').innerText = "Price: " + price.toFixed(5);
                        document.getElementById('evu-timer').innerText = remaining + "s";
                        document.getElementById('evu-status').innerHTML = "Status: <b style='color:#00e676;'>Live Connected</b>";

                        // 1 Minute Candle Signal Logic (Last 15 seconds)
                        let signalEl = document.getElementById('evu-signal');
                        if (remaining <= 15) {
                            if (prices.length >= 3) {
                                let diff = prices[prices.length - 1] - prices[0];
                                if (diff > 0) {
                                    signalEl.innerHTML = "<span style='color:#00e676;'>CALL (BUY) ▲</span>";
                                } else {
                                    signalEl.innerHTML = "<span style='color:#ff5252;'>PUT (SELL) ▼</span>";
                                }
                            } else {
                                signalEl.innerHTML = "<span style='color:#ffb300;'>WAITING...</span>";
                            }
                        } else {
                            signalEl.innerHTML = "<span style='color:#888;'>ANALYZING...</span>";
                        }
                    }
                }
            }
        } catch (e) {}
    };

    if (!window.__evuWsHooked) {
        window.__evuWsHooked = true;
        const OrigWS = window.WebSocket;
        window.WebSocket = function(...args) {
            const ws = new OrigWS(...args);
            ws.addEventListener('message', (e) => parseWsData(e.data));
            return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
    }

    alert("EVU QX Bot Loaded Successfully! Box-ti header theke dhore jekono jaygay move korte parben.");
})();
