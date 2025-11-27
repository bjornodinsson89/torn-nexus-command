/********************************************************************
 *  MAJOR v5.0 – FULL GUI OFFICER (Base CARBON-TECH THEME)
 ********************************************************************/

(function() {

class Major {

    constructor() {
        this.general = null;

        // DOM Root
        this.host = null;
        this.root = null;

        // UI Elements
        this.drawer = null;
        this.toggleBtn = null;
        this.tabs = {};
        this.activeTab = "dashboard";

        // Settings
        this.settings = {
            drawerSide: localStorage.getItem("warroom_drawerSide") || "left",
            toggleX: Number(localStorage.getItem("war_toggle_x") || 25),
            toggleY: Number(localStorage.getItem("war_toggle_y") || 150),
            panicThreshold: Number(localStorage.getItem("war_panic_threshold") || 25)
        };

        // Listeners
        this.listeners = [];
        this.intervals = [];

        // Drag state
        this._isDragging = false;
        this._dragMoved = false;

        // Cached data for rendering
        this.cache = {
            chain: null,
            factionMembers: {},
            war: null,
            sharedTargets: []
        };
    }

    /**************************************************************
     * INIT
     **************************************************************/
    init(G) {
        this.cleanup();
        this.general = G;

        this.createHost();
        this.createShadow();
        this.injectStyles();

        this.createToggleButton();
        this.createDrawer();
        this.buildTabs();
        this.buildPanels();
        this.registerSignals();

        this.activateTab("dashboard");

        console.log("%c[Major v5.0] GUI Online (Carbon-Tech Mode)", "color:#0f6");
    }

    /**************************************************************
     * HOST + SHADOW DOM
     **************************************************************/
    createHost() {
        let host = document.getElementById("war-room-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "war-room-host";
            host.style.position = "fixed";
            host.style.top = "0";
            host.style.left = "0";
            host.style.width = "0";
            host.style.height = "0";
            host.style.zIndex = "999999";
            document.body.appendChild(host);
        }
        this.host = host;
    }

    createShadow() {
        this.root = this.host.shadowRoot || this.host.attachShadow({ mode: "open" });
    }

    /**************************************************************
     * FULL CARBON-TECH CSS
     **************************************************************/
    injectStyles() {
        const style = document.createElement("style");
        style.textContent = `

        :host {
            --bg: #0e0e0e;
            --panel: #1a1a1a;
            --accent: #00ff66;
            --accent2: #33ff99;
            --danger: #ff3355;
            --text: #e0ffe0;
            --subtext: #88cc99;
            --border: #00cc55;
            --scroll: #044;
            --scrollthumb: #0a5;
            font-family: Consolas, monospace;
        }

        /* TOGGLE BUTTON */
        #wr-toggle-btn {
            position: fixed;
            width: 42px;
            height: 42px;
            background: #0f0f0f;
            color: var(--accent);
            font-size: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            border: 2px solid var(--accent);
            cursor: pointer;
            z-index: 9999999;
            user-select: none;
            box-shadow: 0 0 8px var(--accent2);
            transition: box-shadow .2s;
        }
        #wr-toggle-btn:hover {
            box-shadow: 0 0 12px var(--accent2);
        }

        /* DRAWER */
        #wr-drawer {
            position: fixed;
            top: 0;
            height: 100vh;
            width: 350px;
            background: var(--panel);
            color: var(--text);
            border-right: 2px solid var(--accent);
            border-left: 2px solid var(--accent);
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            z-index: 9999998;
            display: flex;
            flex-direction: column;
            box-shadow: 0 0 25px #0f0 inset;
        }
        #wr-drawer.right {
            left: auto;
            right: 0;
            border-left: none;
            border-right: 2px solid var(--accent);
            transform: translateX(100%);
        }
        #wr-drawer.open.left {
            transform: translateX(0);
        }
        #wr-drawer.open.right {
            transform: translateX(0);
        }

        /* HEADER */
        #wr-header {
            padding: 12px;
            background: #111;
            border-bottom: 2px solid var(--accent);
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            letter-spacing: 1px;
        }

        /* TABS */
        #wr-tabs {
            display: flex;
            background: #111;
            border-bottom: 1px solid var(--accent);
        }
        .wr-tab {
            padding: 10px 14px;
            cursor: pointer;
            flex: 1;
            text-align: center;
            font-size: 13px;
            color: var(--subtext);
            border-bottom: 2px solid transparent;
            user-select: none;
        }
        .wr-tab.active {
            background: #0a0a0a;
            color: var(--accent);
            border-bottom: 2px solid var(--accent);
        }

        /* PANELS */
        .wr-panel {
            flex: 1;
            overflow-y: auto;
            padding: 14px;
            display: none;
            background: var(--bg);
        }
        .wr-panel.active {
            display: block;
        }
        .wr-panel::-webkit-scrollbar { width: 8px; }
        .wr-panel::-webkit-scrollbar-track { background: var(--scroll); }
        .wr-panel::-webkit-scrollbar-thumb { background: var(--scrollthumb); }

        /* CHAIN HUD */
        .chain-hud {
            padding: 12px;
            border: 1px solid var(--accent);
            border-radius: 6px;
            background: #000;
            box-shadow: 0 0 8px #0f4 inset;
            margin-bottom: 12px;
        }
        .chain-title {
            font-size: 16px;
            color: var(--accent2);
            margin-bottom: 6px;
        }
        .chain-bar {
            background: #222;
            height: 20px;
            border-radius: 10px;
            position: relative;
            overflow: hidden;
        }
        .chain-bar-fill {
            height: 100%;
            background: var(--accent);
            transition: width 0.25s;
        }
        .chain-bar-text {
            position: absolute;
            top: 0; left: 0; width: 100%;
            text-align: center;
            font-size: 12px;
            line-height: 20px;
            color: #000;
            font-weight: bold;
        }

        .panic {
            box-shadow: 0 0 12px var(--danger);
            border-color: var(--danger);
        }

        /* TABLES */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        th {
            text-align: left;
            color: var(--accent2);
            padding: 4px;
            border-bottom: 1px solid var(--accent);
        }
        td {
            padding: 4px;
            border-bottom: 1px solid #1a1;
        }
        tr:hover {
            background: rgba(0, 255, 102, 0.07);
        }
        .row-danger {
            color: var(--danger);
        }

        /* SETTINGS SLIDERS */
        .setting-row {
            margin-bottom: 10px;
        }
        .setting-label {
            margin-bottom: 4px;
            color: var(--accent);
        }
        input[type=range] {
            width: 100%;
        }
        #drawerSideBtn {
            margin-top: 10px;
            padding: 6px;
            background: #111;
            border: 1px solid var(--accent);
            color: var(--accent2);
            cursor: pointer;
            width: 100%;
        }

        `;
        this.root.appendChild(style);
    }

    /**************************************************************
     * TOGGLE BUTTON (drag + click separation)
     **************************************************************/
    createToggleButton() {
        const btn = document.createElement("div");
        btn.id = "wr-toggle-btn";
        btn.textContent = "⚔️";

        btn.style.top = this.settings.toggleY + "px";
        btn.style.left = this.settings.toggleX + "px";

        this.root.appendChild(btn);
        this.toggleBtn = btn;

        this.makeDraggable(btn);

        btn.addEventListener("click", () => {
            if (this._isDragging) return;
            this.toggleDrawer();
        });
    }

    makeDraggable(btn) {
        let sx, sy, ox, oy;

        btn.addEventListener("mousedown", (e) => {
            this._dragMoved = false;
            this._isDragging = false;

            sx = e.clientX;
            sy = e.clientY;
            ox = parseInt(btn.style.left);
            oy = parseInt(btn.style.top);

            const move = (ev) => {
                const dx = ev.clientX - sx;
                const dy = ev.clientY - sy;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    this._dragMoved = true;
                    this._isDragging = true;
                }

                if (this._dragMoved) {
                    btn.style.left = (ox + dx) + "px";
                    btn.style.top = (oy + dy) + "px";
                }
            };

            const up = () => {
                if (this._dragMoved) {
                    localStorage.setItem("war_toggle_x", btn.style.left.replace("px", ""));
                    localStorage.setItem("war_toggle_y", btn.style.top.replace("px", ""));
                }

                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);

                setTimeout(() => this._isDragging = false, 50);
            };

            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        });
    }

    /**************************************************************
     * DRAWER CREATION
     **************************************************************/
    createDrawer() {
        const drawer = document.createElement("div");
        drawer.id = "wr-drawer";

        if (this.settings.drawerSide === "right") {
            drawer.classList.add("right");
        } else {
            drawer.classList.add("left");
        }

        drawer.innerHTML = `
            <div id="wr-header">WAR ROOM</div>
            <div id="wr-tabs"></div>
            <div id="wr-panel-dashboard" class="wr-panel"></div>
            <div id="wr-panel-roster" class="wr-panel"></div>
            <div id="wr-panel-war" class="wr-panel"></div>
            <div id="wr-panel-settings" class="wr-panel"></div>
        `;

        this.root.appendChild(drawer);
        this.drawer = drawer;
    }

    /**************************************************************
     * TABS
     **************************************************************/
    buildTabs() {
        const tabContainer = this.root.querySelector("#wr-tabs");

        this.addTab("dashboard", "Dashboard", tabContainer);
        this.addTab("roster", "Roster", tabContainer);
        this.addTab("war", "War", tabContainer);
        this.addTab("settings", "Settings", tabContainer);
    }

    addTab(id, label, container) {
        const el = document.createElement("div");
        el.className = "wr-tab";
        el.textContent = label;
        el.addEventListener("click", () => this.activateTab(id));
        container.appendChild(el);

        this.tabs[id] = el;
    }

    activateTab(name) {
        this.activeTab = name;

        // Activate highlight
        Object.entries(this.tabs).forEach(([k, btn]) => {
            btn.classList.toggle("active", k === name);
        });

        // Show correct panel
        ["dashboard", "roster", "war", "settings"].forEach(id => {
            const panel = this.root.querySelector(`#wr-panel-${id}`);
            panel.classList.toggle("active", id === name);
        });
    }

    /**************************************************************
     * PANELS BUILDING
     **************************************************************/
    buildPanels() {
        this.buildDashboardPanel();
        this.buildRosterPanel();
        this.buildWarPanel();
        this.buildSettingsPanel();
    }

    /**************************************************************
     * DASHBOARD PANEL
     **************************************************************/
    buildDashboardPanel() {
        const p = this.root.querySelector("#wr-panel-dashboard");
        p.innerHTML = `
            <div class="chain-hud">
                <div class="chain-title">CHAIN <span id="dash-chain-timer">--</span></div>
                <div class="chain-bar">
                    <div class="chain-bar-fill" id="dash-chain-fill" style="width:0%"></div>
                    <div class="chain-bar-text" id="dash-chain-text">-- / --</div>
                </div>
            </div>

            <div class="chain-hud" id="war-summary">
                <div class="chain-title">WAR STATUS</div>
                <div>Wall HP: <span id="dash-wall">--</span></div>
                <div>Score: <span id="dash-score">--</span></div>
            </div>
        `;
    }

    /**************************************************************
     * ROSTER PANEL
     **************************************************************/
    buildRosterPanel() {
        const p = this.root.querySelector("#wr-panel-roster");
        p.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Activity</th>
                        <th>Pos</th>
                    </tr>
                </thead>
                <tbody id="faction-table"></tbody>
            </table>
        `;
    }

    /**************************************************************
     * WAR PANEL
     **************************************************************/
    buildWarPanel() {
        const p = this.root.querySelector("#wr-panel-war");
        p.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Enemy</th>
                        <th>Lvl</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody id="war-table"></tbody>
            </table>
        `;
    }

    /**************************************************************
     * SETTINGS PANEL (SLIDERS + SIDE TOGGLE)
     **************************************************************/
    buildSettingsPanel() {
        const p = this.root.querySelector("#wr-panel-settings");
        p.innerHTML = `
            <div class="setting-row">
                <div class="setting-label">Chain Panic Threshold (seconds)</div>
                <input type="range" id="panicSlider" min="5" max="60" value="${this.settings.panicThreshold}">
                <div id="panicValue">${this.settings.panicThreshold}s</div>
            </div>

            <button id="drawerSideBtn">Switch Drawer Side</button>
        `;

        const slider = p.querySelector("#panicSlider");
        const value = p.querySelector("#panicValue");

        slider.addEventListener("input", () => {
            value.textContent = slider.value + "s";
            this.settings.panicThreshold = Number(slider.value);
            localStorage.setItem("war_panic_threshold", slider.value);
            this.renderChainHUD(); // update visuals immediately
        });

        p.querySelector("#drawerSideBtn").addEventListener("click", () => {
            this.settings.drawerSide = this.settings.drawerSide === "left" ? "right" : "left";
            localStorage.setItem("warroom_drawerSide", this.settings.drawerSide);
            this.updateDrawerSide();
        });
    }

    updateDrawerSide() {
        this.drawer.classList.remove("left", "right");
        this.drawer.classList.add(this.settings.drawerSide);
    }

    /**************************************************************
     * SIGNALS
     **************************************************************/
    registerSignals() {

        // Unified SITREP from Colonel
        this.listen("SITREP_UPDATE", sitrep => {
            this.cache.chain = sitrep.chain || null;
            this.cache.war = sitrep.war || null;

            if (sitrep.faction && sitrep.faction.members) {
                this.cache.factionMembers = sitrep.faction.members;
            }

            this.renderAll();
        });

        // Faction members updates from Sergeant
        this.listen("FACTION_MEMBERS_UPDATE", members => {
            this.cache.factionMembers = members || {};
            this.renderRoster();
        });

        // Shared targets (if used)
        this.listen("SHARED_TARGETS_UPDATED", list => {
            this.cache.sharedTargets = list || [];
        });

    }

    listen(evt, fn) {
        const unsub = this.general.signals.listen(evt, fn);
        this.listeners.push(unsub);
    }

    /**************************************************************
     * RENDERING
     **************************************************************/
    renderAll() {
        this.renderChainHUD();
        this.renderRoster();
        this.renderWar();
    }

    /**************************************************************
     * CHAIN HUD
     **************************************************************/
    renderChainHUD() {
        const chain = this.cache.chain;
        if (!chain) return;

        const timerEl = this.root.querySelector("#dash-chain-timer");
        const fillEl = this.root.querySelector("#dash-chain-fill");
        const textEl = this.root.querySelector("#dash-chain-text");
        const hud = this.root.querySelector(".chain-hud");

        timerEl.textContent = chain.timeout + "s";
        textEl.textContent = `${chain.current} / ${chain.max || "--"}`;

        const pct = chain.max ? (chain.current / chain.max) * 100 : 0;
        fillEl.style.width = pct + "%";

        // Panic threshold handled here
        const isPanic = chain.timeout <= this.settings.panicThreshold;
        hud.classList.toggle("panic", isPanic);
    }

    /**************************************************************
     * ROSTER TABLE
     **************************************************************/
    renderRoster() {
        const members = this.cache.factionMembers;
        const tbody = this.root.querySelector("#faction-table");
        if (!tbody || !members) return;

        let html = "";
        Object.values(members).forEach(m => {
            const isHosp = m.status?.state === "Hospital";
            const rowClass = isHosp ? "row-danger" : "";
            const ts = m.status?.until || 0;
            const time = isHosp ? this.formatTime(ts) : "OK";

            html += `
                <tr class="${rowClass}">
                    <td>${m.name || "??"}</td>
                    <td>${m.status?.state || "--"}</td>
                    <td>${time}</td>
                    <td>${m.last_action?.relative || "--"}</td>
                    <td>${m.position || "-"}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    /**************************************************************
     * WAR TABLE
     **************************************************************/
    renderWar() {
        const war = this.cache.war;
        const tbody = this.root.querySelector("#war-table");
        const wallEl = this.root.querySelector("#dash-wall");
        const scoreEl = this.root.querySelector("#dash-score");

        if (!war || !tbody) return;

        const wall = war?.wall || {};
        wallEl.textContent = wall?.health || "--";

        const scoreA = war?.score?.faction || 0;
        const scoreB = war?.score?.enemy || 0;
        scoreEl.textContent = `${scoreA} / ${scoreB}`;

        if (!war.enemies) {
            tbody.innerHTML = "";
            return;
        }

        let html = "";
        Object.values(war.enemies).forEach(e => {
            const isHosp = e.status?.state === "Hospital";
            const time = e.status?.until ? this.formatTime(e.status.until) : "--";

            html += `
                <tr class="${isHosp ? "row-danger" : ""}">
                    <td>${e.name}</td>
                    <td>${e.level}</td>
                    <td>${e.status?.state || "--"}</td>
                    <td>${time}</td>
                    <td><a href="https://www.torn.com/loader.php?sid=attack&userID=${e.id}" target="_blank">⚔️</a></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    /**************************************************************
     * UTILITIES
     **************************************************************/
    formatTime(ts) {
        const now = Math.floor(Date.now() / 1000);
        let diff = ts - now;
        if (diff <= 0) return "0s";
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        return `${m}m ${s}s`;
    }

    toggleDrawer() {
        this.drawer.classList.toggle("open");
    }

    /**************************************************************
     * CLEANUP
     **************************************************************/
    cleanup() {
        this.listeners.forEach(u => u());
        this.listeners = [];

        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];

        if (this.host) this.host.remove();
        this.host = null;
        this.root = null;
    }
}

/**************************************************************
 * REGISTER
 **************************************************************/
if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Major", new Major());
} else {
    console.warn("[Major] WAR_GENERAL not found.");
}

})();
