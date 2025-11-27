/********************************************************************
 * MAJOR v7.1 – THE WARLORD GUI (Fixed & Fully Functional)
 * • Full Feature Port of warGUI.js v1.8
 * • Backend Connected: Colonel (Data) & Sergeant (Cloud)
 ********************************************************************/

(function() {

class Major {

    constructor() {
        this.general = null;
        this.host = null;
        this.shadow = null;

        // UI Refs
        this.drawer = null;
        this.toggleBtn = null;
        this.tabs = {};
        this.activeTab = "dashboard";
        
        // Throttling for resize
        this.rafId = null;

        // Settings (Direct mapping to your GM values)
        this.settings = {
            side: GM_getValue("FWH_DRAWER_SIDE", "left"),
            height: GM_getValue("FWH_DRAWER_HEIGHT", "55vh"),
            width: GM_getValue("FWH_DRAWER_WIDTH", "260px"),
            btnW: GM_getValue("FWH_BTN_WIDTH", 48),
            btnH: GM_getValue("FWH_BTN_HEIGHT", 48)
        };

        // Data Cache
        this.cache = {
            chain: { current: 0, max: 0, timeout: 0 },
            faction: { members: {} },
            war: { enemies: [], wall: {}, score: {} },
            targets: []
        };
    }

    /**************************************************************
     * INITIALIZATION
     **************************************************************/
    init(G) {
        this.cleanup();
        this.general = G;

        this.createHost();
        this.injectStyles();
        this.createToggleButton();
        this.createDrawer();
        this.registerSignals();

        // Initialize all interaction logic from your original script
        this.initResizers();
        this.initTabScrolling();
        this.initAlertSliders();

        // Load Default Tab
        this.switchTab("dashboard");

        console.log("%c[Major v7.1] GUI Fully Operational", "color:#0f0");
    }

    /**************************************************************
     * DOM SETUP
     **************************************************************/
    createHost() {
        // Remove old if exists
        const old = document.querySelector("fwh-root");
        if(old) old.remove();

        const host = document.createElement("fwh-root");
        document.body.appendChild(host);
        
        this.host = host;
        this.shadow = host.attachShadow({ mode: "open" });
    }

    injectStyles() {
        const style = document.createElement("style");
        style.textContent = this.getStyles(this.settings.height, this.settings.width);
        this.shadow.appendChild(style);
        
        // CSS Vars
        this.host.style.setProperty("--drawer-height", this.settings.height);
        this.host.style.setProperty("--drawer-width", this.settings.width);
    }

    /**************************************************************
     * TOGGLE BUTTON
     **************************************************************/
    createToggleButton() {
        const btn = document.createElement("div");
        btn.className = "fwh-toggle-btn";
        btn.style.width = this.settings.btnW + "px";
        btn.style.height = this.settings.btnH + "px";
        btn.innerHTML = `
            <img id="fwh-bear-logo" src="https://i.postimg.cc/fbktXTq2/Bear-head.png"
                 style="object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.6)); width:70%; height:70%;">
        `;
        
        btn.onclick = () => this.drawer.classList.toggle("open");
        this.shadow.appendChild(btn);
        this.toggleBtn = btn;
    }

    /**************************************************************
     * DRAWER & TABS
     **************************************************************/
    createDrawer() {
        const d = document.createElement("div");
        d.className = `fwh-drawer ${this.settings.side}`;
        d.innerHTML = `
            <div class="fwh-d-header">
                <span>Faction War Hub</span>
                <div class="fwh-header-btns">
                    <div class="fwh-header-icon" id="fwh-refresh">↻</div>
                    <div class="fwh-header-icon" id="fwh-close">✖</div>
                </div>
            </div>
            <div class="fwh-tabs" id="fwh-tabs"></div>
            <div class="fwh-tab-panel" id="fwh-panel"></div>
            
            <div class="fwh-resize-y-top" id="fwh-resize-y-top"></div>
            <div class="fwh-resize-y-bottom" id="fwh-resize-y-bottom"></div>
            <div class="fwh-resize-x" id="fwh-resize-x"></div>
        `;
        this.shadow.appendChild(d);
        this.drawer = d;

        d.querySelector("#fwh-close").onclick = () => d.classList.remove("open");
        d.querySelector("#fwh-refresh").onclick = () => window.location.reload(); // Simple refresh for now

        // Build Tabs
        this.addTab("dashboard", "Dashboard");
        this.addTab("chain", "Chain");
        this.addTab("targets", "Targets");
        this.addTab("war", "War");
        this.addTab("roster", "Roster");
        this.addTab("settings", "Settings");
    }

    addTab(id, name) {
        const strip = this.drawer.querySelector("#fwh-tabs");
        const btn = document.createElement("div");
        btn.className = "fwh-tab-btn";
        btn.textContent = name;
        btn.onclick = () => this.switchTab(id);
        strip.appendChild(btn);
        this.tabs[id] = btn;
    }

    switchTab(id) {
        this.activeTab = id;
        const panel = this.drawer.querySelector("#fwh-panel");
        
        Object.values(this.tabs).forEach(b => b.classList.remove("active"));
        if(this.tabs[id]) this.tabs[id].classList.add("active");

        panel.innerHTML = ""; // Clear current

        if(id === "dashboard") this.renderDashboard(panel);
        if(id === "chain") this.renderChain(panel);
        if(id === "targets") this.renderTargets(panel);
        if(id === "war") this.renderWar(panel);
        if(id === "roster") this.renderRoster(panel);
        if(id === "settings") this.renderSettingsMenu(panel);
    }

    /**************************************************************
     * PANEL RENDERERS
     **************************************************************/
    
    // --- DASHBOARD ---
    renderDashboard(panel) {
        const c = this.cache.chain;
        const w = this.cache.war;
        
        panel.innerHTML = `
        <div class="dashboard-wrap">
            <div class="dashboard-grid">
                <div class="dash-tile">
                    <div class="dash-title">Chain</div>
                    <div class="dash-value">${c.current > 0 ? "ACTIVE" : "IDLE"}</div>
                    <div class="dash-row"><span>Count</span><span class="dash-subtext">${c.current} / ${c.max || '∞'}</span></div>
                    <div class="dash-row"><span>Timer</span><span class="dash-subtext">${c.timeout}s</span></div>
                </div>
                <div class="dash-tile">
                    <div class="dash-title">War Status</div>
                    <div class="dash-value">${w.wall?.health ? "WAR" : "PEACE"}</div>
                    <div class="dash-row"><span>Wall</span><span class="dash-subtext">${w.wall?.health || "--"}</span></div>
                    <div class="dash-row"><span>Score</span><span class="dash-subtext">${w.score?.faction||0} vs ${w.score?.enemy||0}</span></div>
                </div>
                <div class="dash-tile">
                    <div class="dash-title">Quick Links</div>
                    <div class="dash-links">
                        <div class="dash-link" onclick="window.location.href='/crimes.php'">Crimes</div>
                        <div class="dash-link" onclick="window.location.href='/gym.php'">Gym</div>
                        <div class="dash-link" onclick="window.location.href='/items.php'">Items</div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // --- CHAIN (With Sliders) ---
    renderChain(panel) {
        const c = this.cache.chain;
        const pct = c.max ? (c.current / c.max) * 100 : 0;
        
        panel.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; min-height:0;">
            <div class="chain-hud" id="chain-hud">
                <div class="chain-hud-head">
                    <div class="chain-icon">👁️</div>
                    <div class="chain-title">Chain <span id="chain-timer">${c.timeout}s</span></div>
                    <div class="chain-icon" id="open-chain-settings">⚙️</div>
                </div>
                <div class="chain-bar">
                    <div class="chain-bar-fill" id="chain-fill-bar" style="width:${pct}%"></div>
                    <div class="chain-bar-text" id="chain-text">${c.current} / ${c.max || '∞'}</div>
                </div>
            </div>
            
            <div class="chain-settings" id="chain-settings" style="display:none;">
                <div class="chain-settings-header">
                    <div class="chain-back-btn" id="chain-back-btn">←</div>
                    <div>Chain Settings</div>
                </div>
                <div class="chain-settings-section">ALERT LEVELS</div>
                ${this.alertSliderBlock("Orange Alert","orange","00:30","02:00","chain-orange")}
                ${this.alertSliderBlock("Red Alert","red","00:00","01:00","chain-red")}
            </div>
        </div>`;
        
        // Re-attach slider logic because we just overwrote the HTML
        setTimeout(() => this.initAlertSliders(), 50);

        panel.querySelector("#open-chain-settings").onclick = () => {
            panel.querySelector("#chain-hud").style.display = "none";
            panel.querySelector("#chain-settings").style.display = "block";
        };
        panel.querySelector("#chain-back-btn").onclick = () => {
            panel.querySelector("#chain-settings").style.display = "none";
            panel.querySelector("#chain-hud").style.display = "flex";
        };
    }

    // --- TARGETS (Cloud) ---
    renderTargets(panel) {
        const inputHtml = `
            <div class="card">
                <div style="display:flex; gap:4px;">
                    <input type="number" id="inp-tid" class="fwh-modal-input" placeholder="ID" style="width:30%">
                    <input type="text" id="inp-tname" class="fwh-modal-input" placeholder="Name">
                    <button class="fwh-btn fwh-btn-accent" id="btn-push">ADD</button>
                </div>
            </div>`;

        const list = this.cache.targets || [];
        let rows = "";
        list.sort((a,b) => b.timestamp - a.timestamp).forEach(t => {
             rows += `<tr><td>${t.name}</td><td>${t.id}</td><td><a href="/loader.php?sid=attack&userID=${t.id}">⚔️</a></td></tr>`;
        });
        
        panel.innerHTML = inputHtml + this.mkTable(["Name","ID","Link"], rows);

        panel.querySelector("#btn-push").onclick = () => {
            const id = panel.querySelector("#inp-tid").value;
            const name = panel.querySelector("#inp-tname").value;
            if(id) {
                this.general.signals.dispatch("REQUEST_ADD_SHARED_TARGET", { id, name, timestamp: Date.now() });
                panel.querySelector("#inp-tid").value = "";
                panel.querySelector("#inp-tname").value = "";
            }
        };
    }

    // --- WAR ---
    renderWar(panel) {
        const list = this.cache.war.enemies || [];
        let rows = "";
        list.forEach(e => {
            const s = e.status?.state || "N/A";
            const lvl = e.level || 0;
            rows += `<tr><td>${e.name}</td><td>${lvl}</td><td>${s}</td><td><a href="/loader.php?sid=attack&userID=${e.id}">⚔️</a></td></tr>`;
        });
        panel.innerHTML = this.mkTable(["Enemy","Lvl","Status","Atk"], rows);
    }

    // --- ROSTER ---
    renderRoster(panel) {
        const list = Object.values(this.cache.faction.members || {});
        let rows = "";
        list.forEach(m => {
             rows += `<tr><td>${m.name}</td><td>${m.status?.state}</td><td>${m.last_action?.relative}</td></tr>`;
        });
        panel.innerHTML = this.mkTable(["Name","Status","Seen"], rows);
    }
    
    // --- SETTINGS MENU ---
    renderSettingsMenu(panel) {
        panel.innerHTML = `
        <div class="card" style="padding:14px;">
            <div class="settings-group-title">Display & Layout</div>
            <div class="setting-row">
                <div class="setting-label">Drawer Side</div>
                <select id="set-side" style="background:#222; color:#fff; border:1px solid #444;">
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                </select>
            </div>
            <div class="setting-row">
                <div class="setting-label">Button Size</div>
                <input type="range" id="set-btn-size" min="32" max="96" value="${this.settings.btnW}">
            </div>
        </div>`;
        
        const sel = panel.querySelector("#set-side");
        sel.value = this.settings.side;
        sel.onchange = () => {
            this.settings.side = sel.value;
            GM_setValue("FWH_DRAWER_SIDE", sel.value);
            this.drawer.className = `fwh-drawer ${sel.value} open`;
        };
        
        const rng = panel.querySelector("#set-btn-size");
        rng.oninput = () => {
            const val = rng.value;
            this.toggleBtn.style.width = val + "px";
            this.toggleBtn.style.height = val + "px";
            GM_setValue("FWH_BTN_WIDTH", val);
            GM_setValue("FWH_BTN_HEIGHT", val);
        };
    }

    /**************************************************************
     * SIGNAL BRIDGE (Live Updates)
     **************************************************************/
    registerSignals() {
        this.general.signals.listen("SITREP_UPDATE", d => {
            if(!d) return;
            this.cache.chain = d.chain || this.cache.chain;
            this.cache.war = d.war || this.cache.war;
            if(d.faction) this.cache.faction = d.faction;

            // Live Updates
            if(this.activeTab === "chain") {
                const tmr = this.shadow.querySelector("#chain-timer");
                const txt = this.shadow.querySelector("#chain-text");
                const bar = this.shadow.querySelector("#chain-fill-bar");
                
                if(tmr && d.chain) {
                    tmr.textContent = d.chain.timeout + "s";
                    txt.textContent = `${d.chain.current} / ${d.chain.max || '∞'}`;
                    const pct = d.chain.max ? (d.chain.current / d.chain.max) * 100 : 0;
                    bar.style.width = pct + "%";
                }
            }
        });

        this.general.signals.listen("SHARED_TARGETS_UPDATED", t => {
            this.cache.targets = t || [];
            if(this.activeTab === "targets") this.switchTab("targets");
        });
    }

    /**************************************************************
     * RESIZER LOGIC (Ported from warGUI.js)
     **************************************************************/
    initResizers() {
        const handleTop = this.shadow.querySelector("#fwh-resize-y-top");
        const handleBottom = this.shadow.querySelector("#fwh-resize-y-bottom");
        const handleSide = this.shadow.querySelector("#fwh-resize-x");
        
        let startX, startY, startW, startH, mode;

        const onMove = (e) => {
            if (!mode) return;
            e.preventDefault();
            
            if (this.rafId) return;
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                if (mode.includes("height")) {
                    let h = startH + (mode === "height-bottom" ? dy : -dy);
                    h = Math.max(200, Math.min(window.innerHeight * 0.9, h));
                    this.drawer.style.height = h + "px";
                    this.host.style.setProperty("--drawer-height", h + "px");
                    GM_setValue("FWH_DRAWER_HEIGHT", h + "px");
                }
                if (mode === "width") {
                    const isLeft = this.drawer.classList.contains("left");
                    let w = startW + (isLeft ? dx : -dx);
                    w = Math.max(230, Math.min(420, w));
                    this.drawer.style.width = w + "px";
                    this.host.style.setProperty("--drawer-width", w + "px");
                    GM_setValue("FWH_DRAWER_WIDTH", w + "px");
                }
            });
        };

        const onUp = (e) => {
            mode = null;
            this.drawer.classList.remove("resizing");
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            // Release capture if supported
            if(e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
        };

        const onDown = (m, e) => {
            e.preventDefault();
            mode = m;
            this.drawer.classList.add("resizing");
            startX = e.clientX; startY = e.clientY;
            startW = this.drawer.offsetWidth; startH = this.drawer.offsetHeight;
            
            if(e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        };

        handleTop.onpointerdown = e => onDown("height-top", e);
        handleBottom.onpointerdown = e => onDown("height-bottom", e);
        handleSide.onpointerdown = e => onDown("width", e);
    }

    /**************************************************************
     * SLIDER LOGIC (Ported from warGUI.js)
     **************************************************************/
    initAlertSliders() {
        this.shadow.querySelectorAll(".alert-slider-track").forEach(track => {
            const key = track.dataset.slider;
            const saved = GM_getValue(key, null);
            const knobA = track.querySelector('[data-knob="a"]');
            const knobB = track.querySelector('[data-knob="b"]');

            if (saved) {
                knobA.style.left = saved.a + "%";
                knobB.style.left = saved.b + "%";
            }
            this.updateAlertVisuals(track);

            [knobA, knobB].forEach(k => {
                k.onpointerdown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    k.setPointerCapture(e.pointerId);
                    
                    const onMove = (ev) => {
                        const rect = track.getBoundingClientRect();
                        let pct = ((ev.clientX - rect.left) / rect.width) * 100;
                        pct = Math.max(0, Math.min(100, pct));
                        k.style.left = pct + "%";
                        this.updateAlertVisuals(track);
                    };
                    
                    const onUp = (ev) => {
                        k.releasePointerCapture(ev.pointerId);
                        k.onpointermove = null;
                        k.onpointerup = null;
                        GM_setValue(key, { 
                            a: parseFloat(knobA.style.left), 
                            b: parseFloat(knobB.style.left) 
                        });
                    };
                    
                    k.onpointermove = onMove;
                    k.onpointerup = onUp;
                };
            });
        });
    }

    updateAlertVisuals(track) {
        const fill = track.querySelector(".alert-range-fill");
        const kA = track.querySelector('[data-knob="a"]');
        const kB = track.querySelector('[data-knob="b"]');
        const labels = track.nextElementSibling.querySelectorAll("span");
        
        const a = parseFloat(kA.style.left) || 0;
        const b = parseFloat(kB.style.left) || 100;
        const min = Math.min(a,b);
        const max = Math.max(a,b);
        
        fill.style.left = min + "%";
        fill.style.width = (max - min) + "%";
        
        if(labels.length >= 2) {
            labels[0].textContent = this.pctToTime(a, track.dataset.min, track.dataset.max);
            labels[1].textContent = this.pctToTime(b, track.dataset.min, track.dataset.max);
        }
    }

    pctToTime(pct, minStr, maxStr) {
        const [m1,s1] = minStr.split(":").map(Number);
        const [m2,s2] = maxStr.split(":").map(Number);
        const start = m1*60 + s1;
        const end = m2*60 + s2;
        const val = start + (pct/100)*(end-start);
        const m = Math.floor(val/60);
        const s = Math.round(val%60);
        return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    }

    /**************************************************************
     * TAB SCROLLING (Ported)
     **************************************************************/
    initTabScrolling() {
        const strip = this.drawer.querySelector("#fwh-tabs");
        let isDown = false, startX, scrollLeft;
        
        strip.onmousedown = e => {
            isDown = true;
            startX = e.pageX - strip.offsetLeft;
            scrollLeft = strip.scrollLeft;
        };
        strip.onmouseleave = () => isDown = false;
        strip.onmouseup = () => isDown = false;
        strip.onmousemove = e => {
            if(!isDown) return;
            e.preventDefault();
            const x = e.pageX - strip.offsetLeft;
            strip.scrollLeft = scrollLeft - (x - startX);
        };
    }

    cleanup() { if(this.host) this.host.remove(); }
    
    mkTable(h,r) {
        return `
        <div class="scroll-table-container">
            <table class="fwh-table scroll-table">
                <thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead>
                <tbody>${r || "<tr><td>No Data</td></tr>"}</tbody>
            </table>
        </div>`;
    }

    alertSliderBlock(label,color,start,end,key) {
        return `
        <div class="alert-slider-block ${color}">
            <div class="alert-label"><span>⏱️</span><span>${label}</span></div>
            <div class="alert-slider-track" data-slider="${key}" data-min="${start}" data-max="${end}">
                <div class="alert-range-fill"></div>
                <div class="alert-knob" data-knob="a" style="left:0%;"></div>
                <div class="alert-knob" data-knob="b" style="left:100%;"></div>
            </div>
            <div class="alert-time-labels"><span>${start}</span><span>${end}</span></div>
        </div>`;
    }

    // CSS Generator (Your Exact Styles)
    getStyles(height, width) {
        return `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");
        :host { --drawer-height: ${height}; --drawer-width: ${width}; --bg: #101214; --bg-alt: #16191d; --bg-panel: #1b1f23; --bg-hover: #22272c; --border: #2b2f34; --text: #e6e6e6; --text-muted: #9ba3ab; --accent: #52a8ff; --radius: 8px; font-family: "Inter", sans-serif; }
        * { box-sizing: border-box; }
        .fwh-toggle-btn { position: fixed; bottom: 14px; left: 10px; width: 48px; height: 48px; background: linear-gradient(180deg,#1a7a3a 0%,#0f6a32 40%,#0b4c23 100%); border-radius: 12px; border: 1px solid #063018; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999999; box-shadow: 0 4px 6px rgba(0,0,0,0.35); }
        .fwh-drawer { position: fixed; top: 50%; height: var(--drawer-height); width: var(--drawer-width); background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; overflow: hidden; z-index: 9999999; box-shadow: 0 0 20px rgba(0,0,0,0.7); }
        .fwh-drawer.left { left: 0; transform: translate(-100%, -50%); transition: transform 0.25s ease; }
        .fwh-drawer.left.open { transform: translate(0, -50%); }
        .fwh-drawer.right { right: 0; transform: translate(100%, -50%); transition: transform 0.25s ease; }
        .fwh-drawer.right.open { transform: translate(0, -50%); }
        .fwh-d-header { padding: 12px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; font-weight: 600; align-items: center; }
        .fwh-header-btns { display:flex; gap:8px; }
        .fwh-header-icon { cursor:pointer; padding:4px; }
        .fwh-tabs { display: flex; overflow-x: auto; border-bottom: 1px solid var(--border); background: var(--bg); user-select:none; }
        .fwh-tab-btn { padding: 10px 14px; cursor: pointer; background: var(--bg-alt); border-right: 1px solid var(--border); font-size: 13px; white-space:nowrap; }
        .fwh-tab-btn.active { background: var(--accent); color: #000; font-weight: bold; }
        .fwh-tab-panel { flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; }
        .fwh-resize-x { position: absolute; top: 0; right: -10px; width: 20px; height: 100%; cursor: ew-resize; z-index: 100; }
        .fwh-drawer.right .fwh-resize-x { left:-10px; right:auto; }
        .fwh-resize-y-top { position: absolute; top: -10px; left: 0; width: 100%; height: 20px; cursor: ns-resize; z-index: 100; }
        .fwh-resize-y-bottom { position: absolute; bottom: -10px; left: 0; width: 100%; height: 20px; cursor: ns-resize; z-index: 100; }
        .chain-hud { background: var(--bg); border: 1px solid var(--border); padding: 14px; border-radius: var(--radius); }
        .chain-hud-head { display:flex; justify-content:space-between; margin-bottom:10px; font-size:16px; font-weight:bold; }
        .chain-bar { height: 24px; background: #444; border-radius: 12px; overflow: hidden; position: relative; margin-top: 8px; }
        .chain-bar-fill { height: 100%; background: #40d66b; transition: width 0.3s; }
        .chain-bar-text { position: absolute; width: 100%; height: 100%; top: 0; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #000; }
        .dashboard-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .dash-tile { background:var(--bg); padding:10px; border:1px solid var(--border); border-radius:var(--radius); }
        .dash-title { font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px; }
        .dash-value { font-size:18px; font-weight:bold; margin-bottom:6px; }
        .dash-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px; }
        .dash-links { display:flex; gap:4px; flex-wrap:wrap; }
        .dash-link { padding:4px 8px; background:var(--bg-alt); border:1px solid var(--border); border-radius:4px; font-size:11px; cursor:pointer; }
        table.fwh-table { width:100%; border-collapse:collapse; font-size:12px; }
        table.fwh-table th { background:var(--bg-alt); padding:8px; text-align:left; border-bottom:1px solid var(--border); position:sticky; top:0; }
        table.fwh-table td { padding:8px; border-bottom:1px solid #333; }
        .scroll-table-container { flex:1; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius); }
        .fwh-modal-input { width:100%; padding:6px; background:var(--bg); border:1px solid var(--border); color:#fff; }
        .fwh-btn { padding:6px 12px; background:var(--bg-alt); border:1px solid var(--border); color:#fff; cursor:pointer; border-radius:4px; }
        .fwh-btn-accent { background:var(--accent); color:#000; font-weight:bold; }
        .alert-slider-block { margin-top:12px; padding:10px; background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); }
        .alert-slider-track { position:relative; height:16px; background:#333; border-radius:8px; margin:10px 0; }
        .alert-range-fill { position:absolute; height:100%; background:currentColor; opacity:0.3; border-radius:8px; }
        .alert-knob { position:absolute; top:50%; transform:translate(-50%,-50%); width:18px; height:18px; background:#fff; border-radius:50%; cursor:grab; }
        .alert-time-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); }
        .orange { color:#ffb84a; }
        .red { color:#ff4a4a; }
        `;
    }
}

if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Major", new Major());
}

})();
