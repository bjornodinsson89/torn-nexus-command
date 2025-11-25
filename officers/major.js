/**
 * CODENAME: WAR_MAJOR
 * RANK: ⭐️⭐️ (Senior Officer)
 * MISSION: UI, Dashboard, and User Interaction
 * ORIGIN: Ported from warGUI.js v1.8
 */

(function() {
    'use strict';

    const Major = {
        name: "Major (UI/GUI)",
        general: null,
        root: null,
        shadow: null,
        ui: {},
        
        // Settings for LocalStorage
        storagePrefix: "NEXUS_MAJOR_",

        init: function(General) {
            this.general = General;
            console.log("🛡️ [MAJOR] Initializing Visual Interface...");
            
            this.buildShadowRoot();
            this.injectStyles();
            this.buildToggle();
            this.buildDrawer();
            this.initTabs();
            this.initResizeHandlers();
            
            // Default to Dashboard
            this.switchTab("dashboard");
            
            console.log("🛡️ [MAJOR] UI Deployed.");
        },

        // --- UTILS ---
        setValue: function(key, val) {
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(val));
        },
        getValue: function(key, def) {
            const item = localStorage.getItem(this.storagePrefix + key);
            return item ? JSON.parse(item) : def;
        },

        // --- CORE UI BUILDER ---
        buildShadowRoot: function() {
            this.root = document.createElement("nexus-root");
            document.body.appendChild(this.root);
            this.shadow = this.root.attachShadow({ mode: "open" });
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
            
            // THE BEAR LOGO
            this.ui.toggleButton.innerHTML = `
                <img id="fwh-bear-logo" src="https://i.postimg.cc/fbktXTq2/Bear-head.png"
                     style="object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.6)); width: 70%; height: 70%;">
            `;
            
            this.ui.toggleButton.addEventListener("click", () => {
                this.ui.drawer.classList.toggle("open");
            });

            this.shadow.appendChild(this.ui.toggleButton);
        },

        buildDrawer: function() {
            const initialSide = this.getValue("DRAWER_SIDE", "left");
            this.ui.drawer = document.createElement("div");
            this.ui.drawer.className = `fwh-drawer ${initialSide}`;
            
            this.ui.drawer.innerHTML = `
                <div class="fwh-d-header">
                    <span>Nexus Command</span>
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
            
            this.ui.drawer.querySelector("#fwh-close").addEventListener("click", () => {
                this.ui.drawer.classList.remove("open");
            });
            
            this.shadow.appendChild(this.ui.drawer);
        },

        // --- TABS SYSTEM ---
        tabs: {},
        
        initTabs: function() {
            // Define Tabs
            this.addTab("dashboard", "Dashboard", this.createDashboardPanel());
            this.addTab("faction", "Faction", this.mkPanel("Faction Roster", ["Name","ID","Level","Status","Action"]));
            this.addTab("targets", "Targets", this.mkPanel("Target List", ["Name","ID","Status","Level","Respect"]));
            
            // Make tabs draggable (horizontal scroll)
            const strip = this.ui.drawer.querySelector("#fwh-tabs");
            let isDown = false, startX, scrollLeft;
            
            strip.addEventListener("mousedown", (e) => {
                isDown = true;
                startX = e.pageX - strip.offsetLeft;
                scrollLeft = strip.scrollLeft;
                strip.style.cursor = "grabbing";
            });
            
            window.addEventListener("mouseup", () => {
                isDown = false;
                strip.style.cursor = "default";
            });
            
            strip.addEventListener("mousemove", (e) => {
                if(!isDown) return;
                e.preventDefault();
                const x = e.pageX - strip.offsetLeft;
                const walk = (x - startX) * 1.5;
                strip.scrollLeft = scrollLeft - walk;
            });
        },

        addTab: function(id, name, element) {
            const strip = this.ui.drawer.querySelector("#fwh-tabs");
            const btn = document.createElement("div");
            btn.className = "fwh-tab-btn";
            btn.textContent = name;
            
            btn.addEventListener("click", () => this.switchTab(id));
            
            strip.appendChild(btn);
            this.tabs[id] = { btn, element };
        },

        switchTab: function(id) {
            const panel = this.ui.drawer.querySelector("#fwh-panel");
            // Clear active class
            for (const t in this.tabs) this.tabs[t].btn.classList.remove("active");
            
            if (this.tabs[id]) {
                this.tabs[id].btn.classList.add("active");
                panel.innerHTML = "";
                panel.appendChild(this.tabs[id].element);
            }
        },

        // --- CONTENT GENERATORS ---
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
            el.innerHTML = `
                <div class="dashboard-grid">
                    <div class="dash-tile">
                        <div class="dash-title">Status</div>
                        <div class="dash-value" style="color:#40d66b">Online</div>
                        <div class="dash-row"><span>Nexus Core</span><span class="dash-subtext">Active</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Intel</div>
                        <div class="dash-value">No Data</div>
                        <div class="dash-row"><span>Update in</span><span class="dash-subtext">--</span></div>
                    </div>
                    <div class="dash-tile">
                        <div class="dash-title">Quick Links</div>
                        <div class="dash-links">
                            <div class="dash-link">Gym</div>
                            <div class="dash-link">Crimes</div>
                            <div class="dash-link">Jail</div>
                        </div>
                    </div>
                </div>
            `;
            return el;
        },

        // --- RESIZE LOGIC ---
        initResizeHandlers: function() {
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
                
                // Bind specific listeners
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
                
                e.target.releasePointerCapture(e.pointerId);
                e.target.removeEventListener("pointermove", onPointerMove);
                e.target.removeEventListener("pointerup", onPointerUp);
                
                drawer.classList.remove("resizing");
                this.setValue("DRAWER_HEIGHT", drawer.style.height);
                this.setValue("DRAWER_WIDTH", drawer.style.width);
                mode = null;
            };

            handleTop.addEventListener("pointerdown", e => onPointerDown("height-top", e));
            handleBottom.addEventListener("pointerdown", e => onPointerDown("height-bottom", e));
            handleSide.addEventListener("pointerdown", e => onPointerDown("width", e));
        },

        // --- CSS GENERATOR (The Massive Style Block) ---
        getStyles: function(height, width) {
            return `
            @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");
            :host {
                --drawer-height: ${height};
                --drawer-width: ${width};
                --bg: #101214; --bg-alt: #16191d; --bg-panel: #1b1f23; --bg-hover: #22272c;
                --border: #2b2f34; --text: #e6e6e6; --text-muted: #9ba3ab;
                --accent: #52a8ff; --accent-glow: rgba(82,168,255,0.45);
                --radius: 8px;
                font-family: "Inter", sans-serif;
            }
            * { box-sizing: border-box; }
            
            /* TOGGLE BTN */
            .fwh-toggle-btn {
                position: fixed; bottom: 14px; left: 10px;
                width: 48px; height: 48px;
                background: linear-gradient(180deg,#1a7a3a 0%,#0f6a32 40%,#0b4c23 100%);
                border-radius: 12px; border: 1px solid #063018;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.35); cursor: pointer; z-index: 999999;
                transition: transform .15s, filter .15s;
            }
            .fwh-toggle-btn:hover { filter: brightness(1.1); transform: translateY(-2px); }
            
            /* DRAWER */
            .fwh-drawer {
                position: fixed; top: 50%;
                height: var(--drawer-height); width: var(--drawer-width);
                background: var(--bg-panel); border: 1px solid var(--border);
                border-radius: var(--radius);
                box-shadow: 0 0 18px rgba(0,0,0,0.6);
                display: flex; flex-direction: column; overflow: hidden;
                z-index: 1000000;
                transition: transform .25s ease;
            }
            .fwh-drawer.left { left: 0; transform: translate(-100%,-50%); }
            .fwh-drawer.left.open { transform: translate(0,-50%); }
            
            /* HEADER & TABS */
            .fwh-d-header { padding: 12px 14px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: #fff; }
            .fwh-header-btns { display:flex; gap:8px; cursor: pointer; }
            
            .fwh-tabs { display:flex; overflow-x:auto; background: var(--bg-alt); border-bottom:1px solid var(--border); scrollbar-width:none; }
            .fwh-tab-btn { padding:10px 14px; border-right:1px solid var(--border); font-size:13px; cursor:pointer; color: var(--text-muted); }
            .fwh-tab-btn.active { background:var(--accent); color:#000; font-weight:600; }
            
            /* PANELS */
            .fwh-tab-panel { flex:1; padding:12px; overflow-y:auto; color: var(--text); }
            .card { background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); padding:12px; margin-bottom:12px; }
            
            /* TABLES */
            table.fwh-table { width:100%; border-collapse:collapse; font-size:12px; }
            table.fwh-table th { background:var(--bg-alt); padding:8px; text-align:left; position: sticky; top: 0; }
            table.fwh-table td { padding:8px; border-bottom:1px solid var(--border); color:var(--text-muted); }
            
            /* RESIZE HANDLES */
            .fwh-resize-x { position: absolute; top: 0; right: -10px; height: 100%; width: 20px; cursor: ew-resize; z-index: 100; }
            .fwh-resize-y-top { position: absolute; top: -10px; left: 0; width: 100%; height: 20px; cursor: ns-resize; z-index: 100; }
            .fwh-resize-y-bottom { position: absolute; bottom: -10px; left: 0; width: 100%; height: 20px; cursor: ns-resize; z-index: 100; }
            
            /* DASHBOARD */
            .dashboard-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .dash-tile { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:10px; }
            .dash-title { font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom: 5px; }
            .dash-value { font-size:16px; font-weight:700; margin-bottom: 5px; }
            .dash-row { display:flex; justify-content:space-between; font-size:12px; margin-top: 2px;}
            .dash-subtext { color: var(--text-muted); }
            .dash-links { display: flex; gap: 5px; flex-wrap: wrap; }
            .dash-link { background: var(--bg-alt); padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; border: 1px solid var(--border); }
            .dash-link:hover { background: var(--bg-hover); }
            `;
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Major", Major);

})();
