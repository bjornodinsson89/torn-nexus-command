// major.js — WAR ROOM COMMAND INTERFACE (v3.0 Ultimate)

////////////////////////////////////////////////////////////
// MAJOR — THE WAR ROOM
// Features:
// - Real-time Charts (Chain Momentum & War Aggression)
// - Dedicated WAR Tab with Conflict Metrics
// - Advanced Target System (Personal / War AI / Shared)
// - Faction Roster with Status
// - Cyber-Tactical "Glass" HUD
////////////////////////////////////////////////////////////

(function(){
"use strict";

const Major = {
    nexus: null,
    host: null,
    shadow: null,
    drawer: null,
    btn: null,
    
    // State
    detached: false,
    attachedSide: "left",
    activeTab: "overview",
    targetSubTab: "war", // Default to War targets
    
    // Configuration
    alerts: { enabled: true, threshold: 90, flash: true, audio: false },
    dataScale: 1.0,
    
    // Internal
    chartInstances: {}, // Store chart instances to prevent memory leaks
    renderHookApplied: false,

    data: {
        user: {},
        faction: [],
        chain: {},
        war: {},
        // Targets split by source
        targets: { 
            personal: [], 
            war: [],     // Populated by Colonel AI
            shared: []   // Populated by Sergeant (Firebase)
        },
        ai: { topTargets: [] },
        aiMemory: { chain: { pace: [] }, war: { aggression: [] } }
    }
};

/* BLOCK: INITIALIZATION */

Major.init = function(nexus){
    this.nexus = nexus;
    this.createHost();
    this.createUI();
    this.applyTacticalStyles();
    this.bindInteractions();
    this.bindNexusEvents();
    this.applyRenderHook();
    this.loadSettings();
};

Major.loadSettings = function(){
    try {
        const saved = localStorage.getItem("WN_MAJOR_CFG");
        if(saved) {
            const p = JSON.parse(saved);
            this.alerts = p.alerts || this.alerts;
            this.detached = p.detached || false;
            this.attachedSide = p.attachedSide || "left";
            this.dataScale = p.dataScale || 1.0;
            this.applyWindowSettings();
        }
    } catch(e) {}
};

Major.saveSettings = function(){
    localStorage.setItem("WN_MAJOR_CFG", JSON.stringify({
        alerts: this.alerts,
        detached: this.detached,
        attachedSide: this.attachedSide,
        dataScale: this.dataScale
    }));
};

/* BLOCK: UI SCAFFOLDING */

Major.createHost = function(){
    if (document.getElementById("war-nexus-major")) return;
    this.host = document.createElement("div");
    this.host.id = "war-nexus-major";
    this.host.style.position = "fixed";
    this.host.style.zIndex = "2147483647";
    this.shadow = this.host.attachShadow({ mode: "open" });
    document.body.appendChild(this.host);
};

Major.createUI = function(){
    // Icons
    const I = {
        dash: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
        war: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`,
        chain: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`,
        target: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 13l-1-1 4-4-4-4 1-1 5 5-5 5z"/></svg>`,
        faction: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z"/></svg>`
    };

    this.shadow.innerHTML = `
        <div id="wnx-trigger">W</div>
        <div id="wnx-alert-layer"></div>
        
        <div id="wnx-drawer" class="closed">
            <div id="wnx-sidebar">
                <div class="wnx-brand">WN</div>
                <div class="wnx-nav">
                    <button data-t="overview" class="active">${I.dash}</button>
                    <button data-t="war">${I.war}</button>
                    <button data-t="chain">${I.chain}</button>
                    <button data-t="targets">${I.target}</button>
                    <button data-t="faction">${I.faction}</button>
                    <div class="spacer"></div>
                    <button data-t="settings">${I.settings}</button>
                </div>
            </div>
            
            <div id="wnx-viewport">
                <div class="wnx-header">
                    <div class="wnx-title">WAR NEXUS // <span id="wnx-tab-name">OVERVIEW</span></div>
                    <button id="wnx-close">✕</button>
                </div>
                
                <div id="wnx-panels">
                    <div id="p-overview" class="panel active"></div>
                    <div id="p-war" class="panel"></div>
                    <div id="p-chain" class="panel"></div>
                    <div id="p-targets" class="panel"></div>
                    <div id="p-faction" class="panel"></div>
                    <div id="p-settings" class="panel"></div>
                </div>
            </div>
        </div>
    `;

    this.drawer = this.shadow.querySelector("#wnx-drawer");
    this.btn = this.shadow.querySelector("#wnx-trigger");
    this.alertLayer = this.shadow.querySelector("#wnx-alert-layer");
    
    this.shadow.querySelector("#wnx-close").onclick = () => this.drawer.classList.remove("open");
};

/* BLOCK: STYLES */

Major.applyTacticalStyles = function(){
    const s = document.createElement("style");
    s.textContent = `
        :host {
            --bg: #050505;
            --panel: rgba(14, 18, 22, 0.95);
            --border: #333;
            --primary: #0ff;
            --danger: #ff003c;
            --warn: #ffcc00;
            --ok: #00ff9d;
            --text: #eee;
            --mute: #666;
            --mono: "Consolas", monospace;
            --ui: "Segoe UI", sans-serif;
            all: initial;
        }
        * { box-sizing: border-box; }
        
        /* TRIGGER */
        #wnx-trigger {
            position: fixed; bottom: 15px; left: 15px; width: 48px; height: 48px;
            background: #000; border: 2px solid var(--primary); color: var(--primary);
            display: flex; align-items: center; justify-content: center;
            font-family: var(--mono); font-weight: 900; font-size: 20px;
            cursor: pointer; z-index: 10000; box-shadow: 0 0 15px rgba(0,255,255,0.2);
            transition: 0.2s; clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%);
        }
        #wnx-trigger:hover { transform: scale(1.1); background: rgba(0,255,255,0.1); }
        
        /* ALERT OVERLAY */
        #wnx-alert-layer {
            position: fixed; inset: 0; pointer-events: none; z-index: 9999;
            background: radial-gradient(circle, transparent 50%, rgba(255,0,60,0.4) 100%);
            opacity: 0; transition: opacity 0.2s;
        }
        #wnx-alert-layer.active { opacity: 1; animation: pulse 0.8s infinite; }
        
        /* DRAWER */
        #wnx-drawer {
            position: fixed; top: 0; left: 0; height: 100vh; width: 420px; max-width: 100vw;
            background: var(--panel); border-right: 1px solid var(--border);
            display: flex; transform: translateX(-100%); transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            color: var(--text); font-family: var(--ui); box-shadow: 10px 0 50px #000;
        }
        #wnx-drawer.open { transform: translateX(0); }
        
        /* SIDEBAR */
        #wnx-sidebar { width: 50px; background: #000; border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; padding: 10px 0; }
        .wnx-brand { color: var(--danger); font-family: var(--mono); font-weight: 900; margin-bottom: 20px; }
        .wnx-nav button { background: none; border: none; color: var(--mute); padding: 12px; cursor: pointer; width: 100%; border-left: 2px solid transparent; transition: 0.2s; }
        .wnx-nav button:hover { color: #fff; }
        .wnx-nav button.active { color: var(--primary); border-left-color: var(--primary); background: rgba(0,255,255,0.05); }
        .wnx-nav svg { width: 22px; height: 22px; }
        .spacer { flex: 1; }
        
        /* VIEWPORT */
        #wnx-viewport { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(180deg, rgba(0,255,255,0.02) 0%, #000 100%); }
        .wnx-header { height: 50px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 15px; background: rgba(0,0,0,0.5); justify-content: space-between; }
        .wnx-title { font-family: var(--mono); font-size: 12px; color: var(--mute); letter-spacing: 1px; }
        .wnx-title span { color: var(--primary); font-weight: bold; }
        #wnx-close { background: none; border: none; color: var(--mute); font-size: 18px; cursor: pointer; }
        
        /* PANELS */
        #wnx-panels { flex: 1; overflow-y: auto; padding: 0; }
        .panel { display: none; padding: 15px; animation: fadeUp 0.2s ease; }
        .panel.active { display: block; }
        
        /* CARDS */
        .card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 12px; margin-bottom: 10px; position: relative; }
        .card.prio::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--primary); }
        .card-head { font-family: var(--mono); font-size: 10px; color: var(--mute); margin-bottom: 8px; text-transform: uppercase; display: flex; justify-content: space-between; }
        
        /* DATA UTILS */
        .stat-lg { font-size: 24px; font-family: var(--mono); color: #fff; font-weight: bold; }
        .stat-sm { font-size: 11px; color: var(--mute); }
        .text-c { color: var(--primary); }
        .text-r { color: var(--danger); }
        .text-y { color: var(--warn); }
        .text-g { color: var(--ok); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
        
        /* TABLES */
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; color: var(--mute); font-family: var(--mono); font-size: 9px; padding: 6px 4px; border-bottom: 1px solid var(--border); }
        td { padding: 8px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text); }
        tr:last-child td { border-bottom: none; }
        
        /* BUTTONS & LINKS */
        .btn-tab { background: #000; border: 1px solid var(--border); color: var(--text); padding: 6px; cursor: pointer; font-family: var(--mono); font-size: 10px; flex: 1; text-align: center; }
        .btn-tab.active { background: var(--primary); color: #000; border-color: var(--primary); font-weight: bold; }
        
        .btn-atk { text-decoration: none; background: rgba(255,0,60,0.1); border: 1px solid var(--danger); color: var(--danger); padding: 2px 6px; font-size: 9px; font-family: var(--mono); transition: 0.2s; }
        .btn-atk:hover { background: var(--danger); color: #000; }
        
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 0.1; } 50% { opacity: 0.6; } 100% { opacity: 0.1; } }
        
        @media (max-width: 450px) { #wnx-drawer { width: 100%; } }
    `;
    this.shadow.appendChild(s);
};

/* BLOCK: BINDINGS */

Major.bindInteractions = function(){
    this.btn.onclick = () => {
        this.drawer.classList.toggle("open");
        if(this.drawer.classList.contains("open")) this.nexus.events.emit("UI_DRAWER_OPENED");
    };

    const name = this.shadow.querySelector("#wnx-tab-name");
    this.shadow.querySelectorAll(".wnx-nav button").forEach(b => {
        b.onclick = () => {
            if(b.classList.contains("spacer")) return;
            this.shadow.querySelectorAll(".wnx-nav button").forEach(x => x.classList.remove("active"));
            this.shadow.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
            
            b.classList.add("active");
            this.activeTab = b.dataset.t;
            this.shadow.querySelector(`#p-${this.activeTab}`).classList.add("active");
            name.textContent = this.activeTab.toUpperCase();
            this.renderActiveTab();
        };
    });
};

Major.bindNexusEvents = function(){
    this.nexus.events.on("SITREP_UPDATE", d => {
        this.data.user = d.user;
        this.data.faction = d.factionMembers;
        this.data.chain = d.chain;
        this.data.war = d.war;
        this.data.ai = d.ai;
        // Targets: Merge/Update
        this.data.targets.personal = d.targets?.personal || [];
        this.data.targets.war = d.ai?.topTargets || []; // AI populates War targets
        this.data.targets.shared = d.targets?.shared || this.data.targets.shared;
        
        this.checkAlerts();
        this.renderActiveTab();
    });
    
    this.nexus.events.on("SHARED_TARGETS_UPDATED", list => {
        this.data.targets.shared = list;
        if(this.activeTab === "targets") this.renderTargets();
    });

    this.nexus.events.on("AI_MEMORY_UPDATE", mem => {
        this.data.aiMemory = mem || {};
        if(this.activeTab === "chain" || this.activeTab === "war") this.renderActiveTab();
    });
};

Major.applyRenderHook = function(){
    if(this.renderHookApplied) return;
    const old = this.renderActiveTab.bind(this);
    this.renderActiveTab = function(){
        old();
        if(this.activeTab === "chain") this.renderChainChart();
        if(this.activeTab === "war") this.renderWarChart();
    };
    this.renderHookApplied = true;
};

/* BLOCK: ALERTS */

Major.checkAlerts = function(){
    if(!this.alerts.enabled) { this.alertLayer.classList.remove("active"); return; }
    const c = this.data.chain || {};
    const t = c.timeLeft ?? c.timeout ?? 0;
    
    if(c.hits > 0 && t > 0 && t <= this.alerts.threshold){
        if(this.alerts.flash) this.alertLayer.classList.add("active");
    } else {
        this.alertLayer.classList.remove("active");
    }
};

/* BLOCK: RENDERERS */

Major.renderActiveTab = function(){
    switch(this.activeTab){
        case "overview": this.renderOverview(); break;
        case "war": this.renderWar(); break;
        case "chain": this.renderChain(); break;
        case "targets": this.renderTargets(); break;
        case "faction": this.renderFaction(); break;
        case "settings": this.renderSettings(); break;
    }
};

Major.renderOverview = function(){
    const p = this.shadow.querySelector("#p-overview");
    const u = this.data.user || {};
    const c = this.data.chain || {};
    const a = this.data.ai || {};
    
    if(!u.name) { p.innerHTML = "<div style='padding:20px;color:#666'>WAITING FOR DATA...</div>"; return; }
    
    const t = c.timeLeft ?? c.timeout ?? 0;
    const hpColor = u.hp < (u.max_hp*0.3) ? "var(--danger)" : "var(--ok)";

    p.innerHTML = `
        <div class="card prio">
            <div class="card-head">OPERATOR</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div>
                    <div class="stat-lg" style="color:${hpColor}">${u.hp}</div>
                    <div class="stat-sm">HP / ${u.max_hp}</div>
                </div>
                <div style="text-align:right">
                    <div class="stat-lg" style="color:var(--primary)">${u.name}</div>
                    <div class="stat-sm">${u.status}</div>
                </div>
            </div>
        </div>
        
        <div class="grid-2">
            <div class="card">
                <div class="card-head">CHAIN</div>
                <div class="stat-lg text-c">${c.hits||0}</div>
                <div class="stat-sm">HITS</div>
            </div>
            <div class="card">
                <div class="card-head">TIMEOUT</div>
                <div class="stat-lg ${t<60?'text-r':'text-text'}">${t}s</div>
                <div class="stat-sm">REMAINING</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-head">TACTICAL SUMMARY</div>
            <div class="grid-3" style="text-align:center;">
                <div><div class="text-c">${(a.threat*100).toFixed(0)}%</div><div class="stat-sm">THREAT</div></div>
                <div><div class="text-r">${(a.risk*100).toFixed(0)}%</div><div class="stat-sm">RISK</div></div>
                <div><div class="text-y">${(a.aggression*100).toFixed(0)}%</div><div class="stat-sm">AGGR</div></div>
            </div>
        </div>
    `;
};

Major.renderWar = function(){
    const p = this.shadow.querySelector("#p-war");
    // This assumes Colonel has processed 'war' data
    const w = this.data.war || {}; 
    const mem = this.data.aiMemory.war || {};
    
    // Attempt to find active ranked war data
    let activeWar = null;
    if(w.wars) {
        // Just grab first active war for UI simplicity
        activeWar = Object.values(w.wars)[0]; 
    }
    
    if(!activeWar){
        p.innerHTML = `
            <div class="card">
                <div class="card-head">CONFLICT STATUS</div>
                <div style="text-align:center; padding:20px; color:var(--mute);">NO ACTIVE CONFLICT DETECTED</div>
            </div>
        `;
        return;
    }

    // War Data exists
    p.innerHTML = `
        <div class="card prio">
            <div class="card-head">ACTIVE ENGAGEMENT</div>
            <div style="color:var(--danger); font-weight:bold; font-size:14px; margin-bottom:5px;">
                VS: ${this.data.ai?.topTargets[0]?.name || "UNKNOWN FACTION"} 
                </div>
            <div class="grid-2">
                <div><span class="stat-sm">SCORE:</span> <b class="text-ok">US</b></div>
                <div style="text-align:right"><span class="stat-sm">SCORE:</span> <b class="text-r">THEM</b></div>
            </div>
            <div style="height:4px; background:#222; margin-top:5px; display:flex;">
                <div style="width:50%; background:var(--ok);"></div>
                <div style="width:50%; background:var(--danger);"></div>
            </div>
        </div>

        <div class="card">
            <div class="card-head">AGGRESSION INDEX</div>
            <div id="wnx-war-chart" style="height:120px;"></div>
        </div>
    `;
};

Major.renderChain = function(){
    const p = this.shadow.querySelector("#p-chain");
    const c = this.data.chain || {};
    
    p.innerHTML = `
        <div class="card">
            <div class="card-head">MOMENTUM</div>
            <div id="wnx-chain-chart" style="height:140px;"></div>
        </div>
        
        <div class="card">
            <div class="card-head">ALERTS</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                 <span>ENABLED</span>
                 <b class="${this.alerts.enabled?'text-ok':'text-r'}" style="cursor:pointer;" id="act-tog">${this.alerts.enabled?'ON':'OFF'}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                 <span>FLASH SCREEN</span>
                 <b class="${this.alerts.flash?'text-ok':'text-r'}" style="cursor:pointer;" id="act-fls">${this.alerts.flash?'YES':'NO'}</b>
            </div>
            <div style="margin-top:10px;">
                <div class="stat-sm">THRESHOLD: ${this.alerts.threshold}s</div>
                <input type="range" min="30" max="180" value="${this.alerts.threshold}" id="act-sld" style="width:100%; accent-color:var(--primary);">
            </div>
        </div>
    `;
    
    p.querySelector("#act-tog").onclick = () => { this.alerts.enabled = !this.alerts.enabled; this.saveSettings(); this.renderChain(); };
    p.querySelector("#act-fls").onclick = () => { this.alerts.flash = !this.alerts.flash; this.saveSettings(); this.renderChain(); };
    p.querySelector("#act-sld").oninput = (e) => { this.alerts.threshold = e.target.value; this.saveSettings(); this.renderChain(); };
};

Major.renderTargets = function(){
    const p = this.shadow.querySelector("#p-targets");
    const sub = this.targetSubTab; // 'personal', 'war', 'shared'
    const list = this.data.targets[sub] || [];
    
    // Sort logic
    if(sub === 'war'){
        // Already sorted by Colonel (Score)
    } else {
        // Sort others by status
        list.sort((a,b) => {
             const sa = (a.status||"").toLowerCase();
             const sb = (b.status||"").toLowerCase();
             if(sa.includes("hosp") && !sb.includes("hosp")) return 1;
             if(!sa.includes("hosp") && sb.includes("hosp")) return -1;
             return 0;
        });
    }

    const rows = list.map(t => {
        const st = (t.status||"").toLowerCase();
        let col = "#fff";
        if(st.includes("hosp")) col = "var(--danger)";
        if(st.includes("trav")) col = "var(--primary)";
        if(t.online) col = "var(--ok)";
        
        return `
            <tr>
                <td>
                    <div style="color:${col}; font-weight:bold;">${t.name}</div>
                    <div style="font-size:9px; color:var(--mute);">[Lv${t.level}] ${t.status.substring(0,15)}</div>
                </td>
                <td style="text-align:right;">
                    ${t.score ? `<span class="text-y" style="font-size:9px; margin-right:5px;">${t.score}</span>` : ''}
                    <a href="https://www.torn.com/loader.php?sid=attack&user2ID=${t.id}" target="_blank" class="btn-atk">ATK</a>
                </td>
            </tr>
        `;
    }).join("");

    p.innerHTML = `
        <div style="display:flex; gap:5px; margin-bottom:10px;">
            <div class="btn-tab ${sub==='personal'?'active':''}" id="t-p">PERS</div>
            <div class="btn-tab ${sub==='war'?'active':''}" id="t-w">WAR(AI)</div>
            <div class="btn-tab ${sub==='shared'?'active':''}" id="t-s">SHARE</div>
        </div>
        
        <div class="card" style="padding:0;">
            <table>
                <thead><tr><th>TARGET</th><th style="text-align:right">ACTION</th></tr></thead>
                <tbody>${list.length ? rows : '<tr><td colspan="2" style="text-align:center;padding:15px;color:#555;">NO DATA</td></tr>'}</tbody>
            </table>
        </div>
    `;

    p.querySelector("#t-p").onclick = () => { this.targetSubTab='personal'; this.renderTargets(); };
    p.querySelector("#t-w").onclick = () => { this.targetSubTab='war'; this.renderTargets(); };
    p.querySelector("#t-s").onclick = () => { this.targetSubTab='shared'; this.renderTargets(); };
};

Major.renderFaction = function(){
    const p = this.shadow.querySelector("#p-faction");
    const list = this.data.faction || [];
    
    list.sort((a,b) => (b.online?1:0) - (a.online?1:0));
    
    const rows = list.map(m => `
        <tr>
            <td><span style="color:${m.online?'var(--ok)':'#555'}">●</span> ${m.name}</td>
            <td style="text-align:right">${m.status}</td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div class="card" style="padding:0;">
            <div class="card-head" style="padding:10px;">ROSTER (${list.length})</div>
            <table>
                <thead><tr><th>NAME</th><th style="text-align:right">STATUS</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

Major.renderSettings = function(){
    const p = this.shadow.querySelector("#p-settings");
    p.innerHTML = `
        <div class="card">
            <div class="card-head">WINDOW</div>
            <button class="btn-tab" style="width:100%; margin-bottom:5px;" id="s-det">${this.detached?'DOCK':'DETACH'}</button>
            <button class="btn-tab" style="width:100%; margin-bottom:5px;" id="s-side">SIDE: ${this.attachedSide.toUpperCase()}</button>
            <button class="btn-tab" style="width:100%;" id="s-sc">SCALE: ${this.dataScale.toFixed(1)}</button>
        </div>
        <div class="card">
             <div class="card-head">DANGER ZONE</div>
             <button class="btn-tab" style="width:100%; border-color:var(--danger); color:var(--danger);" id="s-wipe">WIPE MEMORY</button>
        </div>
    `;
    
    p.querySelector("#s-det").onclick = () => { this.detached=!this.detached; this.applyWindowSettings(); this.saveSettings(); this.renderSettings(); };
    p.querySelector("#s-side").onclick = () => { this.attachedSide=this.attachedSide==='left'?'right':'left'; this.applyWindowSettings(); this.saveSettings(); this.renderSettings(); };
    p.querySelector("#s-sc").onclick = () => { this.dataScale = this.dataScale>=1.5 ? 0.8 : this.dataScale+0.1; this.applyWindowSettings(); this.saveSettings(); this.renderSettings(); };
    p.querySelector("#s-wipe").onclick = () => { localStorage.removeItem("WN_AI_HISTORY"); this.nexus.log("WIPED"); };
};

Major.applyWindowSettings = function(){
    const v = this.shadow.querySelector("#wnx-viewport");
    v.style.zoom = this.dataScale;
    
    if(this.detached){
        this.drawer.style.position = "absolute";
        this.drawer.style.height = "500px";
        this.drawer.style.width = "350px";
        this.drawer.style.top = "50px";
        this.drawer.style.left = "50px";
        this.drawer.style.border = "1px solid var(--primary)";
    } else {
        this.drawer.style.position = "fixed";
        this.drawer.style.height = "100vh";
        this.drawer.style.width = "400px";
        this.drawer.style.top = "0";
        this.drawer.style.left = this.attachedSide === "left" ? "0" : "auto";
        this.drawer.style.right = this.attachedSide === "right" ? "0" : "auto";
        this.drawer.style.border = "none";
        this.drawer.style.borderRight = this.attachedSide === "left" ? "1px solid var(--border)" : "none";
        this.drawer.style.borderLeft = this.attachedSide === "right" ? "1px solid var(--border)" : "none";
    }
};

/* BLOCK: CHARTS */

Major.drawChart = function(containerId, data, color, type='line'){
    if(!window.Chart) return;
    const container = this.shadow.querySelector(containerId);
    if(!container) return;
    
    // Cleanup existing chart to prevent leak/glitch
    if(this.chartInstances[containerId]) {
        this.chartInstances[containerId].destroy();
        delete this.chartInstances[containerId];
    }
    
    container.innerHTML = "<canvas></canvas>";
    const ctx = container.querySelector("canvas").getContext("2d");
    
    this.chartInstances[containerId] = new Chart(ctx, {
        type: type,
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: color,
                backgroundColor: color.replace(')', ',0.1)').replace('rgb', 'rgba'),
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } },
            animation: false
        }
    });
};

Major.renderChainChart = function(){
    const pace = (this.data.aiMemory.chain?.pace || []).map(p => p.hits);
    if(pace.length) this.drawChart("#wnx-chain-chart", pace, "rgb(0, 255, 255)");
};

Major.renderWarChart = function(){
    const agg = (this.data.aiMemory.war?.aggression || []).map(a => a.status.includes('active')?2:1);
    if(agg.length) this.drawChart("#wnx-war-chart", agg, "rgb(255, 0, 60)", 'bar');
};

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Major", module: Major });

})();
