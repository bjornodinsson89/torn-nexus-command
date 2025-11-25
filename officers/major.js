/**
 * CODENAME: WAR_MAJOR
 * RANK: ⭐️⭐️ (Field Officer)
 * MISSION: Visualization & Interaction
 */

(function() {

    const Major = {
        name: "Major (GUI)",
        general: null,
        shadow: null,

        init: function(General) {
            this.general = General;
            this.buildInterface();

            General.signals.listen('SITREP_UPDATE', (sitrep) => {
                this.updateDashboard(sitrep);
            });
            
            General.signals.listen('CLEARANCE_GRANTED', () => {
                this.flashStatus("green");
                const inp = this.shadow.getElementById('api-input');
                if(inp) inp.value = "••••••••••••••••";
            });

            this.initSliders();
            this.initApiInput();
            
            console.log(`🎨 [MAJOR] GUI online.`);
        },

        buildInterface: function() {
            const host = document.createElement("fwh-root");
            document.body.appendChild(host);
            this.shadow = host.attachShadow({ mode: "open" });

            const style = document.createElement("style");
            style.textContent = this.getStyles(); 
            this.shadow.appendChild(style);

            const drawer = document.createElement("div");
            drawer.className = "fwh-drawer left"; 
            drawer.innerHTML = `
                <div class="fwh-d-header">
                    <span>WAR ROOM</span>
                    <div id="status-indicator" class="status-dot grey"></div>
                </div>
                <div class="fwh-panel">
                    <div class="chain-hud">
                        <div class="chain-title">CHAIN <span id="dash-chain-timer">--</span></div>
                        <div class="chain-bar">
                            <div class="chain-bar-fill" id="dash-chain-fill" style="width: 0%"></div>
                            <div class="chain-bar-text" id="dash-chain-text">Waiting for Intel...</div>
                        </div>
                    </div>

                    <div class="settings-box">
                        <div class="setting-header">ALERT THRESHOLDS</div>
                        ${this.renderSlider("panic", "Red Alert (Panic)", "red")}
                        ${this.renderSlider("warning", "Orange Alert (Warn)", "orange")}
                    </div>

                    <div class="settings-box" style="margin-top: 15px;">
                        <div class="setting-header">ACCESS CREDENTIALS</div>
                        <div style="display:flex; gap:5px;">
                            <input type="text" id="api-input" class="fwh-input" placeholder="Enter Public API Key">
                            <button id="api-save-btn" class="fwh-btn">💾</button>
                        </div>
                    </div>
                </div>
                
                <div class="fwh-toggle-btn">🐻</div>
            `;
            this.shadow.appendChild(drawer);
            
            this.shadow.querySelector('.fwh-toggle-btn').onclick = () => {
                drawer.classList.toggle('open');
            };
        },

        initApiInput: function() {
            const btn = this.shadow.getElementById('api-save-btn');
            const input = this.shadow.getElementById('api-input');

            btn.onclick = () => {
                const key = input.value.trim();
                if(key.length > 10) {
                    this.general.intel.setCredentials(key);
                } else {
                    alert("Invalid Key");
                }
            };
        },

        flashStatus: function(color) {
            const dot = this.shadow.getElementById('status-indicator');
            dot.style.background = color;
            setTimeout(() => dot.style.background = 'grey', 500);
        },

        renderSlider: function(key, label, colorClass) {
            const savedVal = localStorage.getItem("WAR_CFG_" + key) || (key === 'panic' ? 60 : 120);
            const maxSeconds = 300; 
            const pct = (savedVal / maxSeconds) * 100;

            return `
            <div class="alert-slider-block ${colorClass}" id="slider-${key}">
                <div class="alert-label">
                    <span>⏱️</span><span>${label}</span>
                </div>
                <div class="alert-slider-track" data-key="${key}" data-max="${maxSeconds}">
                    <div class="alert-range-fill" style="width:${pct}%"></div>
                    <div class="alert-knob" style="left:${pct}%"></div>
                </div>
                <div class="alert-time-labels">
                    <span class="val-display">${this.fmtTime(savedVal)}</span>
                    <span>5:00</span>
                </div>
            </div>`;
        },

        initSliders: function() {
            const tracks = this.shadow.querySelectorAll('.alert-slider-track');
            tracks.forEach(track => {
                const knob = track.querySelector('.alert-knob');
                const fill = track.querySelector('.alert-range-fill');
                const display = track.parentElement.querySelector('.val-display');
                const key = track.dataset.key;
                const maxSec = parseInt(track.dataset.max);
                let isDragging = false;
                const update = (clientX) => {
                    const rect = track.getBoundingClientRect();
                    let x = clientX - rect.left;
                    x = Math.max(0, Math.min(rect.width, x)); 
                    const pct = (x / rect.width) * 100;
                    const seconds = Math.round((pct / 100) * maxSec);
                    knob.style.left = pct + "%";
                    fill.style.width = pct + "%";
                    display.textContent = this.fmtTime(seconds);
                    return seconds;
                };
                knob.addEventListener('pointerdown', (e) => { isDragging = true; knob.setPointerCapture(e.pointerId); });
                knob.addEventListener('pointermove', (e) => { if(isDragging) update(e.clientX); });
                knob.addEventListener('pointerup', (e) => {
                    if(!isDragging) return;
                    isDragging = false;
                    const finalSeconds = update(e.clientX);
                    localStorage.setItem("WAR_CFG_" + key, finalSeconds);
                    this.general.signals.dispatch('CONFIG_UPDATE', true);
                });
            });
        },

        updateDashboard: function(sitrep) {
            if (!sitrep || !sitrep.chain) return;
            const timerEl = this.shadow.getElementById("dash-chain-timer");
            const fillEl = this.shadow.getElementById("dash-chain-fill");
            const textEl = this.shadow.getElementById("dash-chain-text");
            const indicator = this.shadow.getElementById("status-indicator");

            timerEl.textContent = sitrep.chain.timeout + "s";
            timerEl.style.color = sitrep.status.color;
            indicator.style.background = sitrep.status.color;

            if (fillEl && sitrep.chain.max) {
                const pct = (sitrep.chain.current / sitrep.chain.max) * 100;
                fillEl.style.width = pct + "%";
                textEl.textContent = `${sitrep.chain.current} / ${sitrep.chain.max}`;
            }
            const hud = this.shadow.querySelector(".chain-hud");
            if (sitrep.isPanic) hud.classList.add("panic-pulse");
            else hud.classList.remove("panic-pulse");
        },

        fmtTime: function(s) {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${m}:${sec.toString().padStart(2, '0')}`;
        },

        getStyles: function() {
            return `
                :host { --bg: #111; --text: #eee; --accent: #4caf50; --danger: #f44336; --orange: #ff9800; }
                .fwh-drawer { position: fixed; background: var(--bg); color: var(--text); border: 1px solid #333; z-index: 99999; width: 300px; height: auto; padding-bottom: 20px; border-radius: 0 8px 8px 0; display: flex; flex-direction: column; box-shadow: 0 0 10px rgba(0,0,0,0.8); transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1); }
                .left { top: 20%; left: 0; transform: translate(-100%, 0); }
                .open { transform: translate(0, 0); }
                .fwh-d-header { padding: 12px; background: #1a1a1a; border-bottom: 1px solid #333; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
                .status-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #000; transition: background 0.3s; }
                .fwh-panel { padding: 15px; }
                .chain-hud { border: 1px solid #444; padding: 10px; border-radius: 6px; background: #0a0a0a; margin-bottom: 20px; transition: border-color 0.3s; }
                .chain-title { font-size: 18px; font-weight: bold; display: flex; justify-content: space-between; }
                .chain-bar { height: 24px; background: #333; border-radius: 12px; position: relative; overflow: hidden; margin-top: 8px; }
                .chain-bar-fill { height: 100%; background: var(--accent); transition: width 0.3s; }
                .chain-bar-text { position: absolute; width: 100%; text-align: center; line-height: 24px; font-weight: bold; text-shadow: 0 1px 2px black; font-size: 13px; top:0; }
                .panic-pulse { animation: pulse 1s infinite; border-color: var(--danger); box-shadow: 0 0 15px rgba(244, 67, 54, 0.2); }
                @keyframes pulse { 0% { border-color: #444; } 50% { border-color: var(--danger); } 100% { border-color: #444; } }
                .settings-box { border-top: 1px solid #333; padding-top: 15px; }
                .setting-header { font-size: 12px; color: #888; letter-spacing: 1px; margin-bottom: 10px; font-weight: bold; }
                .alert-slider-block { margin-bottom: 15px; }
                .alert-label { display: flex; gap: 6px; font-size: 13px; margin-bottom: 6px; font-weight: 600; }
                .red .alert-label { color: var(--danger); }
                .orange .alert-label { color: var(--orange); }
                .alert-slider-track { height: 6px; background: #333; border-radius: 3px; position: relative; cursor: pointer; touch-action: none; }
                .alert-range-fill { height: 100%; background: currentColor; opacity: 0.5; border-radius: 3px; pointer-events: none; }
                .alert-knob { width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 50%; transform: translate(-50%, -50%); cursor: grab; box-shadow: 0 1px 3px rgba(0,0,0,0.5); }
                .alert-knob:active { cursor: grabbing; transform: translate(-50%, -50%) scale(1.2); }
                .alert-time-labels { display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-top: 4px; }
                .val-display { color: #fff; font-weight: bold; }
                .fwh-toggle-btn { position: absolute; right: -45px; top: 10px; width: 45px; height: 45px; background: #1a1a1a; border-radius: 0 8px 8px 0; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid #333; border-left: none; font-size: 20px; }
                .fwh-toggle-btn:hover { background: #222; }
                .fwh-input { flex: 1; background: #222; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; outline: none; }
                .fwh-input:focus { border-color: var(--accent); }
                .fwh-btn { background: #333; border: 1px solid #444; color: #fff; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
                .fwh-btn:hover { background: #444; }
            `;
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Major", Major);

})();
