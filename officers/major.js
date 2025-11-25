/**
 * CODENAME: WAR_MAJOR
 * RANK: ⭐️⭐️ (Senior Officer)
 * MISSION: UI, Dashboard, and User Interaction
 * SOURCE: WarGUI v1.8 (Active Data Binding)
 */

(function() {
    'use strict';

    const Major = {
        name: "Major (UI/GUI)",
        version: "1.9", // Bumped version
        general: null,
        root: null,
        shadow: null,
        ui: { tabs: {} },
        storagePrefix: "FWH_",

        init: function(General) {
            this.general = General;
            console.log("🛡️ [MAJOR] Booting GUI & Data Streams...");

            this.initShadow();
            this.injectStyles();
            this.buildToggle();
            this.buildDrawer();
            this.initTabs();
            this.initResizeLogic();
            this.showInitialApiPopupIfNeeded();

            // --- NEW: LISTEN FOR DATA ---
            this.general.signals.listen('RAW_INTEL', (data) => {
                this.updateUI(data);
            });

            this.switchTab("dashboard");
            console.log("🛡️ [MAJOR] UI Online & Listening.");
        },

        // ========================================================
        // --- NEW: DATA BINDING LOGIC ---
        // ========================================================
        updateUI: function(data) {
            if (!this.shadow) return;
            
            // 1. Update Chain (if data exists)
            if (data.chain) {
                this.updateChainBar(data.chain);
            }

            // 2. Update Dashboard (User Status / Faction)
            // Note: We use specific IDs added in the createDashboardPanel below
            if (data.status) {
                this.setText("#dash-status-state", data.status.state);
                this.setText("#dash-status-desc", data.status.description.substring(0, 30));
            }
            
            if (data.faction) {
                this.setText("#dash-respect", this.formatNum(data.faction.respect));
            }
        },

        updateChainBar: function(chain) {
            const barFill = this.shadow.querySelector("#chain-hits-fill");
            const barText = this.shadow.querySelector("#chain-hits-text");
            const timer = this.shadow.querySelector("#chain-timer");

            if (chain.current > 0) {
                const pct = (chain.current / chain.maximum) * 100;
                if(barFill) barFill.style.width = pct + "%";
                if(barText) barText.textContent = `${chain.current} / ${chain.maximum}`;
                if(timer) timer.textContent = `${chain.timeout}s`;
            } else {
                if(barFill) barFill.style.width = "0%";
                if(barText) barText.textContent = "No Chain";
                if(timer) timer.textContent = "00:00";
            }
        },

        // Helper: Safely set text content
        setText: function(selector, text) {
            const el = this.shadow.querySelector(selector);
            if (el) el.textContent = text;
        },
        
        // Helper: Format numbers (e.g. 1,200)
        formatNum: function(num) {
            return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";
        },

        // ========================================================
        // STORAGE HELPERS
        // ========================================================
        setValue: function(key, value) {
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(value));
        },
        getValue: function(key, def) {
            const val = localStorage.getItem(this.storagePrefix + key);
            return val ? JSON.parse(val) : def;
        },

        // ========================================================
        // CORE UI SETUP
        // ========================================================
        initShadow: function() {
            const host = document.createElement("fwh-root");
            document.body.appendChild(host);
            this.shadow = host.attachShadow({ mode: "open" });
            this.root = host;
            this.shadow.addEventListener("click", e => this.handleGlobalClicks(e));
        },

        injectStyles: function() {
            const savedHeight = this.getValue("DRAWER_HEIGHT", "55vh");
            const savedWidth = this.getValue("DRAWER_WIDTH", "260px");
            const savedSide = this.getValue("DRAWER_SIDE", "left");
            const style = document.createElement("style");
            style.textContent = this.getStyles(savedHeight, savedWidth);
            this.shadow.appendChild(style);
            this.root.style.setProperty("--drawer-height", savedHeight);
            this.root.style.setProperty("--drawer-width", savedWidth);
            this.root.dataset.side = savedSide;
        },

        buildToggle: function() {
            this.ui.toggleButton = document.createElement("div");
            this.ui.toggleButton.className = "fwh-toggle-btn";
            const initBtnW = this.getValue("BTN_WIDTH", 48);
            const initBtnH = this.getValue("BTN_HEIGHT", 48);
            this.ui.toggleButton.style.width = initBtnW + "px";
            this.ui.toggleButton.style.height = initBtnH + "px";
            this.ui.toggleButton.innerHTML = `
                <img id="fwh-bear-logo" src="https://i.postimg.cc/fbktXTq2/Bear-head.png"
                     style="object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.6));">
            `;
            this.shadow.appendChild(this.ui.toggleButton);
            this.updateToggleButtonIconSize();
            this.ui.toggleButton.addEventListener("click", () => {
                this.ui.drawer.classList.toggle("open");
            });
        },

        updateToggleButtonIconSize: function() {
            const img = this.ui.toggleButton.querySelector("#fwh-bear-logo");
            if (!img) return;
            const rect = this.ui.toggleButton.getBoundingClientRect();
            const minSide = Math.min(rect.width, rect.height);
            const size = minSide * 0.7;
            img.style.width = size + "px";
            img.style.height = size + "px";
        },

        buildDrawer: function() {
            const initialSide = this.getValue("DRAWER_SIDE", "left");
            this.ui.drawer = document.createElement("div");
            this.ui.drawer.className = `fwh-drawer ${initialSide}`;
            this.ui.drawer.innerHTML = `
                <div class="fwh-d-header">
                    <span>Faction War Hub</span>
                    <div class="fwh-header-btns">
                        <div class="fwh-header-icon" id="fwh-settings">⚙️</div>
                        <div class="fwh-header-icon" id="fwh-close">✖</div>
                    </div>
                </div>
                <div class="fwh-tabs" id="fwh-tabs"></div>
                <div class="fwh-tab-panel" id="fwh-panel"></div>
                <div class="fwh-resize-y-top" id="fwh-resize-y-top"></div>
                <div class="fwh-resize-y-bottom" id="fwh-resize-y-bottom"></div>
                <div class="fwh-resize-x" id="fwh-resize-x"></div>
            `;
            this.shadow.appendChild(this.ui.drawer);
            this.ui.drawer.querySelector("#fwh-close").addEventListener("click", () => {
                this.ui.drawer.classList.remove("open");
            });
        },

        // ========================================================
        // TABS SYSTEM
        // ========================================================
        initTabs: function() {
            this.addTab("dashboard", "Dashboard", this.createDashboardPanel());
            this.addTab("faction", "Faction", this.mkPanel("Faction Roster", ["Name","ID","Level","Rank","Status","Action"]));
            this.addTab("targets", "Targets", this.mkPanel("Targets List", ["Name","ID","Status","Level","Respect","Reason"]));
            this.addTab("chain", "Chain", this.createChainPanel());
            this.initTabStripDrag();
        },

        addTab: function(id, name, element) {
            const strip = this.ui.drawer.querySelector("#fwh-tabs");
            const btn = document.createElement("div");
            btn.className = "fwh-tab-btn";
            btn.textContent = name;
            strip.appendChild(btn);
            this.ui.tabs[id] = { btn, element };
            btn.addEventListener("click", () => this.switchTab(id));
        },

        switchTab: function(id) {
            const panel = this.ui.drawer.querySelector("#fwh-panel");
            for (const t in this.ui.tabs) this.ui.tabs[t].btn.classList.remove("active");
            this.ui.tabs[id].btn.classList.add("active");
            panel.innerHTML = "";
            panel.appendChild(this.ui.tabs[id].element);
            if (id === "chain") this.initAlertSliders();
        },

        initTabStripDrag: function() {
            const strip = this.ui.drawer.querySelector("#fwh-tabs");
            let isDown = false, startX = 0, scrollLeft = 0;
            strip.addEventListener("mousedown", e => {
                isDown = true;
                startX = e.pageX - strip.offsetLeft;
                scrollLeft = strip.scrollLeft;
                strip.style.cursor = "grabbing";
            });
            window.addEventListener("mouseup", () => {
                isDown = false;
                strip.style.cursor = "default";
            });
            strip.addEventListener("mousemove", e => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - strip.offsetLeft;
                const walk = (x - startX) * 1.5;
                strip.scrollLeft = scrollLeft - walk;
            });
        },

        // ========================================================
        // PANEL GENERATORS
        // ========================================================
        mkPanel: function(title, heads) {
            let rows = "";
            for (let i = 0; i < 20; i++) rows += "<tr>" + heads.map(() => `<td style="border-right:1px solid var(--border);">—</td>`).join("") + "</tr>";
            const el = document.createElement("div");
            el.innerHTML = `
                <div class="card" style="height:100%;display:flex;flex-direction:column;">
                    <h3 style="margin:0 0 6px;">${title}</h3>
                    <div class="scroll-table-container">
                        <table class="fwh-table scroll-table">
                            <thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>`;
            return el;
        },

        createDashboardPanel: function() {
            const el = document.createElement("div");
            el.className = "dashboard-wrap";
            // ADDED IDs for Data Binding (dash-status-state, dash-respect, etc)
            el.innerHTML = `
                <div class="dashboard-grid">
                    <div class="dash-tile">
                        <div class="dash-title">My Status</div>
                        <div class="dash-value" id="dash-status-state" style="color:#40d66b">Active</div>
                        <div class="dash-row"><span>Details</span><span class="dash-subtext" id="dash-status-desc">...</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Respect</div>
                        <div class="dash-value" id="dash-respect">—</div>
                        <div class="dash-row"><span>Rank</span><span class="dash-subtext">--</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">War Status</div>
                        <div class="dash-value">No War</div>
                        <div class="dash-row"><span>Score</span><span class="dash-subtext">0 - 0</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Quick Links</div>
                        <div class="dash-links">
                            <div class="dash-link">Gym</div>
                            <div class="dash-link">Crimes</div>
                            <div class="dash-link">Jail</div>
                        </div>
                    </div>
                </div>`;
            return el;
        },

        createChainPanel: function() {
            const el = document.createElement("div");
            el.style.flex = "1";
            el.style.display = "flex";
            el.style.flexDirection = "column";
            el.style.minHeight = "0";
            
            const toggleRow = (label, key) => `
                <div class="setting-row">
                    <div class="setting-label">${label}</div>
                    <div class="toggle-switch" data-toggle="${key}">
                        <div class="toggle-thumb"></div>
                    </div>
                </div>`;

            const alertSliderBlock = (label, color, start, end, key) => `
                <div class="alert-slider-block ${color}">
                    <div class="alert-label"><span>⏱️</span><span>${label}</span></div>
                    <div class="alert-slider-track" data-slider="${key}" data-min="${start}" data-max="${end}">
                        <div class="alert-range-fill"></div>
                        <div class="alert-knob" data-knob="a" style="left:0%;"></div>
                        <div class="alert-knob" data-knob="b" style="left:100%;"></div>
                    </div>
                    <div class="alert-time-labels"><span>${start}</span><span>${end}</span></div>
                </div>`;

            el.innerHTML = `
                <div class="chain-hud" id="chain-hud">
                    <div class="chain-hud-head">
                        <div class="chain-icon" id="chain-watch-toggle">👁️</div>
                        <div class="chain-title">Chain <span id="chain-timer">00:00</span></div>
                        <div class="chain-icon" id="open-chain-settings">⚙️</div>
                    </div>
                    <div class="chain-bar">
                        <div class="chain-bar-fill" id="chain-hits-fill" style="width:0%;"></div>
                        <div class="chain-bar-text" id="chain-hits-text">0 / 10</div>
                    </div>
                    <div class="chain-settings" id="chain-settings">
                        <div class="chain-settings-header" id="chain-settings-header"></div>
                        <div class="chain-settings-section">ALERTS</div>
                        ${alertSliderBlock("Chain Alert","orange","00:30","02:00","chain-orange")}
                    </div>
                </div>`;
            return el;
        },

        handleGlobalClicks: function(e) {
            const toggle = e.target.closest(".toggle-switch");
            if (toggle && toggle.hasAttribute("data-toggle")) {
                toggle.classList.toggle("on");
            }
            if (e.target.closest("#open-chain-settings")) this.openChainSettings();
            if (e.target.closest("#chain-back-btn")) this.closeChainSettings();
            if (e.target.closest("#fwh-settings")) this.openMainMenu();
        },

        openChainSettings: function() {
            const hud = this.shadow.querySelector("#chain-hud");
            const settings = this.shadow.querySelector("#chain-settings");
            if (!hud || !settings) return;
            hud.style.display = "none";
            settings.style.display = "block";
            this.renderChainSettingsHeader();
        },
        
        closeChainSettings: function() {
            const hud = this.shadow.querySelector("#chain-hud");
            const settings = this.shadow.querySelector("#chain-settings");
            if (!hud || !settings) return;
            settings.style.display = "none";
            hud.style.display = "flex";
        },

        renderChainSettingsHeader: function() {
            const header = this.shadow.querySelector("#chain-settings-header");
            if (!header) return;
            const side = this.getValue("DRAWER_SIDE", "left");
            header.innerHTML = side === "left" 
                ? `<div class="chain-back-btn" id="chain-back-btn">←</div><div>Chain Settings</div>`
                : `<div>Chain Settings</div><div class="chain-back-btn" id="chain-back-btn">→</div>`;
        },

        // ========================================================
        // SLIDER LOGIC
        // ========================================================
        pctToTime: function(pct, minStr, maxStr) {
            const [minM, minS] = minStr.split(":").map(Number);
            const [maxM, maxS] = maxStr.split(":").map(Number);
            const min = (minM || 0) * 60 + (minS || 0);
            const max = (maxM || 0) * 60 + (maxS || 0);
            const sec = min + (pct / 100) * (max - min);
            const final = Math.round(sec);
            const m = Math.floor(final / 60);
            const s = final % 60;
            return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        },

        updateAlertVisuals: function(track) {
            if (!track) return;
            const fill = track.querySelector(".alert-range-fill");
            const knobA = track.querySelector('[data-knob="a"]');
            const knobB = track.querySelector('[data-knob="b"]');
            const labels = track.nextElementSibling;
            if (!fill || !knobA || !knobB) return;
            const aVal = parseFloat(knobA.style.left) || 0;
            const bVal = parseFloat(knobB.style.left) || 100;
            const left = Math.min(aVal, bVal);
            const right = Math.max(aVal, bVal);
            fill.style.left = left + "%";
            fill.style.width = (right - left) + "%";
            if (labels && track.dataset.min && track.dataset.max) {
                const spans = labels.querySelectorAll("span");
                if (spans.length >= 2) {
                    const minTime = track.dataset.min;
                    const maxTime = track.dataset.max;
                    spans[0].textContent = this.pctToTime(aVal, minTime, maxTime);
                    spans[1].textContent = this.pctToTime(bVal, minTime, maxTime);
                }
            }
        },

        initAlertSliders: function() {
            this.shadow.querySelectorAll(".alert-slider-track").forEach(track => {
                const key = track.dataset.slider;
                const saved = this.getValue(key, null);
                const knobA = track.querySelector('[data-knob="a"]');
                const knobB = track.querySelector('[data-knob="b"]');
                if (saved && knobA && knobB) {
                    knobA.style.left = saved.a + "%";
                    knobB.style.left = saved.b + "%";
                } else if (knobA && knobB) {
                    knobA.style.left = "0%";
                    knobB.style.left = "100%";
                }
                this.updateAlertVisuals(track);
                [knobA, knobB].forEach(knob => {
                    if(knob.dataset.listening) return;
                    knob.dataset.listening = "true";
                    knob.addEventListener("pointerdown", (e) => this.onKnobPointerDown(e));
                });
            });
        },

        onKnobPointerDown: function(e) {
            e.preventDefault(); e.stopPropagation();
            const knob = e.target;
            const track = knob.closest(".alert-slider-track");
            const isA = knob.dataset.knob === "a";
            const otherKnob = track.querySelector(isA ? '[data-knob="b"]' : '[data-knob="a"]');
            knob.setPointerCapture(e.pointerId);
            const onMove = (ev) => {
                const rect = track.getBoundingClientRect();
                let x = ev.clientX - rect.left;
                x = Math.max(0, Math.min(rect.width, x));
                let pct = (x / rect.width) * 100;
                const otherPct = parseFloat(otherKnob.style.left) || (isA ? 100 : 0);
                const gap = 5; 
                if (isA) { if (pct > otherPct - gap) pct = otherPct - gap; }
                else { if (pct < otherPct + gap) pct = otherPct + gap; }
                pct = Math.max(0, Math.min(100, pct));
                knob.style.left = pct + "%";
                this.updateAlertVisuals(track); 
            };
            const onUp = (ev) => {
                knob.releasePointerCapture(ev.pointerId);
                knob.removeEventListener("pointermove", onMove);
                knob.removeEventListener("pointerup", onUp);
                const key = track.dataset.slider;
                const knobA = track.querySelector('[data-knob="a"]');
                const knobB = track.querySelector('[data-knob="b"]');
                this.setValue(key, { a: parseFloat(knobA.style.left), b: parseFloat(knobB.style.left) });
            };
            knob.addEventListener("pointermove", onMove);
            knob.addEventListener("pointerup", onUp);
        },

        // ========================================================
        // DRAWER RESIZE
        // ========================================================
        initResizeLogic: function() {
            const drawer = this.ui.drawer;
            const host = this.root;
            const handleTop = drawer.querySelector("#fwh-resize-y-top");
            const handleBottom = drawer.querySelector("#fwh-resize-y-bottom");
            const handleSide = drawer.querySelector("#fwh-resize-x");
            let mode = null, startX=0, startY=0, startW=0, startH=0, rafId=null;
            const onPointerDown = (m, e) => {
                e.preventDefault(); mode = m; drawer.classList.add("resizing");
                startX = e.clientX; startY = e.clientY; startW = drawer.offsetWidth; startH = drawer.offsetHeight;
                e.target.setPointerCapture(e.pointerId);
                e.target.addEventListener("pointermove", onPointerMove);
                e.target.addEventListener("pointerup", onPointerUp);
            };
            const onPointerMove = (e) => {
                if (!mode) return; e.preventDefault();
                const currentX=e.clientX, currentY=e.clientY;
                if (rafId) return; 
                rafId = requestAnimationFrame(() => {
                    rafId = null;
                    const minH=200, maxH=window.innerHeight*0.9, minW=230, maxW=420;
                    const dx=currentX-startX, dy=currentY-startY;
                    if (mode==="height-top" || mode==="height-bottom") {
                        let h=startH + (mode==="height-bottom" ? dy : -dy);
                        h=Math.max(minH,Math.min(maxH,h));
                        drawer.style.height=h+"px"; host.style.setProperty("--drawer-height",h+"px");
                    }
                    if (mode==="width") {
                        const isLeft=drawer.classList.contains("left");
                        let w=startW + (isLeft?dx:-dx);
                        w=Math.max(minW,Math.min(maxW,w));
                        drawer.style.width=w+"px"; host.style.setProperty("--drawer-width",w+"px");
                    }
                });
            };
            const onPointerUp = (e) => {
                if (!mode) return; if (rafId) { cancelAnimationFrame(rafId); rafId=null; }
                const t = e.target; t.releasePointerCapture(e.pointerId);
                t.removeEventListener("pointermove", onPointerMove);
                t.removeEventListener("pointerup", onPointerUp);
                drawer.classList.remove("resizing");
                this.setValue("DRAWER_HEIGHT", drawer.style.height);
                this.setValue("DRAWER_WIDTH", drawer.style.width);
                mode = null;
            };
            handleTop.addEventListener("pointerdown", e => onPointerDown("height-top", e));
            handleBottom.addEventListener("pointerdown", e => onPointerDown("height-bottom", e));
            handleSide.addEventListener("pointerdown", e => onPointerDown("width", e));
        },

        // ========================================================
        // MAIN MENU SETTINGS
        // ========================================================
        openMainMenu: function() {
            const panel = this.ui.drawer.querySelector("#fwh-panel");
            const side = this.getValue("DRAWER_SIDE", "left");
            const apiKey = localStorage.getItem("WAR_API_KEY");

            panel.innerHTML = `
                <div class="card" style="padding:14px;">
                    <h2 style="margin-top:0;margin-bottom:4px;">Faction War Hub Settings</h2>
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                        Managed by Nexus Core
                    </div>
                    <div class="settings-group">
                        <div class="settings-group-title">Display & Layout</div>
                        <div class="setting-row setting-row-range">
                            <div class="setting-label"><div>Button Width</div></div>
                            <div class="setting-control"><input id="fwh-btn-width" type="range" min="32" max="96" class="settings-range"></div>
                        </div>
                        <div class="setting-row setting-row-range">
                            <div class="setting-label"><div>Button Height</div></div>
                            <div class="setting-control"><input id="fwh-btn-height" type="range" min="32" max="96" class="settings-range"></div>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Drawer Side</div>
                            <select id="fwh-drawer-side" style="padding:6px;background:var(--bg-alt);color:var(--text);border:1px solid var(--border);border-radius:6px;">
                                <option value="left">Left</option><option value="right">Right</option>
                            </select>
                        </div>
                    </div>
                </div>`;

            const sideSelect = this.shadow.querySelector("#fwh-drawer-side");
            const btnWidthInput = this.shadow.querySelector("#fwh-btn-width");
            const btnHeightInput = this.shadow.querySelector("#fwh-btn-height");

            const updateUIFromInputs = () => {
                const bw = Number(btnWidthInput.value);
                const bh = Number(btnHeightInput.value);
                this.ui.toggleButton.style.width = bw + "px";
                this.ui.toggleButton.style.height = bh + "px";
                this.updateToggleButtonIconSize();
                this.setValue("BTN_WIDTH", bw);
                this.setValue("BTN_HEIGHT", bh);
            };

            btnWidthInput.value = this.getValue("BTN_WIDTH", 48);
            btnHeightInput.value = this.getValue("BTN_HEIGHT", 48);
            btnWidthInput.addEventListener("input", updateUIFromInputs);
            btnHeightInput.addEventListener("input", updateUIFromInputs);
            if (sideSelect) {
                sideSelect.value = side;
                sideSelect.addEventListener("change", () => {
                    const val = sideSelect.value;
                    this.setValue("DRAWER_SIDE", val);
                    this.ui.drawer.classList.remove("left", "right");
                    this.ui.drawer.classList.add(val);
                });
            }
        },

        showInitialApiPopupIfNeeded: function(){
            const existing = localStorage.getItem('WAR_API_KEY');
            if (existing) return;
            this.buildApiPopup();
        },
        
        buildApiPopup: function(){
             // Simplified for this version since General handles it, but kept for robustness
             const apiKey = prompt("Enter Torn API Key for UI Data:");
             if(apiKey) {
                 localStorage.setItem('WAR_API_KEY', apiKey);
                 location.reload();
             }
        },

        // ========================================================
        // STYLES
        // ========================================================
        getStyles: function(height, width) {
            return `
            @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");
            :host { --drawer-height: ${height}; --drawer-width: ${width}; --bg: #101214; --bg-alt: #16191d; --bg-panel: #1b1f23; --bg-hover: #22272c; --border: #2b2f34; --text: #e6e6e6; --text-muted: #9ba3ab; --accent: #52a8ff; --accent-glow: rgba(82,168,255,0.45); --radius: 8px; font-family: "Inter", sans-serif; will-change: height, width; }
            * { box-sizing: border-box; }
            .fwh-toggle-btn { position: fixed; bottom: 14px; left: 10px; width: 48px; height: 48px; background: linear-gradient(180deg,#1a7a3a 0%,#0f6a32 40%,#0b4c23 100%); border-radius: 12px; border: 1px solid #063018; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.35); cursor: pointer; z-index: 999999; transition: transform .15s, filter .15s; }
            .fwh-toggle-btn:hover { filter: brightness(1.1); transform: translateY(-2px); }
            .fwh-drawer { position: fixed; top: 50%; height: var(--drawer-height); width: var(--drawer-width); background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 0 18px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; z-index: 999999999; transition: transform .25s ease; }
            .fwh-drawer.left { left: 0; transform: translate(-100%,-50%); } .fwh-drawer.left.open { transform: translate(0,-50%); }
            .fwh-drawer.right { right: 0; transform: translate(100%,-50%); } .fwh-drawer.right.open { transform: translate(0,-50%); }
            .fwh-d-header { padding: 12px 14px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 600; }
            .fwh-header-btns { display:flex; gap:8px; } .fwh-header-icon { cursor: pointer; padding: 5px 8px; border-radius: 6px; } .fwh-header-icon:hover { background: var(--bg-hover); }
            .fwh-tabs { display:flex; overflow-x:auto; background: var(--bg-alt); border-bottom:1px solid var(--border); scrollbar-width:none; }
            .fwh-tab-btn { padding:10px 14px; border-right:1px solid var(--border); font-size:13px; cursor:pointer; color: var(--text-muted); } .fwh-tab-btn.active { background:var(--accent); color:#000; font-weight:600; }
            .fwh-tab-panel { flex:1; padding:12px; overflow-y:auto; color: var(--text); }
            .card { background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); padding:12px; margin-bottom:12px; }
            table.fwh-table { width:100%; border-collapse:collapse; font-size:12px; } table.fwh-table th { background:var(--bg-alt); padding:8px; text-align:left; position: sticky; top: 0; } table.fwh-table td { padding:8px; border-bottom:1px solid var(--border); color:var(--text-muted); }
            .fwh-resize-x { position: absolute; top: 0; right: -10px; height: 100%; width: 20px; cursor: ew-resize; z-index: 100; } .fwh-drawer.left .fwh-resize-x { right: -10px; } .fwh-drawer.right .fwh-resize-x { left: -10px; }
            .fwh-resize-y-top { position: absolute; top: -10px; left: 0; width: 100%; height: 20px; cursor: ns-resize; z-index: 100; } .fwh-resize-y-bottom { position: absolute; bottom: -10px; left: 0; width: 100%; height: 20px; cursor: ns-resize; z-index: 100; }
            .dashboard-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; } .dash-tile { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:10px; } .dash-title { font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom: 5px; } .dash-value { font-size:16px; font-weight:700; margin-bottom: 5px; } .dash-row { display:flex; justify-content:space-between; font-size:12px; margin-top: 2px;} .dash-subtext { color: var(--text-muted); }
            .chain-hud { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:14px; display:flex; flex-direction:column; gap:12px; height:100%; }
            .chain-hud-head { display:flex; justify-content:space-between; align-items:center; } .chain-title { font-size:18px; font-weight:700; }
            .chain-bar { position:relative; width:100%; height:32px; background:#777; border-radius:20px; overflow:hidden; } .chain-bar-fill { position:absolute; left:0; top:0; height:100%; background:#40d66b; transition:width .25s; } .chain-bar-text { position:absolute; width:100%; height:100%; font-weight:700; color:#000; display:flex; align-items:center; justify-content:center; }
            .chain-settings { display:none; padding:8px; height:100%; overflow-y:auto; } .chain-settings-header { display:flex; align-items:center; justify-content:space-between; font-size:16px; font-weight:600; margin-bottom:10px; } .setting-row { display:flex; justify-content:space-between; align-items:center; padding:8px 4px; border-bottom:1px solid var(--border); font-size:13px; }
            .toggle-switch { position:relative; width:42px; height:22px; border-radius:20px; background:#3c3f44; cursor:pointer; transition:background .25s; } .toggle-thumb { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .25s; } .toggle-switch.on { background:var(--accent); } .toggle-switch.on .toggle-thumb { left:22px; }
            .alert-slider-block { padding:10px; background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); margin-top:12px; } .alert-slider-track { position:relative; height:16px; background:repeating-linear-gradient(to right, rgba(255,255,255,0.14), rgba(255,255,255,0.14) 4px, transparent 4px, transparent 8px); border-radius:8px; margin:6px 0 4px 0; cursor: pointer; touch-action: none; } .alert-range-fill { position:absolute; top:0; left:0; height:100%; background:currentColor; opacity:0.3; border-radius: 8px; pointer-events:none; z-index:1; } .alert-knob { position:absolute; top:50%; transform: translate(-50%, -50%); width:20px; height:20px; background:#fff; border-radius:50%; border:2px solid currentColor; cursor:grab; z-index:3; touch-action: none; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }
            .alert-time-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px; } .orange { color:#ffb84a; }
            `;
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Major", Major);
})();
