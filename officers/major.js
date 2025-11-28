/********************************************************************
 * MAJOR v8.0 "BLACK OPS" EDITION
 ********************************************************************/

(function() {
"use strict";

/* ============================================================
   SAFE BOOTSTRAP
   ============================================================ */
function waitForGeneral(attempt = 0) {
    if (window.WAR_GENERAL && typeof window.WAR_GENERAL.register === "function") {
        console.log("%c[MAJOR] CONNECTION ESTABLISHED.", "color: #00f3ff; background: #000; padding: 4px;");
        startMajor();
        return;
    }

    const delay = Math.min(1000, 100 * Math.pow(1.5, attempt));
    if (attempt < 120) {
        setTimeout(() => waitForGeneral(attempt + 1), delay);
    } else {
        console.error("[MAJOR] CONNECTION FAILED. WAR_GENERAL NOT FOUND.");
    }
}
waitForGeneral();

/* ============================================================
   START MAJOR
   ============================================================ */
function startMajor() {

class Major {
    constructor() {
        this.general = null;
        
        this.host = null;
        this.shadow = null;

        this.drawerEl = null;
        this.drawerOpen = false;
        this.drawerSide = "left";

        this.buttonEl = null;
        this.dragging = false;
        this._isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.activeTab = "main";
        this.targetSubTab = "personal"; // personal | war | shared
        this.tabsContainer = null;
        this.panelsContainer = null;

        this.mutationObserver = null;

        // Officer Connection Tracking
        this.officerStatus = {
            general: "ONLINE",
            lieutenant: "OFFLINE",
            sergeant: "OFFLINE",
            colonel: "OFFLINE"
        };

        this.intervals = [];
        this.boundHandlers = new Map();
    }

    /* ============================================================
       CORE INITIALIZATION
       ============================================================ */
    init(General) {
        this.general = General;

        this.createHost();
        this.renderBaseHTML();
        this.applyBaseStyles();      // Layout & Structure
        this.applyExtendedStyles();  // The "Badass" Visuals

        this.attachButtonLogic();
        this.attachDragLogic();
        this.attachResizeObserver();

        this.startInlineScanner();
        this.startSitrepRouter();
        this.startOfficerReadyListener();

        // Restore Settings if available
        const savedSide = localStorage.getItem("nexus_drawer_side");
        if(savedSide) {
            this.drawerSide = savedSide;
            this.updateDrawerSide();
        }

        this.finalizeUI();

        if (this.general?.signals) {
            this.general.signals.dispatch("UI_READY", {});
            this.general.signals.dispatch("MAJOR_READY", { version: "8.0" });
        }
    }

    finalizeUI() {
        this.buildColonelPanel();
        this.buildSettingsPanel();
        this.attachSettingsLogic();
        this.renderActivePanel();
    }

    /* ============================================================
       CLEANUP
       ============================================================ */
    destroy() {
        this.intervals.forEach(id => clearInterval(id));
        if (this.mutationObserver) this.mutationObserver.disconnect();
        
        this.boundHandlers.forEach((handler, event) => {
            window.removeEventListener(event, handler);
        });
        
        if (this.host?.parentNode) this.host.remove();
        this.host = null;
    }

    /* ============================================================
       HTML STRUCTURE
       ============================================================ */
    createHost() {
        if (this.host) return;
        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "999999";
        this.host.style.top = "0"; 
        this.host.style.left = "0";
        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    renderBaseHTML() {
        this.shadow.innerHTML = `
            <div id="nexus-container">
                <button id="nexus-toggle" class="nexus-btn">
                    <div class="scanner-line"></div>
                    <span class="btn-icon">N</span>
                </button>
                <div id="nexus-drawer">
                    <div class="drawer-header">
                        <div class="header-glitch">WAR NEXUS // SYS.V8</div>
                        <div class="header-controls">
                            <span id="close-drawer" class="control-btn">×</span>
                        </div>
                    </div>
                    <div class="drawer-subheader">
                        <span id="conn-status" class="status-online">CONNECTED</span>
                        <span id="clock-display">00:00:00</span>
                    </div>
                    <div id="nexus-tabs"></div>
                    <div id="nexus-panels"></div>
                </div>
            </div>
        `;

        this.drawerEl = this.shadow.querySelector("#nexus-drawer");
        this.buttonEl = this.shadow.querySelector("#nexus-toggle");
        this.tabsContainer = this.shadow.querySelector("#nexus-tabs");
        this.panelsContainer = this.shadow.querySelector("#nexus-panels");

        // Clock
        setInterval(() => {
            const el = this.shadow.querySelector("#clock-display");
            if(el) el.textContent = new Date().toLocaleTimeString('en-US', {hour12:false});
        }, 1000);

        this.shadow.querySelector("#close-drawer").addEventListener("click", () => this.toggleDrawer());

        this.buildTabs();
        this.buildPanels();
    }

    /* ============================================================
       STYLING (THE "BADASS" PART)
       ============================================================ */
    applyBaseStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; font-family: 'Segoe UI', Roboto, sans-serif; --c-neon: #00f3ff; --c-alert: #ff003c; --c-warn: #ffcc00; --c-bg: #0a0b10; --c-panel: rgba(16, 20, 25, 0.9); }
            * { box-sizing: border-box; }
            
            /* DRAWER */
            #nexus-drawer {
                position: fixed; top: 0; width: 400px; height: 100vh;
                background: var(--c-bg);
                border-right: 2px solid var(--c-neon);
                transform: translateX(-100%);
                transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
                display: flex; flex-direction: column;
                box-shadow: 0 0 30px rgba(0, 243, 255, 0.15);
                backdrop-filter: blur(10px);
                z-index: 10000;
            }
            #nexus-drawer.right { border-right: none; border-left: 2px solid var(--c-neon); transform: translateX(100%); }
            .drawer-open-left { transform: translateX(0) !important; }
            .drawer-open-right { transform: translateX(0) !important; }

            /* HEADER */
            .drawer-header {
                padding: 15px; background: linear-gradient(90deg, rgba(0,243,255,0.1), transparent);
                border-bottom: 1px solid var(--c-neon);
                display: flex; justify-content: space-between; align-items: center;
            }
            .header-glitch { 
                font-family: 'Courier New', monospace; font-weight: 900; font-size: 18px; 
                letter-spacing: 2px; color: var(--c-neon); text-shadow: 0 0 5px var(--c-neon);
            }
            .control-btn { color: #fff; font-size: 24px; cursor: pointer; transition: 0.2s; }
            .control-btn:hover { color: var(--c-alert); text-shadow: 0 0 8px var(--c-alert); }

            .drawer-subheader {
                padding: 4px 15px; background: #000; display: flex; justify-content: space-between;
                font-size: 10px; font-family: monospace; color: #555; border-bottom: 1px solid #333;
            }
            .status-online { color: #0f0; }

            /* TABS */
            #nexus-tabs { display: flex; flex-wrap: wrap; background: #050505; }
            .nexus-tab {
                flex: 1; background: transparent; border: none; color: #666; padding: 12px 5px;
                cursor: pointer; font-size: 11px; text-transform: uppercase; font-weight: bold;
                border-bottom: 2px solid transparent; transition: 0.2s;
            }
            .nexus-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
            .nexus-tab.active { color: var(--c-neon); border-bottom: 2px solid var(--c-neon); background: rgba(0, 243, 255, 0.1); }

            /* PANELS */
            #nexus-panels { flex: 1; overflow-y: auto; padding: 15px; }
            #nexus-panels::-webkit-scrollbar { width: 4px; }
            #nexus-panels::-webkit-scrollbar-thumb { background: var(--c-neon); }

            /* TOGGLE BUTTON */
            .nexus-btn {
                position: fixed; bottom: 20px; left: 20px; width: 56px; height: 56px;
                background: #000; border: 2px solid var(--c-neon); border-radius: 50%;
                color: var(--c-neon); font-weight: bold; cursor: pointer; z-index: 10000;
                box-shadow: 0 0 15px rgba(0,243,255,0.4); overflow: hidden;
                display: flex; justify-content: center; align-items: center; font-size: 20px;
                transition: transform 0.1s;
            }
            .nexus-btn:active { transform: scale(0.95); }
            .nexus-btn:hover { box-shadow: 0 0 25px var(--c-neon); }
            .scanner-line {
                position: absolute; width: 100%; height: 2px; background: rgba(0,243,255,0.8);
                top: 0; animation: scan 2s linear infinite; opacity: 0.5;
            }
            @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        `;
        this.shadow.appendChild(style);
    }

    applyExtendedStyles() {
        const style = document.createElement("style");
        style.textContent = `
            /* TILES */
            .tile {
                background: linear-gradient(135deg, rgba(20,20,20,0.9) 0%, rgba(10,10,10,0.95) 100%);
                border: 1px solid #333; border-left: 3px solid #333;
                margin-bottom: 12px; padding: 12px; position: relative;
                box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            }
            .tile:hover { border-left-color: var(--c-neon); }
            .tile h3 {
                margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
                color: #888; border-bottom: 1px solid #222; padding-bottom: 4px; display: flex; justify-content: space-between;
            }

            /* GRIDS */
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .stat-box { text-align: center; background: rgba(0,0,0,0.3); padding: 8px; border: 1px solid #222; }
            .stat-val { font-size: 16px; color: #fff; font-weight: bold; }
            .stat-lbl { font-size: 10px; color: #666; text-transform: uppercase; }

            /* TABLES */
            .nexus-table { width: 100%; border-collapse: collapse; font-size: 12px; color: #ccc; }
            .nexus-table th { text-align: left; color: var(--c-neon); border-bottom: 1px solid #444; padding: 6px; font-size: 10px; text-transform: uppercase; }
            .nexus-table td { padding: 6px; border-bottom: 1px solid #222; }
            .nexus-table tr:hover td { background: rgba(255,255,255,0.05); color: #fff; }

            /* BADGES & DOTS */
            .badge { padding: 2px 6px; border-radius: 2px; font-size: 9px; font-weight: bold; border: 1px solid transparent; }
            .badge-hos { background: rgba(100,0,0,0.3); border-color: #f00; color: #f55; }
            .badge-ok  { background: rgba(0,50,0,0.3); border-color: #0f0; color: #5f5; }
            .badge-travel { color: #aaa; border: 1px solid #444; }
            
            .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; box-shadow: 0 0 4px currentColor; }
            .dot-on { background: #0f0; color: #0f0; }
            .dot-off { background: #555; color: #555; box-shadow: none; }
            
            /* ACTION BUTTONS */
            .act-btn { cursor: pointer; color: #888; transition: 0.2s; margin: 0 3px; font-size: 14px; }
            .act-btn:hover { color: #fff; transform: scale(1.2); display: inline-block; text-shadow: 0 0 5px #fff; }
            .act-att:hover { color: var(--c-alert); text-shadow: 0 0 5px var(--c-alert); }
            
            /* PROGRESS BARS */
            .prog-track { width: 100%; height: 4px; background: #222; margin-top: 5px; position: relative; overflow: hidden; }
            .prog-fill { height: 100%; background: var(--c-neon); width: 0%; box-shadow: 0 0 8px var(--c-neon); transition: width 0.5s linear; }
            .prog-fill.danger { background: var(--c-alert); box-shadow: 0 0 8px var(--c-alert); }

            /* CHAT (COLONEL) */
            .chat-window {
                height: 350px; overflow-y: auto; background: #000; border: 1px solid #333;
                padding: 10px; font-family: 'Courier New', monospace; font-size: 12px;
                display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;
            }
            .msg { padding: 8px; border-radius: 2px; max-width: 85%; line-height: 1.4; position: relative; }
            .msg::before { content: ''; position: absolute; width: 0; height: 0; border-style: solid; }
            
            .msg-user { align-self: flex-end; background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.3); color: #def; }
            .msg-ai   { align-self: flex-start; background: rgba(255, 100, 0, 0.1); border: 1px solid rgba(255, 100, 0, 0.3); color: #fbda; }
            
            .chat-input-area { display: flex; gap: 5px; }
            .chat-input { flex: 1; background: #111; border: 1px solid #333; color: var(--c-neon); padding: 8px; font-family: monospace; outline: none; }
            .chat-input:focus { border-color: var(--c-neon); }
            .chat-send { background: #222; border: 1px solid #333; color: var(--c-neon); cursor: pointer; padding: 0 15px; font-weight: bold; transition: 0.2s; }
            .chat-send:hover { background: var(--c-neon); color: #000; }

            /* INLINE ICONS */
            .nexus-inline-wrap { margin-left: 8px; display: inline-flex; gap: 2px; vertical-align: middle; }
            .inline-btn { 
                width: 18px; height: 18px; border-radius: 50%; font-size: 10px; 
                display: flex; align-items: center; justify-content: center; 
                cursor: pointer; border: 1px solid #555; color: #aaa; background: #000;
            }
            .inline-btn:hover { border-color: var(--c-neon); color: var(--c-neon); }
        `;
        this.shadow.appendChild(style);
    }

    /* ============================================================
       TABS SETUP
       ============================================================ */
    buildTabs() {
        this.tabsContainer.innerHTML = `
            <button class="nexus-tab active" data-tab="main">Status</button>
            <button class="nexus-tab" data-tab="chain">Chain</button>
            <button class="nexus-tab" data-tab="targets">Targets</button>
            <button class="nexus-tab" data-tab="colonel">AI Uplink</button>
            <button class="nexus-tab" data-tab="settings">Config</button>
        `;

        this.tabsContainer.querySelectorAll(".nexus-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                this.shadow.querySelectorAll(".nexus-tab").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.activeTab = btn.dataset.tab;
                this.renderActivePanel();
            });
        });
    }

    buildPanels() {
        this.panelsContainer.innerHTML = `
            <div id="panel-main"></div>
            <div id="panel-chain"></div>
            <div id="panel-targets"></div>
            <div id="panel-colonel"></div>
            <div id="panel-settings"></div>
        `;
    }

    renderActivePanel() {
        this.shadow.querySelectorAll("[id^='panel-']").forEach(p => p.style.display = "none");
        const p = this.shadow.querySelector(`#panel-${this.activeTab}`);
        if(p) p.style.display = "block";
    }

    /* ============================================================
       FEATURE: MAIN STATUS DASHBOARD
       ============================================================ */
    updateUserUI(user) {
        const p = this.shadow.querySelector("#panel-main");
        if (!p) return;

        p.innerHTML = `
            <div class="tile">
                <h3>OPERATOR STATUS <span style="color:var(--c-neon)">${this.sanitize(user.name)}</span></h3>
                <div class="grid-2">
                    <div class="stat-box">
                        <div class="stat-val">${this.sanitize(user.level)}</div>
                        <div class="stat-lbl">Level</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-val" style="color:${user.hp < user.max_hp ? '#f55':'#0f0'}">${user.hp} / ${user.max_hp}</div>
                        <div class="stat-lbl">Health</div>
                    </div>
                </div>
                <div style="margin-top:10px; font-size:12px; color:#aaa;">
                    Status: ${this.renderStatusBadge(user.status)} <br>
                    Energy: ${user.energy} / ${user.max_energy} <br>
                    Nerve: ${user.nerve} / ${user.max_nerve}
                </div>
            </div>

            <div class="tile">
                <h3>THREAT ASSESSMENT</h3>
                <div style="text-align:center; padding:10px;">
                    <span style="font-size:24px; font-weight:900; color:${user.threat > 50 ? '#f00' : '#fa0'}">
                        ${this.sanitize(user.threat)}%
                    </span>
                    <div class="prog-track">
                        <div class="prog-fill ${user.threat > 70 ? 'danger':''}" style="width:${user.threat}%"></div>
                    </div>
                </div>
            </div>

            <div class="tile">
                <h3>GLOBAL HEATMAP</h3>
                <canvas id="heatmap-main" width="350" height="60" style="width:100%; height:60px; image-rendering: pixelated;"></canvas>
            </div>
        `;
    }

    /* ============================================================
       FEATURE: CHAIN COMMAND (ALERTS & INFO)
       ============================================================ */
    updateChainUI(chain = {}) {
        const p = this.shadow.querySelector("#panel-chain");
        if (!p) return;

        const timeLeft = chain.timeLeft || 0; // seconds
        const maxTime = 300; // standard 5 min chain
        const pct = Math.min(100, Math.max(0, (timeLeft / maxTime) * 100));
        const color = timeLeft < 60 ? 'var(--c-alert)' : 'var(--c-neon)';
        
        let alertBox = "";
        if (timeLeft > 0 && timeLeft < 90) {
            alertBox = `<div style="background:rgba(255,0,0,0.2); border:1px solid #f00; color:#f55; padding:10px; text-align:center; font-weight:bold; animation:pulse 1s infinite;">
                ⚠ CRITICAL TIMEOUT WARNING ⚠
            </div>`;
        }

        p.innerHTML = `
            ${alertBox}
            <div class="tile">
                <h3>CHAIN METRICS</h3>
                <div class="grid-2">
                    <div class="stat-box">
                        <div class="stat-val" style="color:var(--c-neon); font-size:24px;">${chain.hits || 0}</div>
                        <div class="stat-lbl">CURRENT HITS</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-val" style="color:${color}">${this.formatTime(timeLeft)}</div>
                        <div class="stat-lbl">TIMEOUT</div>
                    </div>
                </div>
                <div class="prog-track" style="margin-top:10px;">
                    <div class="prog-fill" style="width:${pct}%; background:${color}; box-shadow:0 0 10px ${color};"></div>
                </div>
            </div>
            
            <div class="tile">
                <h3>TACTICAL LOG</h3>
                <div id="chain-log-container" style="max-height:200px; overflow-y:auto; font-size:11px; font-family:monospace;"></div>
            </div>
        `;

        if(chain.log) this.renderChainLog(chain.log);
    }

    renderChainLog(log) {
        const container = this.shadow.querySelector("#chain-log-container");
        if(!container || !log) return;
        
        container.innerHTML = log.map(entry => `
            <div style="border-bottom:1px solid #222; padding:3px 0; color:#888;">
                <span style="color:#fff;">${this.sanitize(entry.player)}</span> 
                <span style="color:var(--c-neon)">+${entry.respect}</span>
                <span style="float:right">${new Date(entry.time).toLocaleTimeString()}</span>
            </div>
        `).join("");
    }

    /* ============================================================
       FEATURE: ADVANCED TARGETING SYSTEM
       ============================================================ */
    renderTargetTables(targets = { personal:[], war:[], shared:[] }) {
        const p = this.shadow.querySelector("#panel-targets");
        if (!p) return;

        // Sub-tabs for targets
        const current = this.targetSubTab;
        const btnStyle = (key) => `flex:1; background:${current===key?'var(--c-neon)':'#111'}; color:${current===key?'#000':'#888'}; border:1px solid #333; cursor:pointer; padding:6px; font-weight:bold;`;

        p.innerHTML = `
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <button class="t-sub" data-key="personal" style="${btnStyle('personal')}">PERSONAL</button>
                <button class="t-sub" data-key="war" style="${btnStyle('war')}">WAR</button>
                <button class="t-sub" data-key="shared" style="${btnStyle('shared')}">SHARED</button>
            </div>
            <div id="target-list-container"></div>
        `;

        // Attach listeners
        p.querySelectorAll(".t-sub").forEach(b => {
            b.addEventListener("click", () => {
                this.targetSubTab = b.dataset.key;
                this.renderTargetTables(targets); // re-render
            });
        });

        this.renderTargetList(targets[this.targetSubTab] || []);
    }

    renderTargetList(list) {
        const container = this.shadow.querySelector("#target-list-container");
        if(!container) return;

        if(list.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#555;">NO TARGETS DESIGNATED</div>`;
            return;
        }

        const rows = list.map(t => `
            <tr>
                <td>${this.renderOnlineIndicator(t.onlineState)}</td>
                <td style="color:#fff; font-weight:bold;">${this.sanitize(t.name)}</td>
                <td><span class="badge badge-travel">Lv${t.level}</span></td>
                <td>${this.renderStatusBadge(t.status)}</td>
                <td style="text-align:right;">
                    <span class="act-btn act-att" data-id="${t.id}" title="Attack">⚔</span>
                    <span class="act-btn act-ana" data-id="${t.id}" title="Spy">👁</span>
                </td>
            </tr>
        `).join("");

        container.innerHTML = `
            <table class="nexus-table">
                <thead><tr><th>STS</th><th>NAME</th><th>LVL</th><th>STATE</th><th style="text-align:right">ACT</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        this.attachActionListeners(container);
    }

    /* ============================================================
       FEATURE: AI / COLONEL UPLINK
       ============================================================ */
    buildColonelPanel() {
        const p = this.shadow.querySelector("#panel-colonel");
        if (!p) return;

        p.innerHTML = `
            <div class="tile" style="border:none; background:transparent; padding:0;">
                <div class="chat-window" id="col-chat">
                    <div class="msg msg-ai">
                        <strong>COLONEL AI:</strong> Uplink established. I am monitoring global war metrics. Awaiting query.
                    </div>
                </div>
                <div class="chat-input-area">
                    <input type="text" id="col-input" class="chat-input" placeholder="Enter command or query...">
                    <button id="col-send" class="chat-send">TX</button>
                </div>
            </div>
        `;

        const input = p.querySelector("#col-input");
        const send = p.querySelector("#col-send");

        const tx = () => {
            const val = input.value.trim();
            if(!val) return;
            this.addChatMessage("user", val);
            this.general?.signals?.dispatch("ASK_COLONEL", { question: val });
            input.value = "";
        };

        send.addEventListener("click", tx);
        input.addEventListener("keydown", e => { if(e.key === "Enter") tx(); });
    }

    addChatMessage(type, text) {
        const win = this.shadow.querySelector("#col-chat");
        if(!win) return;
        
        const div = document.createElement("div");
        div.className = `msg msg-${type === 'user' ? 'user' : 'ai'}`;
        div.innerHTML = `<strong>${type==='user'?'OPERATOR':'COLONEL'}:</strong> ${this.sanitize(text)}`;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
    }

    /* ============================================================
       SETTINGS & UTILS
       ============================================================ */
    buildSettingsPanel() {
        const p = this.shadow.querySelector("#panel-settings");
        if(!p) return;
        p.innerHTML = `
            <div class="tile">
                <h3>INTERFACE CONFIG</h3>
                <label style="display:block; padding:10px; color:#ccc;">
                    Dock Side
                    <select id="set-side" style="float:right; background:#000; color:var(--c-neon); border:1px solid #333;">
                        <option value="left">LEFT</option>
                        <option value="right">RIGHT</option>
                    </select>
                </label>
            </div>
            <div style="text-align:center; margin-top:30px; color:#444; font-size:10px;">
                MAJOR v8.0 BLACK OPS<br>AUTHORIZED USE ONLY
            </div>
        `;
    }

    attachSettingsLogic() {
        const sel = this.shadow.querySelector("#set-side");
        if(sel) {
            sel.value = this.drawerSide;
            sel.addEventListener("change", () => {
                this.drawerSide = sel.value;
                localStorage.setItem("nexus_drawer_side", sel.value);
                this.updateDrawerSide();
            });
        }
    }

    /* ============================================================
       HELPER LOGIC (Drag, Sitrep, XSS)
       ============================================================ */
    sanitize(str) {
        if (str === null || str === undefined) return "";
        const temp = document.createElement('div');
        temp.textContent = String(str);
        return temp.innerHTML;
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0'+s : s}`;
    }

    renderStatusBadge(st) {
        const s = (st || "").toLowerCase();
        if (s.includes("hospital")) return `<span class="badge badge-hos">HOSP</span>`;
        if (s.includes("jail")) return `<span class="badge badge-travel">JAIL</span>`; // Reusing style for now
        if (s.includes("travel")) return `<span class="badge badge-travel">TRAVEL</span>`;
        if (s.includes("online") || s.includes("okay")) return `<span class="badge badge-ok">ACTIVE</span>`;
        return `<span class="badge" style="color:#555">OFFLINE</span>`;
    }

    renderOnlineIndicator(state) {
        if(state === 'online') return `<span class="dot dot-on"></span>`;
        return `<span class="dot dot-off"></span>`;
    }

    /* Routing Data from General */
    startSitrepRouter() {
        if(!this.general?.signals) return;
        const sig = this.general.signals;

        sig.listen("SITREP_UPDATE", d => {
            if(d.user) this.updateUserUI(d.user);
            if(d.chain) this.updateChainUI(d.chain);
            if(d.targets) this.renderTargetTables(d.targets);
        });

        sig.listen("GLOBAL_SITREP_READY", d => {
            // Draw heatmap
            if(d.heatmap) {
                const cvs = this.shadow.querySelector("#heatmap-main");
                if(cvs) this.drawHeatmap(cvs, d.heatmap);
            }
        });

        sig.listen("ASK_COLONEL_RESPONSE", d => {
            if(d.answer) this.addChatMessage("ai", d.answer);
        });
    }
    
    drawHeatmap(canvas, data) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0,0,w,h);
        const bw = w / data.length;
        const max = Math.max(...data, 1);
        
        data.forEach((val, i) => {
            const hPct = val / max;
            const alpha = Math.max(0.1, hPct);
            ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
            ctx.fillRect(i*bw, h - (h*hPct), bw, h*hPct);
        });
    }

    /* Actions */
    attachActionListeners(root) {
        root.querySelectorAll(".act-att").forEach(b => {
            b.addEventListener("click", () => window.location.href = `/loader.php?sid=attack&user2ID=${b.dataset.id}`);
        });
        root.querySelectorAll(".act-ana").forEach(b => {
            b.addEventListener("click", () => this.general.signals.dispatch("REQUEST_PLAYER_SITREP", {id: b.dataset.id}));
        });
    }

    /* Button Dragging */
    attachDragLogic() {
        const btn = this.buttonEl;
        const start = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            e.preventDefault();
            this.dragging = true;
            this._isDragging = true;
            const t = e.touches ? e.touches[0] : e;
            const r = btn.getBoundingClientRect();
            this.dragOffsetX = t.clientX - r.left;
            this.dragOffsetY = t.clientY - r.top;
            
            const move = (ev) => {
                const p = ev.touches ? ev.touches[0] : ev;
                btn.style.left = (p.clientX - this.dragOffsetX) + "px";
                btn.style.top = (p.clientY - this.dragOffsetY) + "px";
                btn.style.bottom = "auto";
            };
            const stop = () => {
                this.dragging = false;
                setTimeout(() => this._isDragging = false, 100);
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", stop);
                window.removeEventListener("touchmove", move);
                window.removeEventListener("touchend", stop);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", stop);
            window.addEventListener("touchmove", move, {passive:false});
            window.addEventListener("touchend", stop);
        };
        btn.addEventListener("mousedown", start);
        btn.addEventListener("touchstart", start, {passive:false});
    }
    
    attachButtonLogic() {
        this.buttonEl.addEventListener("click", (e) => {
            if(!this._isDragging) this.toggleDrawer();
        });
    }

    toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
        this.updateDrawerSide();
    }

    updateDrawerSide() {
        const cls = this.drawerSide === "right" ? 
            (this.drawerOpen ? "drawer-open-right" : "") + " right" : 
            (this.drawerOpen ? "drawer-open-left" : "");
        this.drawerEl.className = cls;
    }

    attachResizeObserver() {
        window.addEventListener("resize", () => this.updateDrawerSide());
    }

    /* Inline Scanner */
    startInlineScanner() {
        // Simple simplified version for 8.0
        const obs = new MutationObserver((muts) => {
            muts.forEach(m => m.addedNodes.forEach(n => {
                if(n.nodeType === 1) this.scanNode(n);
            }));
        });
        obs.observe(document.body, {childList:true, subtree:true});
        this.scanNode(document.body);
        this.mutationObserver = obs;
    }

    scanNode(root) {
        if(!root.querySelectorAll) return;
        root.querySelectorAll("a[href*='profiles.php?XID=']").forEach(a => {
            if(a.dataset.nexus) return;
            const id = a.href.match(/XID=(\d+)/)?.[1];
            if(!id) return;
            a.dataset.nexus = "1";
            
            const span = document.createElement("span");
            span.className = "nexus-inline-wrap";
            span.innerHTML = `
                <div class="inline-btn act-att" data-id="${id}" title="Attack">⚔</div>
                <div class="inline-btn act-ana" data-id="${id}" title="Spy">👁</div>
            `;
            a.after(span);
            this.attachActionListeners(span);
        });
    }
    
    startOfficerReadyListener() {
        if(this.general?.signals) {
            this.general.signals.listen("OFFICER_READY", d => console.log(`[MAJOR] Officer Online: ${d.name}`));
            setTimeout(() => this.general.signals.dispatch("OFFICER_READY", {name:"Major", version:"8.0"}), 500);
        }
    }

} // End Class

/* ============================================================
   REGISTER
   ============================================================ */
if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Major", Major);
}

} // End startMajor
})();
