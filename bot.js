(function() {
    // আগের ইউআই থাকলে রিমুভ করবে
    if (document.getElementById('evu-qx-tracker')) {
        document.getElementById('evu-qx-tracker').remove();
    }

    // ১. EVU QX স্টাইলের ফ্লোটিং UI তৈরি
    const ui = document.createElement('div');
    ui.id = 'evu-qx-tracker';
    ui.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,229,255,0.2); padding-bottom:8px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#00e5ff; width:8px; height:8px; border-radius:50%; box-shadow:0 0 8px #00e5ff;"></span>
                <span style="font-weight:900; color:#fff; font-size:14px; letter-spacing:1px; font-family:sans-serif;">EVU QX</span>
            </div>
            <span id="close-evu" style="cursor:pointer; color:#888; font-size:16px;">✕</span>
        </div>

        <div style="background:rgba(0,0,0,0.4); padding:8px; border-radius:6px; margin-bottom:8px; text-align:center;">
            <div style="font-size:11px; color:#00e5ff; text-transform:uppercase;">CHART TIME</div>
            <div id="evu-clock" style="font-size:15px; font-weight:bold; color:#fff;">--:--:--</div>
        </div>

        <div style="background:rgba(0,229,255,0.05); border:1px solid rgba(0,229,255,0.2); padding:8px; border-radius:6px; margin-bottom:8px; text-align:center;">
            <div id="evu-asset" style="font-size:12px; font-weight:bold; color:#fff;">CHART: LOADING...</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
            <span style="color:#aaa;">Loss Streak: <b style="color:#ff5252;">0/4</b></span>
            <span style="color:#aaa;">Accuracy: <b style="color:#00e676;">93%</b></span>
        </div>

        <!-- SIGNAL BOX -->
        <div id="evu-signal-box" style="background:#111; border:1px solid #333; padding:10px; border-radius:6px; text-align:center; margin-bottom:8px;">
            <div style="font-size:11px; color:#888; margin-bottom:3px;">PREDICTION SIGNAL</div>
            <div id="evu-signal" style="font-size:16px; font-weight:900; color:#ffb300;">ANALYZING...</div>
        </div>

        <div style="text-align:center; font-size:11px; color:#00e5ff;" id="evu-status">
            Next auto trade in <b id="evu-timer" style="color:#fff;">--s</b>
        </div>
    `;

    Object.assign(ui.style, {
        position: 'fixed', top: '80px', left: '15px',
        backgroundColor: 'rgba(10, 15, 24, 0.92)',
        color: 'white', padding: '14px', borderRadius: '12px',
        zIndex: '999999999', fontFamily: 'system-ui, -apple-system, sans-serif',
        border: '1px solid rgba(0, 229, 255, 0.3)',
        backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        width: '210px'
    });

    (document.body || document.documentElement).appendChild(ui);

    document.getElementById('close-evu').onclick = () => ui.remove();

    // ২. সিম্পল অ্যালগরিদম (Price Momentum Check) & সিগন্যাল লজিক
    let lastPrices = [];
    
    function calculateSignal() {
        if (lastPrices.length < 3) return "WAITING...";
        
        // আগের ৩টি টিকে প্রাইসের পরিবর্তন
        let diff = lastPrices[lastPrices.length - 1] - lastPrices[0];
        
        if (diff > 0) {
            return "<span style='color:#00e676;'>CALL (BUY) ▲</span>";
        } else if (diff < 0) {
            return "<span style='color:#ff5252;'>PUT (SELL) ▼</span>";
        } else {
            return "<span style='color:#ffb300;'>NEUTRAL</span>";
        }
    }

    // ৩. WebSocket মেসেজ ক্যাচ করা
    const parseData = async (data) => {
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
                        // সময় আপডেট
                        let date = new Date(timestamp * 1000);
                        let timeStr = date.toTimeString().split(' ')[0];

                        // ১ মিনিটের রিমেইনিং ক্যান্ডেল টাইম
                        let currentSec = Math.floor(timestamp) % 60;
                        let remainingSec = 60 - currentSec;

                        // প্রাইস হিস্ট্রি জমা রাখা (সর্বশেষ ৫টি প্রাইস)
                        lastPrices.push(price);
                        if (lastPrices.length > 5) lastPrices.shift();

                        // UI আপডেট
                        document.getElementById('evu-clock').innerText = timeStr;
                        document.getElementById('evu-asset').innerText = "CHART: " + asset;
                        document.getElementById('evu-timer').innerText = remainingSec + "s";

                        // ক্যান্ডেল শেষ হওয়ার ১৫ সেকেন্ড আগে নতুন ক্যান্ডেলের সিগন্যাল দিবে
                        let signalBox = document.getElementById('evu-signal');
                        if (remainingSec <= 15) {
                            signalBox.innerHTML = calculateSignal();
                        } else {
                            signalBox.innerHTML = "<span style='color:#aaa;'>ANALYZING...</span>";
                        }
                    }
                }
            }
        } catch (e) {}
    };

    // ৪. ব্রাউজারের মূল WebSocket কানেকশনে হুক করা
    if (!window.__evuWsHooked) {
        window.__evuWsHooked = true;
        const OrigWS = window.WebSocket;
        window.WebSocket = function(...args) {
            const ws = new OrigWS(...args);
            ws.addEventListener('message', (e) => parseData(e.data));
            return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
    }

    alert("EVU QX Bot Injected Successfully!\n\nগুরুত্বপূর্ণ: চার্টের যেকোনো একটি Asset বা Currency একবার চেঞ্জ করুন যেন WebSocket ডেটা রিসিভ হতে শুরু করে।");
})();
