(function() {
    // ১. কাস্টম UI তৈরি ফাংশন
    function createTrackerUI() {
        if (document.getElementById('qx-custom-tracker')) return;

        const ui = document.createElement('div');
        ui.id = 'qx-custom-tracker';
        ui.innerHTML = `
            <div style="font-weight:bold; color:#00e676; margin-bottom:5px; font-size:15px; letter-spacing:1px; display:flex; justify-content:space-between;">
                <span>QUOTEX LIVE</span>
                <span id="close-qx-tracker" style="cursor:pointer; color:#ff5252;">✕</span>
            </div>
            <hr style="border:0; border-top:1px solid #333; margin:8px 0;">
            <div>Asset: <span id="track-asset" style="color:#ffffff; font-weight:bold;">--</span></div>
            <div>Price: <span id="track-price" style="color:#ffb300; font-weight:bold;">0.0000</span></div>
            <div>Candle Time: <span id="track-clock" style="color:#00b0ff; font-weight:bold;">--s remaining</span></div>
            <div style="margin-top:10px; font-size:11px; color:#aaa;" id="ws-status">Status: Waiting for WS...</div>
        `;
        
        Object.assign(ui.style, {
            position: 'fixed', top: '100px', left: '20px', backgroundColor: 'rgba(15,15,15,0.92)',
            color: 'white', padding: '15px', borderRadius: '10px', zIndex: '99999999',
            fontFamily: 'monospace', fontSize: '14px', border: '1px solid #444', 
            backdropFilter: 'blur(8px)', boxShadow: '0 4px 15px rgba(0,0,0,0.6)', width: '220px'
        });
        
        (document.body || document.documentElement).appendChild(ui);

        document.getElementById('close-qx-tracker').onclick = function() {
            ui.remove();
        };
    }

    createTrackerUI();

    // ২. রানিং WebSocket মেসেজ ইন্টারসেপ্টর
    if (!window.__qxWsHooked) {
        window.__qxWsHooked = true;

        const parseBinaryData = async (data) => {
            try {
                let rawData;
                if (data instanceof Blob) {
                    rawData = await data.arrayBuffer();
                } else if (data instanceof ArrayBuffer) {
                    rawData = data;
                } else {
                    return;
                }

                const decoder = new TextDecoder('utf-8');
                let text = decoder.decode(rawData);
                
                const jsonStart = text.indexOf('[[');
                const jsonEnd = text.indexOf(']]', jsonStart);
                
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const cleanJson = text.substring(jsonStart, jsonEnd + 2);
                    const dataArray = JSON.parse(cleanJson);
                    
                    if (dataArray && dataArray[0]) {
                        const [asset, timestamp, price] = dataArray[0];
                        
                        if (typeof price === 'number') {
                            const currentSeconds = Math.floor(timestamp) % 60;
                            const remainingSeconds = 60 - currentSeconds;

                            const assetEl = document.getElementById('track-asset');
                            const priceEl = document.getElementById('track-price');
                            const clockEl = document.getElementById('track-clock');
                            const statusEl = document.getElementById('ws-status');
                            
                            if (assetEl) assetEl.innerText = asset;
                            if (priceEl) priceEl.innerText = price.toFixed(5);
                            if (clockEl) clockEl.innerText = remainingSeconds + 's';
                            if (statusEl) {
                                statusEl.innerText = "Status: Connected Live";
                                statusEl.style.color = "#00e676";
                            }
                        }
                    }
                }
            } catch (e) {}
        };

        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(...args) {
            const ws = new OriginalWebSocket(...args);
            ws.addEventListener('message', (event) => {
                parseBinaryData(event.data);
            });
            return ws;
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;

        alert("Quotex Live Tracker Script Active!");
    }
})();
