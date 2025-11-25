/**
 * CODENAME: WAR_MAJOR
 * RANK: ⭐️⭐️ (Senior Officer)
 * MISSION: UI, Dashboard, and User Interaction
 * SOURCE: WarGUI v1.8 (Full Integration)
 */

(function() {
    'use strict';

    const Major = {
        name: "Major (UI/GUI)",
        version: "1.8",
        general: null,
        root: null,
        shadow: null,
        ui: {
            tabs: {}
        },

        // Storage prefix to prevent conflicts
        storagePrefix: "FWH_",

        init: function(General) {
            this.general = General;
            console.log("🛡️ [MAJOR] Booting Faction War Hub GUI v1.8...");

            this.initShadow();
            this.injectStyles();
            this.buildToggle();
            this.buildDrawer();
            this.initTabs();
            this.initResizeLogic();
            this.showInitialApiPopupIfNeeded();

            // Default Tab
            this.switchTab("dashboard");
            console.log("🛡️ [MAJOR] UI Online.");
        },

        // ========================================================
        // STORAGE HELPERS (Replaces GM_getValue/setValue)
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
            
            // Global click listener for delegation
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

            // Icon Sizing Logic
            this.updateToggleButtonIconSize();

            // Click Event
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

            // Close Button
            this.ui.drawer.querySelector("#fwh-close").addEventListener("click", () => {
                this.ui.drawer.classList.remove("open");
            });
        },

        // ========================================================
        // TABS SYSTEM
        // ========================================================
        initTabs: function() {
            this.addTab("dashboard", "Dashboard", this.createDashboardPanel());
            this.addTab("faction", "Faction", this.mkPanel("Faction Roster", ["Name","ID","Level","Rank","Position","Status","Online","Last Action","Notes","Watcher"]));
            this.addTab("targets", "Targets", this.mkPanel("Targets List", ["Name","ID","Status","Level","Faction","Reason","Times Hit","Last Hit","Last Seen","Danger","Priority","Notes"]));
            this.addTab("war", "War", this.mkPanel("War Overview", ["Enemy","Faction ID","Score","Wall HP","Wall Timer","Status","Online","Attacking","Last Taken","Last Given","Notes","Alert"]));
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

            if (id === "chain") {
                this.initAlertSliders();
            }
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
            strip.addEventListener("wheel", e => {
                e.preventDefault();
                strip.scrollLeft += e.deltaY;
            });
        },

        // ========================================================
        // PANEL GENERATORS
        // ========================================================
        mkPanel: function(title, heads) {
            let rows = "";
            for (let i = 0; i < 100; i++) rows += "<tr>" + heads.map(() => `<td style="border-right:1px solid var(--border);">—</td>`).join("") + "</tr>";
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
            el.innerHTML = `
                <div class="dashboard-grid">
                    <div class="dash-tile">
                        <div class="dash-title">Respect</div>
                        <div class="dash-value">—</div>
                        <div class="dash-row"><span>Daily Change</span><span class="dash-subtext">—</span></div>
                        <div class="dash-row"><span>Rank</span><span class="dash-subtext">—</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Online Members</div>
                        <div class="dash-value">— / —</div>
                        <div class="dash-row"><span>Traveling</span><span class="dash-subtext">—</span></div>
                        <div class="dash-row"><span>Hospital</span><span class="dash-subtext">—</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">War Status</div>
                        <div class="dash-value">No Active War</div>
                        <div class="dash-row"><span>Opponent</span><span class="dash-subtext">—</span></div>
                        <div class="dash-row"><span>Score</span><span class="dash-subtext">—</span></div>
                        <div class="dash-row"><span>Wall / Timer</span><span class="dash-subtext">—</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Boosters / Drugs</div>
                        <div class="dash-row"><span>Booster CD</span><span class="dash-subtext">—</span></div>
                        <div class="dash-row"><span>Drug CD</span><span class="dash-subtext">—</span></div>
                        <div class="dash-row"><span>Next Refill</span><span class="dash-subtext">—</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Quick Links</div>
                        <div class="dash-links">
                            <div class="dash-link" data-link="crimes">Crimes</div>
                            <div class="dash-link" data-link="gym">Gym</div>
                            <div class="dash-link" data-link="armory">Armory</div>
                            <div class="dash-link" data-link="items">Items</div>
                            <div class="dash-link" data-link="hospital">Hospital</div>
                        </div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Alerts</div>
                        <div class="dash-subtext">No alerts configured yet.</div>
                    </div>
                </div>`;
            return el;
        },

        // ========================================================
        // CHAIN PANEL & HELPERS
        // ========================================================
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
                    <div class="chain-bar">
                        <div class="chain-bar-fill energy-fill" id="chain-energy-fill" style="width:70%;"></div>
                        <div class="chain-bar-text" id="chain-energy-text">E: 400 / 150</div>
                    </div>
                    <div class="chain-xp-bar">
                        <div class="chain-xp-fill" id="chain-xp-fill" style="width:40%;"></div>
                    </div>
                </div>
                <div class="chain-settings" id="chain-settings">
                    <div class="chain-settings-header" id="chain-settings-header"></div>
                    <div class="chain-settings-section">GENERAL SETTINGS</div>
                    ${toggleRow("Sound Alerts","chain-sound")}
                    ${toggleRow("Notifications","chain-notify")}
                    ${toggleRow("Vibration","chain-vibrate")}
                    <div class="chain-settings-section">PANIC MODE</div>
                    ${toggleRow("Enable Panic Mode","chain-panic")}
                    ${toggleRow("Trigger Panic Attack","chain-panic-trigger")}
                    <div class="chain-settings-section">API FAILURE</div>
                    ${toggleRow("API Failure Check","chain-api-fail")}
                    <div class="chain-settings-section">ALERT LEVELS</div>
                    ${alertSliderBlock("Orange Alert – Caution","orange","00:30","02:00","chain-orange1")}
                    ${alertSliderBlock("Orange Alert – Warning","orange","00:30","02:00","chain-orange2")}
                    ${alertSliderBlock("Red Alert – Caution","red","00:00","01:00","chain-red1")}
                    ${alertSliderBlock("Red Alert – Warning","red","00:00","01:00","chain-red2")}
                </div>`;
            return el;
        },

        handleGlobalClicks: function(e) {
            const toggle = e.target.closest(".toggle-switch");
            if (toggle && toggle.hasAttribute("data-toggle")) {
                toggle.classList.toggle("on");
                // TODO: Save setting state
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
            if (side === "left") {
                header.innerHTML = `<div class="chain-back-btn" id="chain-back-btn">←</div><div>Chain Settings</div>`;
            } else {
                header.innerHTML = `<div>Chain Settings</div><div class="chain-back-btn" id="chain-back-btn">→</div>`;
            }
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
                    // Bind 'this' to the event handler
                    knob.addEventListener("pointerdown", (e) => this.onKnobPointerDown(e));
                });
            });
        },

        onKnobPointerDown: function(e) {
            e.preventDefault();
            e.stopPropagation();
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
                if (isA) {
                    if (pct > otherPct - gap) pct = otherPct - gap;
                } else {
                    if (pct < otherPct + gap) pct = otherPct + gap;
                }
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
                this.setValue(key, {
                    a: parseFloat(knobA.style.left),
                    b: parseFloat(knobB.style.left)
                });
            };
            
            knob.addEventListener("pointermove", onMove);
            knob.addEventListener("pointerup", onUp);
        },

        // ========================================================
        // DRAWER RESIZE LOGIC
        // ========================================================
        initResizeLogic: function() {
            const drawer = this.ui.drawer;
            const host = this.root;
            const handleTop = drawer.querySelector("#fwh-resize-y-top");
            const handleBottom = drawer.querySelector("#fwh-resize-y-bottom");
            const handleSide = drawer.querySelector("#fwh-resize-x");
            
            let mode = null;
            let startX = 0, startY = 0, startW = 0, startH = 0;
            let rafId = null;

            const onPointerDown = (m, e) => {
                e.preventDefault();
                mode = m;
                drawer.classList.add("resizing");
                startX = e.clientX;
                startY = e.clientY;
                startW = drawer.offsetWidth;
                startH = drawer.offsetHeight;
                
                e.target.setPointerCapture(e.pointerId);
                e.target.addEventListener("pointermove", onPointerMove);
                e.target.addEventListener("pointerup", onPointerUp);
            };

            const onPointerMove = (e) => {
                if (!mode) return;
                e.preventDefault();
                const currentX = e.clientX;
                const currentY = e.clientY;
                if (rafId) return; 

                rafId = requestAnimationFrame(() => {
                    rafId = null;
                    const minH = 200, maxH = window.innerHeight * 0.9;
                    const minW = 230, maxW = 420;
                    const dx = currentX - startX;
                    const dy = currentY - startY;

                    if (mode === "height-top" || mode === "height-bottom") {
                        let h = startH;
                        h += mode === "height-bottom" ? dy : -dy;
                        h = Math.max(minH, Math.min(maxH, h));
                        drawer.style.height = h + "px";
                        host.style.setProperty("--drawer-height", h + "px");
                    }
                    if (mode === "width") {
                        const isLeft = drawer.classList.contains("left");
                        let w = startW;
                        w += isLeft ? dx : -dx;
                        w = Math.max(minW, Math.min(maxW, w));
                        drawer.style.width = w + "px";
                        host.style.setProperty("--drawer-width", w + "px");
                    }
                });
            };

            const onPointerUp = (e) => {
                if (!mode) return;
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
                
                const target = e.target;
                target.releasePointerCapture(e.pointerId);
                target.removeEventListener("pointermove", onPointerMove);
                target.removeEventListener("pointerup", onPointerUp);
                
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
            // API key is handled by Lieutenant now, but for display:
            const apiKey = this.getValue("API_KEY", "");

            panel.innerHTML = `
                <div class="card" style="padding:14px;">
                    <h2 style="margin-top:0;margin-bottom:4px;">Faction War Hub Settings</h2>
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                        Tweak layout and connection options.
                    </div>

                    <div class="settings-group">
                        <div class="settings-group-title">Display & Layout</div>
                        <div class="setting-row setting-row-range">
                            <div class="setting-label"><div>Button Width</div></div>
                            <div class="setting-control">
                                <input id="fwh-btn-width" type="range" min="32" max="96" class="settings-range">
                                <span class="range-value" id="fwh-btn-width-val"></span>
                            </div>
                        </div>
                        <div class="setting-row setting-row-range">
                            <div class="setting-label"><div>Button Height</div></div>
                            <div class="setting-control">
                                <input id="fwh-btn-height" type="range" min="32" max="96" class="settings-range">
                                <span class="range-value" id="fwh-btn-height-val"></span>
                            </div>
                        </div>
                        <div class="setting-row">
                            <div class="setting-label">Drawer Side</div>
                            <select id="fwh-drawer-side" style="padding:6px;background:var(--bg-alt);color:var(--text);border:1px solid var(--border);border-radius:6px;">
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                    </div>

                    <div class="settings-group">
                        <div class="settings-group-title">API & Advanced</div>
                        <div class="setting-row">
                            <div class="setting-label">API Key</div>
                            <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
                                <input id="fwh-api-input" class="fwh-modal-input" type="text" placeholder="Managed by Nexus Core" value="${apiKey ? apiKey : ""}" disabled>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
                           <button id="fwh-api-clear" class="fwh-btn">Force Clear Cache</button>
                        </div>
                    </div>
                </div>`;

            const sideSelect = this.shadow.querySelector("#fwh-drawer-side");
            const btnWidthInput = this.shadow.querySelector("#fwh-btn-width");
            const btnHeightInput = this.shadow.querySelector("#fwh-btn-height");
            const btnWidthVal = this.shadow.querySelector("#fwh-btn-width-val");
            const btnHeightVal = this.shadow.querySelector("#fwh-btn-height-val");

            const currentBtnW = this.getValue("BTN_WIDTH", 48);
            const currentBtnH = this.getValue("BTN_HEIGHT", 48);

            const updateUIFromInputs = () => {
                const bw = Number(btnWidthInput.value);
                const bh = Number(btnHeightInput.value);

                btnWidthVal.textContent = bw + "px";
                btnHeightVal.textContent = bh + "px";

                this.ui.toggleButton.style.width = bw + "px";
                this.ui.toggleButton.style.height = bh + "px";
                this.updateToggleButtonIconSize();

                this.setValue("BTN_WIDTH", bw);
                this.setValue("BTN_HEIGHT", bh);
            };

            btnWidthInput.value = currentBtnW;
            btnHeightInput.value = currentBtnH;
            updateUIFromInputs();

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

        // ========================================================
        // API POPUP
        // ========================================================
        showInitialApiPopupIfNeeded: function(){
            // We check the Nexus General Key here
            const existing = localStorage.getItem('WAR_API_KEY');
            const skipped = this.getValue("API_SKIP", false);
            if (existing || skipped) return;
            this.buildApiPopup();
        },

        buildApiPopup: function(){
            let overlay = this.shadow.querySelector("#fwh-api-modal");
            if (overlay) overlay.remove();
            overlay = document.createElement("div");
            overlay.id = "fwh-api-modal";
            overlay.className = "fwh-modal-backdrop";
            
            overlay.innerHTML = `
                <div class="fwh-modal">
                    <div class="fwh-modal-title">Torn API Key</div>
                    <div class="fwh-modal-text">Enter your Torn API key to enable live faction, chain, and war data.</div>
                    <input id="fwh-api-modal-input" class="fwh-modal-input" type="text" placeholder="Enter Torn API key">
                    <div class="fwh-disclaimer-small">Stores locally in browser. Do not share.</div>
                    <div class="fwh-modal-actions">
                        <button id="fwh-api-modal-skip" class="fwh-btn">Continue limited</button>
                        <button id="fwh-api-modal-save" class="fwh-btn fwh-btn-accent">Save & Continue</button>
                    </div>
                </div>`;
            this.shadow.appendChild(overlay);

            const input = overlay.querySelector("#fwh-api-modal-input");
            const saveBtn = overlay.querySelector("#fwh-api-modal-save");
            const skipBtn = overlay.querySelector("#fwh-api-modal-skip");

            if (saveBtn && input) {
                saveBtn.addEventListener("click", () => {
                    const val = input.value.trim();
                    if (!val) { alert("Please enter a valid API key or continue in limited mode."); return; }
                    localStorage.setItem('WAR_API_KEY', val); // Save to Nexus Global
                    this.setValue("API_SKIP", false);
                    overlay.remove();
                    alert("API key saved. Reloading...");
                    location.reload();
                });
            }
            if (skipBtn) {
                skipBtn.addEventListener("click", () => {
                    this.setValue("API_SKIP", true);
                    overlay.remove();
                });
            }
        },

        // ========================================================
        // STYLES (EXACT COPY)
        // ========================================================
        getStyles: function(height, width) {
            return `
            @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

            :host {
                --drawer-height: ${height};
                --drawer-width: ${width};
                --bg: #101214;
                --bg-alt: #16191d;
                --bg-panel: #1b1f23;
                --bg-hover: #22272c;
                --border: #2b2f34;
                --text: #e6e6e6;
                --text-muted: #9ba3ab;
                --accent: #52a8ff;
                --accent-glow: rgba(82,168,255,0.45);
                --radius: 8px;
                font-family: "Inter", sans-serif;
                will-change: height, width;
            }
            * { box-sizing: border-box; }

            .fwh-toggle-btn {
                position: fixed;
                bottom: 14px;
                left: 10px;
                width: 48px;
                height: 48px;
                background: linear-gradient(180deg,#1a7a3a 0%,#0f6a32 40%,#0b4c23 100%);
                border-radius: 12px;
                border: 1px solid #063018;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.35), 0 0 10px rgba(0,0,0,0.25), inset 0 2px 3px rgba(255,255,255,0.12), inset 0 -3px 5px rgba(0,0,0,0.35);
                cursor: pointer;
                z-index: 999999998;
                transition: transform .15s, filter .15s, box-shadow .2s;
                touch-action: none;
            }
            .fwh-toggle-btn:hover { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.45), 0 0 14px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.14), inset 0 -3px 6px rgba(0,0,0,0.4); }
            .fwh-toggle-btn:active { filter: brightness(0.92); transform: translateY(0); }

            .fwh-drawer {
                position: fixed;
                top: 50%;
                height: var(--drawer-height);
                width: var(--drawer-width);
                background: var(--bg-panel);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                box-shadow: 0 0 18px rgba(0,0,0,0.6);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                z-index: 999999999;
                transition: transform .25s ease, height .15s ease, width .15s ease;
                will-change: height, width;
            }
            .fwh-drawer.resizing { transition: none !important; user-select: none; }
            .fwh-drawer.left { left: 0; transform: translate(-100%,-50%); }
            .fwh-drawer.left.open { transform: translate(0,-50%); }
            .fwh-drawer.right { right: 0; transform: translate(100%,-50%); }
            .fwh-drawer.right.open { transform: translate(0,-50%); }

            /* INCREASED HIT AREA TO 30px, OFFSET TO CENTER */
            .fwh-resize-y-top, .fwh-resize-y-bottom { position: absolute; left: 0; width: 100%; height: 30px; cursor: ns-resize; background: transparent; z-index: 999999; touch-action: none; }
            .fwh-resize-y-top { top: -15px; }
            .fwh-resize-y-bottom { bottom: -15px; }
            
            .fwh-resize-x { position: absolute; top: 0; height: 100%; width: 30px; background: transparent; cursor: ew-resize; z-index: 999999; touch-action: none; }
            .fwh-drawer.left .fwh-resize-x { right: -15px; }
            .fwh-drawer.right .fwh-resize-x { left: -15px; }
            
            .fwh-resize-y-top:hover, .fwh-resize-y-bottom:hover, .fwh-resize-x:hover { background: rgba(255,255,255,0.05); }

            .fwh-d-header { padding: 12px 14px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 600; z-index: 10; touch-action: none; }
            .fwh-header-btns { display:flex; gap:8px; }
            .fwh-header-icon { cursor: pointer; padding: 5px 8px; border-radius: 6px; transition: background .2s, transform .15s; }
            .fwh-header-icon:hover { background: var(--bg-hover); transform: scale(1.1); }

            .fwh-tabs { display:flex; overflow-x:auto; white-space:nowrap; scrollbar-width:none; border-bottom:1px solid var(--border); user-select:none; z-index:9; touch-action: pan-x; }
            .fwh-tabs::-webkit-scrollbar{display:none;}
            .fwh-tab-btn { padding:10px 14px; background:var(--bg-alt); border-right:1px solid var(--border); font-size:13px; cursor:pointer; transition:background .25s, transform .15s; }
            .fwh-tab-btn:hover { background:var(--bg-hover); transform:translateY(-2px); }
            .fwh-tab-btn.active { background:var(--accent); color:#000; font-weight:600; text-shadow:0 0 6px var(--accent-glow); box-shadow:inset 0 -2px 0 #ffffff33; }

            .fwh-tab-panel { flex:1; padding:12px; overflow-y:auto; overflow-x:hidden; position:relative; display:flex; flex-direction:column; min-height:0; }
            .card { background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); padding:12px; margin-bottom:12px; }
            .fwh-btn { display:inline-block; padding:7px 10px; margin:4px 4px 0 0; border-radius:6px; border:1px solid var(--border); background:var(--bg-alt); cursor:pointer; font-size:12px; font-weight:500; transition:background .2s, transform .1s, box-shadow .2s; }
            .fwh-btn:hover { background:var(--bg-hover); transform:translateY(-1px); box-shadow:0 0 6px rgba(0,0,0,0.4); }
            .fwh-btn-accent { background:var(--accent); color:#000; border-color:var(--accent); }

            table.fwh-table { width:100%; border-collapse:collapse; background:var(--bg); font-size:12px; }
            table.fwh-table th { background:var(--bg-alt); padding:10px 8px; height:30px; border-bottom:1px solid var(--border); text-align:left; font-weight:600; }
            table.fwh-table td { padding:10px 8px; height:34px; border-bottom:1px solid var(--border); color:var(--text-muted); }
            table.fwh-table tr:hover td { background:var(--bg-hover); }

            .scroll-table-container { flex:1; min-height:150px; height:calc(var(--drawer-height) - 130px); max-height:calc(var(--drawer-height) - 130px); overflow-y:auto; border-radius:var(--radius); border:1px solid var(--border); }
            .scroll-table { width:100%; border-collapse:collapse; }
            .scroll-table thead { position:sticky; top:0; z-index:5; background:var(--bg-alt); box-shadow:0 2px 4px rgba(0,0,0,0.4); }

            .dashboard-wrap { flex:1; display:flex; flex-direction:column; overflow-y:auto; min-height:0; }
            .dashboard-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .dash-tile { background:var(--bg); border-radius:var(--radius); border:1px solid var(--border); padding:10px; display:flex; flex-direction:column; gap:4px; }
            .dash-title { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); }
            .dash-value { font-size:18px; font-weight:700; }
            .dash-subtext { font-size:12px; color:var(--text-muted); }
            .dash-row { display:flex; justify-content:space-between; font-size:12px; }
            .dash-links { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
            .dash-link { padding:6px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-alt); font-size:12px; cursor:pointer; transition:background .2s, transform .1s; }
            .dash-link:hover { background:var(--bg-hover); transform:translateY(-1px); }

            .chain-hud { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:14px; display:flex; flex-direction:column; gap:12px; height:100%; }
            .chain-hud-head { display:flex; justify-content:space-between; align-items:center; }
            .chain-title { font-size:18px; font-weight:700; }
            .chain-icon { font-size:22px; cursor:pointer; opacity:.8; transition:transform .15s, opacity .15s; }
            .chain-icon:hover { transform:scale(1.1); opacity:1; }
            .chain-bar { position:relative; width:100%; height:32px; background:#777; border-radius:20px; overflow:hidden; }
            .chain-bar-fill { position:absolute; left:0; top:0; height:100%; background:#40d66b; transition:width .25s; }
            .energy-fill { background:#3fd15f!important; }
            .chain-bar-text { position:absolute; width:100%; height:100%; font-weight:700; color:#000; display:flex; align-items:center; justify-content:center; }
            .chain-xp-bar { width:100%; height:8px; background:#4a4a4a; border-radius:4px; overflow:hidden; }
            .chain-xp-fill { height:100%; background:#d4ffd0; transition:width .25s; }

            .chain-settings { display:none; padding:8px; height:100%; overflow-y:auto; }
            .chain-settings-header { display:flex; align-items:center; justify-content:space-between; font-size:16px; font-weight:600; margin-bottom:10px; }
            .chain-back-btn { font-size:18px; cursor:pointer; padding:4px 8px; }
            .chain-settings-section { font-size:12px; color:var(--text-muted); margin-top:14px; margin-bottom:4px; text-align:center; letter-spacing:.08em; }
            .setting-row { display:flex; justify-content:space-between; align-items:center; padding:8px 4px; border-bottom:1px solid var(--border); font-size:13px; }
            .setting-label { font-size:13px; }

            .toggle-switch { position:relative; width:42px; height:22px; border-radius:20px; background:#3c3f44; cursor:pointer; transition:background .25s; }
            .toggle-thumb { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .25s; }
            .toggle-switch.on { background:var(--accent); }
            .toggle-switch.on .toggle-thumb { left:22px; }

            .alert-slider-block { padding:10px; background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); margin-top:12px; }
            .alert-label { font-weight:600; margin-bottom:6px; display:flex; align-items:center; gap:6px; font-size:13px; }
            .alert-slider-track { position:relative; height:16px; background:repeating-linear-gradient(to right, rgba(255,255,255,0.14), rgba(255,255,255,0.14) 4px, transparent 4px, transparent 8px); border-radius:8px; margin:6px 0 4px 0; cursor: pointer; touch-action: none; }
            .alert-range-fill { position:absolute; top:0; left:0; height:100%; background:currentColor; opacity:0.3; border-radius: 8px; pointer-events:none; z-index:1; }
            .alert-knob { position:absolute; top:50%; transform: translate(-50%, -50%); width:20px; height:20px; background:#fff; border-radius:50%; border:2px solid currentColor; cursor:grab; z-index:3; touch-action: none; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }
            .alert-knob:active { cursor:grabbing; scale: 1.1; }
            .alert-time-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px; }
            .orange { color:#ffb84a; }
            .red { color:#ff4a4a; }

            .fwh-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 1000000000; }
            .fwh-modal { background: var(--bg-panel); border-radius: var(--radius); border: 1px solid var(--border); width: 360px; max-width: 90%; padding: 16px 18px; box-shadow: 0 0 18px rgba(0,0,0,0.75); display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
            .fwh-modal-title { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
            .fwh-modal-text { font-size: 12px; color: var(--text-muted); }
            .fwh-modal-input { width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); margin-top: 4px; font-size: 13px; }
            .fwh-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

            .settings-group { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
            .settings-group:first-of-type { border-top: none; padding-top: 0; }
            .settings-group-title { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--text-muted); margin-bottom: 2px; }
            .settings-group-desc { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; }
            .setting-row-range { align-items: flex-start; }
            .setting-row-range .setting-label { flex: 1; }
            .setting-row-range .setting-control { flex: 1.3; display: flex; align-items: center; gap: 8px; }
            .setting-subtext { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
            .settings-range { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 999px; background: var(--bg-alt); outline: none; }
            .settings-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px #000; cursor: pointer; }
            .settings-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px #000; cursor: pointer; }
            .settings-range::-moz-range-track { height: 4px; border-radius: 999px; background: var(--bg-alt); }
            .range-value { font-size: 11px; color: var(--text-muted); min-width: 52px; text-align: right; }
            .fwh-disclaimer-small { font-size: 11px; color: var(--text-muted); margin-top: 4px; line-height: 1.3; }
            `;
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Major", Major);

})();
