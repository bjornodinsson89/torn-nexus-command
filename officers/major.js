/********************************************************************
 * MAJOR v8.0 "BLACK OPS" // FORCE UPDATE EDITION
 ********************************************************************/

(function() {
"use strict";

// --- DEBUG CHECK ---
// If you don't see this alert, you are editing the wrong file!
console.log("Attempting to load V8.0...");
/ alert("V8.0 BLACK OPS CODE IS RUNNING"); // Uncomment this if you are really stuck
// -------------------

/* ============================================================
   NUCLEAR CLEANUP (Kills the old Blue UI)
   ============================================================ */
function nukeOldVersions() {
    const oldUI = document.querySelectorAll("#nexus-major-host, #nexus-container");
    if(oldUI.length > 0) {
        console.log("[MAJOR] Found old versions. Nuking...");
        oldUI.forEach(el => el.remove());
    }
}
nukeOldVersions();

/* ============================================================
   SAFE BOOTSTRAP
   ============================================================ */
function waitForGeneral(attempt = 0) {
    if (window.WAR_GENERAL && typeof window.WAR_GENERAL.register === "function") {
        console.log("%c[MAJOR] V8.0 CONNECTED.", "color: #00f3ff; background: #000; padding: 4px; font-weight:bold;");
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
        this.activeTab = "overview"; 
        this.targetSubTab = "personal"; 
        this.factionSort = { key: 'level', dir: 'desc' };
        this.mutationObserver = null;
        this.intervals = [];

        this.store = {
            user: null,
            chain: null,
            faction: [],
            enemies: [],
            targets: { personal:[], war:[], shared:[] },
            heatmap: []
        };
    }

    init(General) {
        nukeOldVersions(); // Run cleanup again just in case
        this.general = General;
        this.createHost();
        this.renderBaseHTML();
        this.applyStyles(); 
        this.attachButtonLogic();
        this.attachDragLogic();
        this.attachResizeObserver();
        this.startInlineScanner();
        this.startSitrepRouter();

        const savedSide = localStorage.getItem("nexus_drawer_side");
        if(savedSide) {
            this.drawerSide = savedSide;
            this.updateDrawerSide();
        }

        this.buildColonelPanel();
        this.renderActivePanel();

        if (this.general?.signals) {
            this.general.signals.dispatch("UI_READY", {});
            this.general.signals.dispatch("MAJOR_READY", { version: "8.0" });
        }
    }

    destroy() {
        this.intervals.forEach(id => clearInterval(id));
        if (this.mutationObserver) this.mutationObserver.disconnect();
        if (this.host?.parentNode) this.host.remove();
    }

    createHost() {
        if (document.getElementById("nexus-major-host")) return;
        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "2147483647"; 
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
                        <div class="header-glitch">WAR NEXUS // V8.0</div>
                        <span id="close-drawer" class="control-btn">×</span>
                    </div>
                    <div id="nexus-tabs">
                        <button class="nexus-tab active" data-tab="overview">OVERVIEW</button>
                        <button class="nexus-tab" data-tab="faction">FACTION</button>
                        <button class="nexus-tab" data-tab="enemy">ENEMIES</button>
                        <button class="nexus-tab" data-tab="chain">CHAIN</button>
                        <button class="nexus-tab" data-tab="targets">TARGETS</button>
                        <button class="nexus-tab" data-tab="colonel">AI UPLINK</button>
                        <button class="nexus-tab" data-tab="settings">CONFIG</button>
                    </div>
                    <div id="nexus-panels">
                        <div id="panel-overview" class="panel active"><div class="loader-text">AWAITING DATALINK...</div></div>
                        <div id="panel-faction" class="panel"></div>
                        <div id="panel-enemy" class="panel"></div>
                        <div id="panel-chain" class="panel"></div>
                        <div id="panel-targets" class="panel"></div>
                        <div id="panel-colonel" class="panel"></div>
                        <div id="panel-settings" class="panel"></div>
                    </div>
                </div>
            </div>
        `;
        this.drawerEl = this.shadow.querySelector("#nexus-drawer");
        this.buttonEl = this.shadow.querySelector("#nexus-toggle");
        
        this.shadow.querySelectorAll(".nexus-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                this.shadow.querySelectorAll(".nexus-tab").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.activeTab = btn.dataset.tab;
                this.renderActivePanel();
            });
        });
        this.shadow.querySelector("#close-drawer").addEventListener("click", () => this.toggleDrawer());
        this.buildSettingsPanel();
    }

    applyStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; font-family: 'Segoe UI', Roboto, sans-serif; --c-neon: #00f3ff; --c-alert: #ff003c; --c-bg: #050505; --c-panel: rgba(20, 25, 30, 0.95); }
            * { box-sizing: border-box; }
            #nexus-drawer { position: fixed; top: 0; width: 420px; height: 100vh; background: var(--c-bg); border-right: 2px solid var(--c-neon); transform: translateX(-100%); transition: transform 0.25s ease; display: flex; flex-direction: column; box-shadow: 0 0 40px rgba(0, 243, 255, 0.1); z-index: 10000; }
            #nexus-drawer.right { border-right: none; border-left: 2px solid var(--c-neon); transform: translateX(100%); }
            .drawer-open-left { transform: translateX(0) !important; }
            .drawer-open-right { transform: translateX(0) !important; }
            .drawer-header { padding: 15px; background: linear-gradient(90deg, rgba(0,243,255,0.15), transparent); border-bottom: 1px solid var(--c-neon); display: flex; justify-content: space-between; align-items: center; }
            .header-glitch { font-family: 'Courier New', monospace; font-weight: 900; font-size: 18px; letter-spacing: 2px; color: var(--c-neon); text-shadow: 0 0 5px var(--c-neon); }
            .control-btn { color: #fff; font-size: 24px; cursor: pointer; }
            #nexus-tabs { display: flex; flex-wrap: wrap; background: #000; border-bottom: 1px solid #333; }
            .nexus-tab { flex: 1; background: transparent; border: none; color: #666; padding: 12px 2px; cursor: pointer; font-size: 10px; font-weight: bold; border-bottom: 2px solid transparent; transition: 0.2s; }
            .nexus-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
            .nexus-tab.active { color: var(--c-neon); border-bottom: 2px solid var(--c-neon); background: rgba(0, 243, 255, 0.05); }
            #nexus-panels { flex: 1; overflow-y: auto; padding: 15px; position: relative; }
            .panel { display: none; animation: fadeIn 0.3s ease; }
            .panel.active { display: block; }
            @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
            .tile { background: linear-gradient(135deg, rgba(20,20,20,0.8) 0%, rgba(10,10,10,0.9) 100%); border: 1px solid #333; border-left: 3px solid #333; margin-bottom: 12px; padding: 12px; position: relative; }
            .tile:hover { border-left-color: var(--c-neon); box-shadow: 0 0 15px rgba(0,0,0,0.5); }
            .tile h3 { margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 1px solid #222; padding-bottom: 4px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .stat-box { text-align: center; background: rgba(0,0,0,0.3); padding: 8px; border: 1px solid #222; }
            .stat-val { font-size: 16px; color: #fff; font-weight: bold; font-family: monospace; }
            .stat-lbl { font-size: 9px; color: #666; text-transform: uppercase; margin-top: 2px; }
            .nexus-table { width: 100%; border-collapse: collapse; font-size: 11px; color: #ccc; table-layout: fixed;}
            .nexus-table th { text-align: left; color: var(--c-neon); border-bottom: 1px solid #444; padding: 6px; cursor: pointer; }
            .nexus-table td { padding: 6px; border-bottom: 1px solid #222; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
            .badge { padding: 2px 4px; border-radius: 2px; font-size: 9px; font-weight: bold; border: 1px solid #333; }
            .badge-hos { color: #f55; border-color: #500; background: rgba(50,0,0,0.5); }
            .badge-ok  { color: #5f5; border-color: #050; background: rgba(0,50,0,0.5); }
            .badge-travel { color: #aaa; border-color: #444; }
            .act-btn { cursor: pointer; color: #666; transition: 0.2s; margin: 0 4px; font-size: 14px; }
            .act-btn:hover { color: #fff; transform: scale(1.2); }
            .nexus-btn { position: fixed; bottom: 20px; left: 20px; width: 50px; height: 50px; background: #000; border: 2px solid var(--c-neon); border-radius: 50%; color: var(--c-neon); font-weight: bold; cursor: pointer; z-index: 10000; box-shadow: 0 0 15px rgba(0,243,255,0.2); display: flex; justify-content: center; align-items: center; font-size: 20px; }
            .scanner-line { position: absolute; width: 100%; height: 2px; background: var(--c-neon); top: 0; animation: scan 2s linear infinite; opacity: 0.5; }
            @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
            .chat-win { height: 300px; overflow-y: auto; background: #080808; border: 1px solid #333; padding: 10px; margin-bottom: 10px; font-family: monospace; font-size: 12px; }
            .msg { margin-bottom: 6px; padding: 4px; border-radius: 2px; }
            .msg-ai { color: var(--c-neon); border-left: 2px solid var(--c-neon); background: rgba(0,243,255,0.05); }
            .msg-user { color: #ccc; text-align: right; border-right: 2px solid #666; background: rgba(255,255,255,0.05); }
            .chat-input { width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 8px; font-family: monospace; }
            .loader-text { text-align: center; color: #444; margin-top: 50px; font-family: monospace; animation: pulse 1s infinite; }
            @keyframes pulse { 50% { opacity: 0.5; } }
        `;
        this.shadow.appendChild(style);
    }

    renderActivePanel() {
        this.shadow.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        const target = this.shadow.querySelector(`#panel-${this.activeTab}`);
        if(target) {
            target.classList.add("active");
            if(this.activeTab === "overview" && this.store.user) this.renderOverview();
            if(this.activeTab === "faction") this.renderFaction();
            if(this.activeTab === "enemy") this.renderEnemies();
            if(this.activeTab === "chain") this.renderChain();
            if(this.activeTab === "targets") this.renderTargets();
        }
    }

    renderOverview() {
        const p = this.shadow.querySelector("#panel-overview");
        const u = this.store.user;
        if(!u || !p) return;
        p.innerHTML = `
            <div class="tile">
                <h3>OPERATOR: <span style="color:#fff">${this.sanitize(u.name)}</span></h3>
                <div class="grid-2">
                    <div class="stat-box"><div class="stat-val">${u.level}</div><div class="stat-lbl">LEVEL</div></div>
                    <div class="stat-box"><div class="stat-val" style="color:${u.hp<u.max_hp?'#f55':'#5f5'}">${u.hp}/${u.max_hp}</div><div class="stat-lbl">HEALTH</div></div>
                    <div class="stat-box"><div class="stat-val">${u.energy}</div><div class="stat-lbl">ENERGY</div></div>
                    <div class="stat-box"><div class="stat-val">${u.nerve}</div><div class="stat-lbl">NERVE</div></div>
                </div>
                <div style="margin-top:10px; font-size:12px; color:#888; text-align:center;">STATUS: ${this.renderStatusBadge(u.status)}</div>
            </div>
            <div class="tile">
                <h3>THREAT ASSESSMENT</h3>
                 <div style="text-align:center; padding:5px;"><span style="font-size:20px; font-weight:bold; color:${u.threat>50? 'var(--c-alert)' : 'var(--c-neon)'}">${u.threat}%</span></div>
                <div style="width:100%; background:#222; height:4px; margin-top:5px;"><div style="width:${u.threat}%; background:${u.threat>50?'var(--c-alert)':'var(--c-neon)'}; height:100%;"></div></div>
            </div>
            <div class="tile"><h3>GLOBAL ACTIVITY</h3><canvas id="heatmap-cvs" width="350" height="60" style="width:100%; height:60px; image-rendering:pixelated;"></canvas></div>
        `;
        if(this.store.heatmap) this.drawHeatmap(this.shadow.querySelector("#heatmap-cvs"), this.store.heatmap);
    }

    renderFaction() {
        const p = this.shadow.querySelector("#panel-faction");
        const members = this.store.faction;
        if(!members || !members.length) { p.innerHTML = `<div class="loader-text">NO FACTION DATA</div>`; return; }
        const k = this.factionSort.key;
        const d = this.factionSort.dir === 'asc' ? 1 : -1;
        members.sort((a,b) => (a[k] > b[k] ? d : -d));
        const rows = members.map(m => `<tr><td>${this.renderOnlineDot(m.onlineState)}</td><td style="color:#fff; font-weight:600;">${this.sanitize(m.name)}</td><td>${m.level}</td><td>${this.renderStatusBadge(m.status)}</td><td>${m.days ?? '-'}</td></tr>`).join("");
        p.innerHTML = `<div class="tile"><h3>ROSTER (${members.length})</h3><table class="nexus-table"><thead><tr><th width="20">●</th><th data-sort="name">NAME</th><th data-sort="level">LVL</th><th data-sort="status">STS</th><th data-sort="days">DAY</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        p.querySelectorAll("th[data-sort]").forEach(th => {
            th.addEventListener("click", () => {
                const key = th.dataset.sort;
                this.factionSort.dir = (this.factionSort.key === key && this.factionSort.dir === 'desc') ? 'asc' : 'desc';
                this.factionSort.key = key;
                this.renderFaction();
            });
        });
    }

    renderEnemies() {
        const p = this.shadow.querySelector("#panel-enemy");
        const list = this.store.enemies || [];
        if(list.length === 0) { p.innerHTML = `<div class="loader-text">NO HOSTILES DETECTED</div>`; return; }
        const rows = list.map(m => `<tr><td>${this.renderOnlineDot(m.onlineState)}</td><td style="color:#fff">${this.sanitize(m.name)}</td><td>${m.level}</td><td>${this.renderStatusBadge(m.status)}</td><td style="text-align:right"><span class="act-btn act-att" data-id="${m.id}">⚔</span><span class="act-btn act-spy" data-id="${m.id}">👁</span></td></tr>`).join("");
        p.innerHTML = `<div class="tile"><h3>HOSTILE FORCES</h3><table class="nexus-table"><thead><tr><th>●</th><th>NAME</th><th>LVL</th><th>STS</th><th style="text-align:right">ACT</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        this.attachActionListeners(p);
    }

    renderChain() {
        const p = this.shadow.querySelector("#panel-chain");
        const c = this.store.chain;
        if(!c) { p.innerHTML = `<div class="loader-text">CHAIN INACTIVE</div>`; return; }
        const time = c.timeLeft || 0;
        const isCrit = time < 90;
        p.innerHTML = `<div class="tile" style="border-color:${isCrit ? 'var(--c-alert)' : '#333'}"><h3>CHAIN STATUS</h3><div class="grid-2"><div class="stat-box"><div class="stat-val" style="color:var(--c-neon)">${c.hits}</div><div class="stat-lbl">COUNT</div></div><div class="stat-box"><div class="stat-val" style="color:${isCrit?'var(--c-alert)':'#fff'}">${time}s</div><div class="stat-lbl">TIMEOUT</div></div></div>${isCrit ? `<div style="background:var(--c-alert); color:#000; text-align:center; font-weight:bold; margin-top:5px; animation:pulse 0.5s infinite">TIMEOUT IMMINENT</div>` : ''}</div><div class="tile"><h3>RECENT HITS</h3><div id="chain-log" style="font-size:10px; color:#888;"></div></div>`;
        if(c.log && c.log.length) {
            const logHTML = c.log.slice(0, 10).map(l => `<div style="border-bottom:1px solid #222; padding:2px;"><span style="color:#fff">${l.player}</span> hit for <span style="color:var(--c-neon)">${l.respect}</span></div>`).join("");
            p.querySelector("#chain-log").innerHTML = logHTML;
        }
    }

    renderTargets() {
        const p = this.shadow.querySelector("#panel-targets");
        if(!p) return;
        const sub = this.targetSubTab;
        const btnStyle = (key) => `flex:1; background:${sub===key?'var(--c-neon)':'#111'}; color:${sub===key?'#000':'#888'}; border:1px solid #333; cursor:pointer; padding:5px; font-weight:bold;`;
        p.innerHTML = `<div style="display:flex; gap:5px; margin-bottom:10px;"><button class="t-sub" data-key="personal" style="${btnStyle('personal')}">PERSONAL</button><button class="t-sub" data-key="war" style="${btnStyle('war')}">WAR</button><button class="t-sub" data-key="shared" style="${btnStyle('shared')}">SHARED</button></div><div id="target-list"></div>`;
        const list = this.store.targets[sub] || [];
        const container = p.querySelector("#target-list");
        p.querySelectorAll(".t-sub").forEach(b => { b.addEventListener("click", () => { this.targetSubTab = b.dataset.key; this.renderTargets(); }); });
        if(!list.length) { container.innerHTML = `<div class="loader-text">NO TARGETS</div>`; return; }
        const rows = list.map(t => `<tr><td>${this.renderOnlineDot(t.onlineState)}</td><td style="color:#fff">${this.sanitize(t.name)}</td><td>${t.level}</td><td>${this.renderStatusBadge(t.status)}</td><td style="text-align:right"><span class="act-btn act-att" data-id="${t.id}">⚔</span></td></tr>`).join("");
        container.innerHTML = `<table class="nexus-table"><thead><tr><th>●</th><th>NAME</th><th>LVL</th><th>STS</th><th>ACT</th></tr></thead><tbody>${rows}</tbody></table>`;
        this.attachActionListeners(container);
    }

    buildColonelPanel() {
        const p = this.shadow.querySelector("#panel-colonel");
        if(!p) return;
        p.innerHTML = `<div class="tile"><h3>TACTICAL AI UPLINK</h3><div class="chat-win" id="col-msgs"><div class="msg msg-ai">[AI] Systems online. Ready for query.</div></div><input type="text" id="col-input" class="chat-input" placeholder="Enter command..."></div>`;
        const input = p.querySelector("#col-input");
        const win = p.querySelector("#col-msgs");
        input.addEventListener("keydown", (e) => {
            if(e.key === "Enter" && input.value.trim() !== "") {
                const txt = input.value.trim();
                const uDiv = document.createElement("div"); uDiv.className = "msg msg-user"; uDiv.textContent = txt; win.appendChild(uDiv);
                this.general?.signals?.dispatch("ASK_COLONEL", { question: txt });
                input.value = ""; win.scrollTop = win.scrollHeight;
            }
        });
    }

    buildSettingsPanel() {
        const p = this.shadow.querySelector("#panel-settings");
        if(!p) return;
        p.innerHTML = `<div class="tile"><h3>CONFIG</h3><label style="color:#ccc; display:block;">Dock Side<select id="set-side" style="float:right; background:#000; color:var(--c-neon); border:1px solid #333;"><option value="left">Left</option><option value="right">Right</option></select></label></div>`;
        const sel = p.querySelector("#set-side");
        sel.value = this.drawerSide;
        sel.addEventListener("change", () => { this.drawerSide = sel.value; localStorage.setItem("nexus_drawer_side", sel.value); this.updateDrawerSide(); });
    }

    startSitrepRouter() {
        if(!this.general?.signals) return;
        this.general.signals.listen("SITREP_UPDATE", d => {
            if(d.user) this.store.user = d.user;
            if(d.chain) this.store.chain = d.chain;
            if(d.factionMembers) this.store.faction = d.factionMembers;
            if(d.enemyFactionMembers) this.store.enemies = d.enemyFactionMembers;
            if(d.targets) this.store.targets = d.targets;
            
            if(this.activeTab === "overview" && d.user) this.renderOverview();
            if(this.activeTab === "chain" && d.chain) this.renderChain();
            if(this.activeTab === "faction" && d.factionMembers) this.renderFaction();
            if(this.activeTab === "enemy" && d.enemyFactionMembers) this.renderEnemies();
        });
        this.general.signals.listen("GLOBAL_SITREP_READY", d => { if(d.heatmap) { this.store.heatmap = d.heatmap; if(this.activeTab === "overview") this.renderOverview(); } });
        this.general.signals.listen("ASK_COLONEL_RESPONSE", d => {
            const win = this.shadow.querySelector("#col-msgs");
            if(win && d.answer) { const div = document.createElement("div"); div.className = "msg msg-ai"; div.textContent = "[AI] " + d.answer; win.appendChild(div); win.scrollTop = win.scrollHeight; }
        });
    }

    sanitize(s) { const d=document.createElement('div'); d.textContent=String(s||""); return d.innerHTML; }
    renderStatusBadge(st) { const s = (st||"").toLowerCase(); if(s.includes("hosp")) return `<span class="badge badge-hos">HOSP</span>`; if(s.includes("jail")) return `<span class="badge badge-hos">JAIL</span>`; if(s.includes("travel")) return `<span class="badge badge-travel">FLY</span>`; return `<span class="badge badge-ok">OK</span>`; }
    renderOnlineDot(st) { return `<span style="color:${st==='online'?'#0f0':'#444'}; font-size:14px;">●</span>`; }
    drawHeatmap(canvas, data) { const ctx = canvas.getContext("2d"); const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h); const bw = w / data.length; const max = Math.max(...data, 1); data.forEach((val, i) => { const hPct = val / max; ctx.fillStyle = `rgba(0, 243, 255, ${Math.max(0.1, hPct)})`; ctx.fillRect(i*bw, h-(h*hPct), bw, h*hPct); }); }
    attachActionListeners(root) { root.querySelectorAll(".act-att").forEach(b => { b.addEventListener("click", () => window.location.href = `/loader.php?sid=attack&user2ID=${b.dataset.id}`); }); root.querySelectorAll(".act-spy").forEach(b => { b.addEventListener("click", () => this.general.signals.dispatch("REQUEST_PLAYER_SITREP", { id: b.dataset.id })); }); }
    toggleDrawer() { this.drawerOpen = !this.drawerOpen; this.updateDrawerSide(); }
    updateDrawerSide() { const cls = this.drawerSide === "right" ? (this.drawerOpen ? "drawer-open-right" : "") + " right" : (this.drawerOpen ? "drawer-open-left" : ""); this.drawerEl.className = cls; }
    attachDragLogic() {
        const btn = this.buttonEl;
        const start = (e) => {
            if(e.type==='mousedown' && e.button!==0) return;
            e.preventDefault(); this.dragging = true; this._isDragging = true;
            const t = e.touches ? e.touches[0] : e;
            const r = btn.getBoundingClientRect(); this.dragOffsetX = t.clientX - r.left; this.dragOffsetY = t.clientY - r.top;
            const move = (ev) => { const p = ev.touches ? ev.touches[0] : ev; btn.style.left = (p.clientX - this.dragOffsetX)+"px"; btn.style.top = (p.clientY - this.dragOffsetY)+"px"; };
            const stop = () => { this.dragging = false; setTimeout(() => this._isDragging = false, 100); window.removeEventListener("mousemove",move); window.removeEventListener("mouseup",stop); window.removeEventListener("touchmove",move); window.removeEventListener("touchend",stop); };
            window.addEventListener("mousemove",move); window.addEventListener("mouseup",stop); window.addEventListener("touchmove",move,{passive:false}); window.addEventListener("touchend",stop);
        };
        btn.addEventListener("mousedown",start); btn.addEventListener("touchstart",start,{passive:false});
    }
    attachButtonLogic() { this.buttonEl.addEventListener("click", () => { if(!this._isDragging) this.toggleDrawer(); }); }
    attachResizeObserver() { window.addEventListener("resize", () => this.updateDrawerSide()); }

    startInlineScanner() {
        const scan = () => { document.querySelectorAll("a[href*='profiles.php?XID=']").forEach(a => { if(a.dataset.nexus) return; const id = a.href.match(/XID=(\d+)/)?.[1]; if(id) { a.dataset.nexus = "1"; const s = document.createElement("span"); s.innerHTML = `<span class="act-btn act-att" data-id="${id}" style="font-size:10px; margin-left:4px;">⚔</span>`; a.after(s); this.attachActionListeners(s); } }); };
        this.mutationObserver = new MutationObserver(scan); this.mutationObserver.observe(document.body, {childList:true, subtree:true}); scan();
    }
}

if (window.WAR_GENERAL) window.WAR_GENERAL.register("Major", Major);
}
})();
