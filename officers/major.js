// major.js — Full Command Console UI for Torn War Nexus

////////////////////////////////////////////////////////////
// MAJOR — FULL COMMAND CONSOLE UI
// Receives SITREP from Colonel via WAR_GENERAL.signals.
////////////////////////////////////////////////////////////

(function(){
"use strict";

/* BLOCK: STATE */

const Major = {
    nexus: null,
    host: null,
    shadow: null,
    drawer: null,
    btn: null,
    detached: false,
    attachedSide: "left",
    activeTab: "overview",
    targetSubTab: "personal",
    strategyMode: "HYBRID",
    
    // Logic Guards
    renderHookApplied: false,
    dataScale: 1.0,

    data: {
        user: {},
        faction: [],
        enemy: [],
        chain: {},
        targets: { personal: [], war: [], shared: [] },
        ai: {},
        aiMemory: {}
    }
};

/* BLOCK: INIT */

Major.init = function(nexus){
    this.nexus = nexus;
    this.createHost();
    this.createUI();
    this.applyTacticalStyles(); // New visual engine
    this.bindDrawerButton();
    this.bindTabs();
    this.bindNexusEvents();
    this.applyRenderHook();
};

/* BLOCK: HOST CREATION */

Major.createHost = function(){
    if (document.getElementById("war-nexus-major")) return;
    this.host = document.createElement("div");
    this.host.id = "war-nexus-major";
    this.host.style.position = "fixed";
    this.host.style.top = "0";
    this.host.style.left = "0";
    this.host.style.zIndex = "2147483647";
    this.shadow = this.host.attachShadow({ mode: "open" });
    document.body.appendChild(this.host);
};

/* BLOCK: NEW UI STRUCTURE */

Major.createUI = function(){
    // SVG Icons for the sidebar
    const ICONS = {
        overview: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
        faction:  `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
        enemy:    `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
        chain:    `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`,
        targets:  `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 13l-1-1 4-4-4-4 1-1 5 5-5 5z"/></svg>`, // Crosshair-ish
        ai:       `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 14H4v-4h8v4zm0-6H4V8h8v4zm8 6h-6v-4h6v4zm0-6h-6V8h6v4z"/></svg>`,
        strategy: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`
    };

    this.shadow.innerHTML = `
        <div id="wnx-trigger">
            <div class="wnx-trigger-inner">N</div>
        </div>

        <div id="wnx-drawer" class="closed">
            <div id="wnx-sidebar">
                <div class="wnx-brand">WN</div>
                <div class="wnx-nav">
                    <button data-t="overview" class="active" title="Overview">${ICONS.overview}</button>
                    <button data-t="faction" title="Faction">${ICONS.faction}</button>
                    <button data-t="enemy" title="Enemy">${ICONS.enemy}</button>
                    <button data-t="chain" title="Chain">${ICONS.chain}</button>
                    <button data-t="targets" title="Targets">${ICONS.targets}</button>
                    <button data-t="ai" title="AI Link">${ICONS.ai}</button>
                    <button data-t="strategy" title="Strategy">${ICONS.strategy}</button>
                    <div class="spacer"></div>
                    <button data-t="settings" title="Settings">${ICONS.settings}</button>
                </div>
            </div>

            <div id="wnx-viewport">
                <div class="wnx-header">
                    <div class="wnx-title">TACTICAL // <span id="wnx-tab-name">OVERVIEW</span></div>
                    <div class="wnx-status-led online"></div>
                </div>
                
                <div id="wnx-panels">
                    <div id="p-overview" class="panel active"></div>
                    <div id="p-faction" class="panel"></div>
                    <div id="p-enemy" class="panel"></div>
                    <div id="p-chain" class="panel"></div>
                    <div id="p-targets" class="panel"></div>
                    <div id="p-ai" class="panel"></div>
                    <div id="p-strategy" class="panel"></div>
                    <div id="p-settings" class="panel"></div>
                </div>
            </div>
        </div>
    `;

    this.drawer = this.shadow.querySelector("#wnx-drawer");
    this.btn = this.shadow.querySelector("#wnx-trigger");
};

/* BLOCK: TACTICAL CSS ENGINE */

Major.applyTacticalStyles = function(){
    const s = document.createElement("style");
    s.textContent = `
        :host {
            --bg-dark: #0a0b10;
            --bg-panel: rgba(18, 20, 28, 0.95);
            --border: #2a2f3a;
            --primary: #00f3ff; /* Cyber Cyan */
            --danger: #ff2a42; /* Tactical Red */
            --warning: #ffb800;
            --success: #00ff9d;
            --text-main: #e0e6ed;
            --text-mute: #7e8796;
            --font-mono: "Consolas", "Monaco", monospace;
            --font-ui: "Segoe UI", system-ui, sans-serif;
            all: initial;
        }

        /* --- TRIGGER BUTTON --- */
        #wnx-trigger {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 56px;
            height: 56px;
            background: var(--bg-panel);
            border: 1px solid var(--primary);
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
            transition: all 0.2s ease;
            z-index: 9999;
        }
        #wnx-trigger:hover {
            box-shadow: 0 0 25px rgba(0, 243, 255, 0.4);
            transform: scale(1.05);
        }
        .wnx-trigger-inner {
            font-family: var(--font-mono);
            font-weight: 900;
            color: var(--primary);
            font-size: 20px;
        }

        /* --- DRAWER CONTAINER --- */
        #wnx-drawer {
            position: fixed;
            top: 0; left: 0;
            width: 600px;
            height: 100vh;
            background: rgba(10, 11, 16, 0.85);
            backdrop-filter: blur(12px);
            border-right: 1px solid var(--border);
            display: flex;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            color: var(--text-main);
            font-family: var(--font-ui);
            box-shadow: 10px 0 30px rgba(0,0,0,0.5);
        }
        #wnx-drawer.open { transform: translateX(0); }

        /* --- SIDEBAR --- */
        #wnx-sidebar {
            width: 64px;
            background: var(--bg-dark);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: 20px;
            padding-bottom: 20px;
            z-index: 2;
        }
        .wnx-brand {
            font-family: var(--font-mono);
            font-weight: 900;
            color: var(--primary);
            margin-bottom: 30px;
            font-size: 14px;
            letter-spacing: 2px;
        }
        .wnx-nav {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
            flex: 1;
        }
        .wnx-nav button {
            background: transparent;
            border: none;
            color: var(--text-mute);
            cursor: pointer;
            padding: 12px;
            transition: 0.2s;
            position: relative;
        }
        .wnx-nav button:hover { color: var(--text-main); }
        .wnx-nav button.active { color: var(--primary); }
        .wnx-nav button.active::after {
            content: '';
            position: absolute;
            left: 0; top: 10%;
            height: 80%;
            width: 3px;
            background: var(--primary);
            box-shadow: 2px 0 8px var(--primary);
        }
        .wnx-nav svg { width: 22px; height: 22px; }
        .spacer { flex: 1; }

        /* --- MAIN VIEWPORT --- */
        #wnx-viewport {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 100%);
        }

        .wnx-header {
            height: 60px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            background: rgba(10,11,16,0.6);
        }
        .wnx-title {
            font-family: var(--font-mono);
            font-size: 14px;
            letter-spacing: 1px;
            color: var(--text-mute);
            text-transform: uppercase;
        }
        .wnx-title span { color: var(--primary); font-weight: bold; }
        
        .wnx-status-led {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--border);
        }
        .wnx-status-led.online {
            background: var(--success);
            box-shadow: 0 0 8px var(--success);
            animation: pulse 2s infinite;
        }

        /* --- PANELS --- */
        #wnx-panels {
            flex: 1;
            overflow-y: auto;
            position: relative;
        }
        .panel {
            display: none;
            padding: 24px;
            animation: fadeIn 0.3s ease;
        }
        .panel.active { display: block; }

        /* --- COMPONENTS & UTILS --- */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card {
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
            padding: 16px;
            border-radius: 4px;
            margin-bottom: 16px;
        }
        .card-header {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-mute);
            text-transform: uppercase;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            padding-bottom: 6px;
            display: flex;
            justify-content: space-between;
        }

        .stat-big {
            font-size: 28px;
            font-weight: 300;
            color: var(--text-main);
            font-family: var(--font-mono);
        }
        .stat-sub { font-size: 12px; color: var(--text-mute); margin-top: 4px; }
        .text-primary { color: var(--primary); }
        .text-danger { color: var(--danger); }
        .text-warn { color: var(--warning); }
        .text-success { color: var(--success); }

        /* TABLES */
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; color: var(--text-mute); font-family: var(--font-mono); font-weight: normal; font-size: 11px; padding: 8px 4px; border-bottom: 1px solid var(--border); }
        td { padding: 10px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-main); }
        tr:last-child td { border-bottom: none; }
        
        /* BARS & GAUGES */
        .bar-bg { height: 4px; background: #1a1c24; width: 100%; margin-top: 8px; position: relative; overflow: hidden; }
        .bar-fill { height: 100%; background: var(--primary); width: 0%; transition: width 0.5s ease; }
        .bar-fill.danger { background: var(--danger); }
        .bar-fill.warn { background: var(--warning); }

        /* AI TERMINAL */
        .terminal {
            background: #000;
            border: 1px solid #333;
            padding: 12px;
            font-family: var(--font-mono);
            font-size: 12px;
            color: #ccc;
            height: 300px;
            overflow-y: auto;
        }
        .term-line { margin-bottom: 4px; word-break: break-all; }
        .term-prompt { color: var(--primary); margin-right: 8px; }
        .term-input {
            width: 100%;
            background: transparent;
            border: none;
            border-top: 1px solid #333;
            color: var(--primary);
            font-family: var(--font-mono);
            padding: 12px;
            outline: none;
        }

        /* ANIMATIONS */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

        /* SCROLLBAR */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-dark); }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--primary); }
        
        /* BUTTONS */
        .btn-tac {
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 8px 16px;
            font-family: var(--font-mono);
            font-size: 12px;
            cursor: pointer;
            transition: 0.2s;
            text-transform: uppercase;
        }
        .btn-tac:hover { background: rgba(0, 243, 255, 0.1); border-color: var(--primary); color: var(--primary); }
        .btn-tac.active { background: var(--primary); color: #000; border-color: var(--primary); font-weight: bold; }
    `;
    this.shadow.appendChild(s);
};

/* BLOCK: DRAWER LOGIC */

Major.bindDrawerButton = function(){
    this.btn.addEventListener("click", () => {
        const isOpen = this.drawer.classList.contains("open");
        if (!isOpen){
            this.drawer.classList.add("open");
            this.nexus.events.emit("UI_DRAWER_OPENED");
        } else {
            this.drawer.classList.remove("open");
        }
    });
};

Major.bindTabs = function(){
    const tabNameDisplay = this.shadow.querySelector("#wnx-tab-name");
    
    this.shadow.querySelectorAll(".wnx-nav button").forEach(btn => {
        btn.addEventListener("click", () => {
            if(btn.classList.contains("spacer")) return;
            
            // UI Toggle
            this.shadow.querySelectorAll(".wnx-nav button").forEach(b => b.classList.remove("active"));
            this.shadow.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            const t = btn.dataset.t;
            this.activeTab = t;
            
            this.shadow.querySelector(`#p-${t}`).classList.add("active");
            tabNameDisplay.textContent = t.toUpperCase();

            this.renderActiveTab();
        });
    });
};

/* BLOCK: EVENT BRIDGE */

Major.bindNexusEvents = function(){
    this.nexus.events.on("SITREP_UPDATE", d => {
        this.data.user = d.user;
        this.data.faction = d.factionMembers;
        this.data.enemy = d.enemyMembers;
        this.data.chain = d.chain;
        this.data.targets = d.targets || this.data.targets;
        this.data.ai = d.ai;
        this.renderActiveTab();
    });

    this.nexus.events.on("SHARED_TARGETS_UPDATED", list => {
        this.data.targets.shared = list;
        if (this.activeTab === "targets") this.renderTargets();
    });

    this.nexus.events.on("AI_MEMORY_UPDATE", mem => {
        this.data.aiMemory = mem || {};
        if (this.activeTab === "strategy") this.renderStrategy();
    });

    this.nexus.events.on("ASK_COLONEL_RESPONSE", d => {
        this.appendAIChatResponse(d.answer || "");
    });
};

Major.applyRenderHook = function(){
    if (this.renderHookApplied) return;
    const oldRender = this.renderActiveTab.bind(this);
    this.renderActiveTab = function(){
        oldRender();
        if (this.activeTab === "strategy") this.finalizeStrategy();
        if (this.activeTab === "chain") this.renderChainGraph();
    };
    this.renderHookApplied = true;
};

/* BLOCK: RENDER DISPATCH */

Major.renderActiveTab = function(){
    switch(this.activeTab){
        case "overview": this.renderOverview(); break;
        case "faction": this.renderFaction(); break;
        case "enemy": this.renderEnemy(); break;
        case "chain": this.renderChain(); break;
        case "targets": this.renderTargets(); break;
        case "ai": this.renderAIConsole(); break;
        case "strategy": this.renderStrategy(); break;
        case "settings": this.renderSettings(); break;
    }
};

/* BLOCK: HELPERS */

Major.healthBar = function(curr, max){
    const pct = Math.min(100, Math.max(0, (curr / max) * 100));
    let colorClass = "success"; // CSS var driven
    if(pct < 50) colorClass = "warn";
    if(pct < 25) colorClass = "danger";
    
    // We use inline styles for the width, classes for color
    let colorHex = "var(--success)";
    if(pct < 50) colorHex = "var(--warning)";
    if(pct < 25) colorHex = "var(--danger)";

    return `
        <div style="font-size:10px; display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>HP</span> <span>${curr}/${max}</span>
        </div>
        <div class="bar-bg">
            <div class="bar-fill" style="width:${pct}%; background:${colorHex};"></div>
        </div>
    `;
};

Major.gauge = function(label, value){
    // Value 0.0 to 1.0
    const pct = Math.round(value * 100);
    let color = "var(--success)";
    if (value > 0.4) color = "var(--warning)";
    if (value > 0.7) color = "var(--danger)";
    
    return `
        <div style="text-align:center; padding: 8px; border:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2);">
            <div style="font-size:20px; font-weight:bold; color:${color}; font-family:var(--font-mono);">${pct}%</div>
            <div style="font-size:10px; color:var(--text-mute); text-transform:uppercase;">${label}</div>
        </div>
    `;
};

Major.statusBadge = function(status){
    status = (status || "").toLowerCase();
    let col = "var(--text-mute)";
    let bg = "rgba(255,255,255,0.05)";
    
    if(status.includes("hospital")) { col = "var(--danger)"; bg = "rgba(255,42,66,0.1)"; }
    else if(status.includes("okay")) { col = "var(--success)"; bg = "rgba(0,255,157,0.1)"; }
    else if(status.includes("travel")) { col = "var(--primary)"; bg = "rgba(0,243,255,0.1)"; }
    
    return `<span style="padding:2px 6px; border-radius:3px; background:${bg}; color:${col}; font-size:10px; text-transform:uppercase;">${status}</span>`;
};

/* BLOCK: OVERVIEW */

Major.renderOverview = function(){
    const p = this.shadow.querySelector("#p-overview");
    const u = this.data.user || {};
    const a = this.data.ai || { threat:0, risk:0, aggression:0, instability:0, summary:[] };
    const c = this.data.chain || {};
    
    if (!u.name) { p.innerHTML = `<div style="padding:20px; color:var(--text-mute);">Awaiting signal...</div>`; return; }

    const timeLeft = c.timeLeft ?? c.timeout ?? 0;
    
    p.innerHTML = `
        <div class="grid-2">
            <div class="card">
                <div class="card-header">
                    <span>OPERATOR</span>
                    <span class="text-primary">LVL ${u.level}</span>
                </div>
                <div style="margin-bottom:12px;">
                    <div class="stat-big">${u.name}</div>
                    <div class="stat-sub">${this.statusBadge(u.status)}</div>
                </div>
                ${this.healthBar(u.hp || 0, u.max_hp || 1)}
            </div>

            <div class="card" style="border-color:${c.hits > 0 ? 'var(--primary)' : 'var(--border)'}">
                <div class="card-header">
                    <span>CHAIN LINK</span>
                    <span style="${timeLeft < 30 ? 'color:var(--danger); animation:pulse 0.5s infinite;' : ''}">${timeLeft}s</span>
                </div>
                <div class="stat-big" style="color:${c.hits > 0 ? 'var(--primary)' : 'var(--text-mute)'}">${c.hits || 0}</div>
                <div class="stat-sub">ACTIVE HITS</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">TACTICAL ASSESSMENT</div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
                ${this.gauge("Threat", a.threat)}
                ${this.gauge("Risk", a.risk)}
                ${this.gauge("Aggr", a.aggression)}
                ${this.gauge("Volat", a.instability)}
            </div>
        </div>

        <div class="card">
            <div class="card-header">INTELLIGENCE SUMMARY</div>
            <div style="font-family:var(--font-mono); font-size:12px; color:var(--text-main); line-height:1.4;">
                ${(a.summary && a.summary.length) ? a.summary.map(s => `<div>> ${s}</div>`).join('') : '<div style="color:var(--text-mute)">No anomalies detected. System stable.</div>'}
            </div>
        </div>
    `;
};

/* BLOCK: FACTION */

Major.renderFaction = function(){
    const p = this.shadow.querySelector("#p-faction");
    const list = this.data.faction || [];
    
    if(!list.length) { p.innerHTML = "No Data"; return; }
    
    // Sort: Online first
    list.sort((a,b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

    const rows = list.map(m => `
        <tr>
            <td style="color:${m.online ? 'var(--success)' : 'var(--text-mute)'}">●</td>
            <td><b style="color:${m.online ? 'var(--text-main)' : 'var(--text-mute)'}">${m.name}</b></td>
            <td>${m.level}</td>
            <td>${this.statusBadge(m.status)}</td>
            <td style="text-align:right; font-family:var(--font-mono); font-size:10px;">${m.last_action || ""}</td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span>ROSTER</span>
                <span>${list.length} UNIT(S)</span>
            </div>
            <table>
                <thead><tr><th width="10"></th><th>NAME</th><th>LVL</th><th>STATUS</th><th style="text-align:right">ACT</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

/* BLOCK: ENEMY */

Major.renderEnemy = function(){
    const p = this.shadow.querySelector("#p-enemy");
    const list = this.data.enemy || [];
    
    if(!list.length) { p.innerHTML = "No Enemy Intel"; return; }

    const rows = list.map(m => `
        <tr>
            <td style="color:${m.online ? 'var(--danger)' : 'var(--text-mute)'}">●</td>
            <td><b style="color:${m.online ? 'var(--text-main)' : 'var(--text-mute)'}">${m.name}</b></td>
            <td>${m.level}</td>
            <td>${this.statusBadge(m.status)}</td>
            <td style="text-align:right; color:var(--warning)">${m.score || 0}</td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div class="card" style="border-color:rgba(255,42,66,0.3);">
            <div class="card-header">
                <span class="text-danger">HOSTILES</span>
                <span>${list.length} DETECTED</span>
            </div>
            <table>
                <thead><tr><th width="10"></th><th>NAME</th><th>LVL</th><th>STATUS</th><th style="text-align:right">VAL</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

/* BLOCK: CHAIN */

Major.renderChain = function(){
    const p = this.shadow.querySelector("#p-chain");
    const c = this.data.chain || {};
    const timeLeft = c.timeLeft ?? c.timeout ?? 0;

    p.innerHTML = `
        <div class="card">
            <div class="card-header">CHAIN METRICS</div>
            <div class="grid-2">
                <div>
                    <div class="stat-sub">CURRENT COUNT</div>
                    <div class="stat-big text-primary">${c.hits || 0}</div>
                </div>
                <div>
                    <div class="stat-sub">TIMEOUT</div>
                    <div class="stat-big" style="color:${timeLeft < 30 ? 'var(--danger)' : 'var(--text-main)'}">${timeLeft}s</div>
                </div>
            </div>
            <div class="bar-bg" style="height:8px; margin-top:16px;">
                 <div class="bar-fill" style="width:${Math.min(100, (timeLeft/300)*100)}%; background:${timeLeft < 60 ? 'var(--danger)' : 'var(--primary)'}"></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">PACE ANALYSIS</div>
            <div id="wnx-chain-graph" style="height:150px; position:relative;"></div>
        </div>
    `;
};

/* BLOCK: TARGETS */

Major.renderTargets = function(){
    const p = this.shadow.querySelector("#p-targets");
    const sub = this.targetSubTab;
    const list = this.data.targets[sub] || [];

    const btns = `
        <div style="display:flex; gap:8px; margin-bottom:16px;">
            <button class="btn-tac ${sub==='personal'?'active':''}" id="tgt-p">Personal</button>
            <button class="btn-tac ${sub==='war'?'active':''}" id="tgt-w">War</button>
            <button class="btn-tac ${sub==='shared'?'active':''}" id="tgt-s">Shared</button>
        </div>
    `;

    const rows = list.map(t => `
        <tr>
            <td><b style="color:var(--primary)">${t.name}</b></td>
            <td>${t.level || "?"}</td>
            <td>${this.statusBadge(t.status)}</td>
            <td style="text-align:right; font-family:var(--font-mono); font-size:10px;">
                ${t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}
            </td>
        </tr>
    `).join("");

    p.innerHTML = `
        ${btns}
        <div class="card">
            <table>
                <thead><tr><th>TARGET</th><th>LVL</th><th>STATUS</th><th style="text-align:right">SEEN</th></tr></thead>
                <tbody>${list.length ? rows : '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-mute)">NO TARGETS DESIGNATED</td></tr>'}</tbody>
            </table>
        </div>
    `;

    p.querySelector("#tgt-p").onclick = () => { this.targetSubTab = "personal"; this.renderTargets(); };
    p.querySelector("#tgt-w").onclick = () => { this.targetSubTab = "war"; this.renderTargets(); };
    p.querySelector("#tgt-s").onclick = () => { this.targetSubTab = "shared"; this.renderTargets(); };
};

/* BLOCK: AI CONSOLE */

Major.renderAIConsole = function(){
    const p = this.shadow.querySelector("#p-ai");
    // Preserve log if rerendering
    const existingLog = p.querySelector("#wnx-ai-log"); 
    const logHTML = existingLog ? existingLog.innerHTML : `<div class="term-line">> Uplink Established.</div><div class="term-line">> Colonel AI Online. Waiting for input...</div>`;

    p.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border);">
            <div class="card-header" style="margin:0; padding:10px; background:#111;">SECURE UPLINK // COLONEL</div>
            <div id="wnx-ai-log" class="terminal">${logHTML}</div>
            <div style="display:flex; background:#000; padding:0;">
                <span style="padding:12px 0 12px 12px; color:var(--primary); font-family:var(--font-mono);">></span>
                <input id="wnx-ai-input" class="term-input" placeholder="Enter command..." autocomplete="off">
            </div>
        </div>
    `;

    const input = p.querySelector("#wnx-ai-input");
    const log = p.querySelector("#wnx-ai-log");
    
    input.focus();
    log.scrollTop = log.scrollHeight;

    input.addEventListener("keydown", e => {
        if (e.key === "Enter" && input.value.trim()){
            const msg = input.value.trim();
            const d = document.createElement("div");
            d.className = "term-line";
            d.innerHTML = `<span style="color:#fff">${msg}</span>`;
            log.appendChild(d);
            
            this.nexus.events.emit("ASK_COLONEL", { question: msg });
            input.value = "";
            log.scrollTop = log.scrollHeight;
        }
    });
};

Major.appendAIChatResponse = function(answer){
    const log = this.shadow.querySelector("#wnx-ai-log");
    if (!log) return;
    const d = document.createElement("div");
    d.className = "term-line";
    d.style.color = "var(--primary)";
    d.textContent = "> " + answer;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
};

/* BLOCK: STRATEGY & CHARTS */

Major.renderStrategy = function(){
    const p = this.shadow.querySelector("#p-strategy");
    const m = this.strategyMode;
    
    p.innerHTML = `
        <div class="card">
            <div class="card-header">COMBAT DOCTRINE</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-tac ${m==='OFFENSIVE'?'active':''}" style="flex:1" id="m-off">Offensive</button>
                <button class="btn-tac ${m==='DEFENSIVE'?'active':''}" style="flex:1" id="m-def">Defensive</button>
                <button class="btn-tac ${m==='HYBRID'?'active':''}" style="flex:1" id="m-hyb">Hybrid</button>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">TEMPORAL ANALYSIS (HEATMAP)</div>
            <div id="wnx-heatmap" style="height:120px; background:#111;"></div>
        </div>
        
        <div class="card">
            <div class="card-header">CONFLICT INTENSITY</div>
            <div id="wnx-strategy-war-graph" style="height:140px;"></div>
        </div>
    `;

    p.querySelector("#m-off").onclick = () => this.setMode("OFFENSIVE");
    p.querySelector("#m-def").onclick = () => this.setMode("DEFENSIVE");
    p.querySelector("#m-hyb").onclick = () => this.setMode("HYBRID");
};

Major.setMode = function(m){
    this.strategyMode = m;
    this.nexus.events.emit("SET_AI_MODE", m);
    this.renderStrategy();
};

/* BLOCK: SETTINGS */

Major.renderSettings = function(){
    const p = this.shadow.querySelector("#p-settings");
    p.innerHTML = `
        <div class="card">
            <div class="card-header">INTERFACE CONFIG</div>
            <button class="btn-tac" style="width:100%; margin-bottom:8px;" id="s-det">
                ${this.detached ? 'Dock Window' : 'Detach Window'}
            </button>
            <button class="btn-tac" style="width:100%; margin-bottom:8px;" id="s-side">
                Switch Side (${this.attachedSide.toUpperCase()})
            </button>
            <button class="btn-tac" style="width:100%;" id="s-scl">
                UI Scale: ${(this.dataScale || 1).toFixed(1)}x
            </button>
        </div>
        
        <div class="card" style="border-color:var(--danger);">
            <div class="card-header text-danger">DANGER ZONE</div>
            <button class="btn-tac" style="width:100%; border-color:var(--danger); color:var(--danger);" id="s-rst">
                Purge AI Memory
            </button>
        </div>
    `;

    p.querySelector("#s-det").onclick = () => {
        this.detached = !this.detached;
        if(this.detached) {
            this.drawer.style.position = "absolute";
            this.drawer.style.height = "600px";
            this.drawer.style.top = "50px";
            this.drawer.style.left = "50px";
            this.drawer.style.border = "1px solid var(--primary)";
        } else {
            this.drawer.style.position = "fixed";
            this.drawer.style.height = "100vh";
            this.drawer.style.top = "0";
            this.drawer.style.left = this.attachedSide === "left" ? "0" : "auto";
            this.drawer.style.right = this.attachedSide === "right" ? "0" : "auto";
            this.drawer.style.border = "none";
            this.drawer.style.borderRight = this.attachedSide === "left" ? "1px solid var(--border)" : "none";
            this.drawer.style.borderLeft = this.attachedSide === "right" ? "1px solid var(--border)" : "none";
        }
        this.renderSettings();
    };

    p.querySelector("#s-side").onclick = () => {
        if(this.detached) return;
        this.attachedSide = this.attachedSide === "left" ? "right" : "left";
        if(this.attachedSide === "right"){
            this.drawer.style.left = "auto";
            this.drawer.style.right = "0";
            this.drawer.style.borderRight = "none";
            this.drawer.style.borderLeft = "1px solid var(--border)";
            // trigger also moves
            this.btn.style.left = "auto";
            this.btn.style.right = "20px";
        } else {
            this.drawer.style.left = "0";
            this.drawer.style.right = "auto";
            this.drawer.style.borderLeft = "none";
            this.drawer.style.borderRight = "1px solid var(--border)";
            this.btn.style.left = "20px";
            this.btn.style.right = "auto";
        }
        this.renderSettings();
    };

    p.querySelector("#s-scl").onclick = () => {
        this.dataScale = (this.dataScale || 1) + 0.1;
        if(this.dataScale > 1.3) this.dataScale = 0.8;
        this.shadow.querySelector("#wnx-viewport").style.zoom = this.dataScale;
        this.renderSettings();
    };

    p.querySelector("#s-rst").onclick = () => {
        localStorage.removeItem("WN_AI_HISTORY");
        this.nexus.log("AI Memory Purged.");
        this.renderSettings();
    };
};

/* BLOCK: CHART RENDERING */

Major.ensureChart = function(cb){
    if (window.Chart) {
        window.WNX_CHART_READY = true;
        cb();
    }
};

Major.renderChainGraph = function(){
    this.ensureChart(() => {
        const container = this.shadow.querySelector("#wnx-chain-graph");
        if (!container) return;
        
        // Prevent destroy/recreate spam by checking if canvas exists
        if(container.querySelector("canvas")) return; // Simple optimization

        container.innerHTML = `<canvas></canvas>`;
        const ctx = container.querySelector("canvas").getContext("2d");
        const pace = (this.data.aiMemory.chain || {}).pace || [];

        if (!pace.length) {
            ctx.fillStyle = "#555"; ctx.font="12px monospace";
            ctx.fillText("NO DATA", 10, 20); return;
        }

        new Chart(ctx, {
            type: "line",
            data: {
                labels: pace.map(p => new Date(p.ts).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})),
                datasets: [{
                    label: "Hits",
                    data: pace.map(p => p.hits),
                    borderColor: "#00f3ff",
                    backgroundColor: "rgba(0, 243, 255, 0.1)",
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { grid: { color: "#222" }, ticks: { color: "#666" } }
                }
            }
        });
    });
};

Major.renderWarGraph = function(){
    this.ensureChart(() => {
        const container = this.shadow.querySelector("#wnx-strategy-war-graph");
        if(!container || container.querySelector("canvas")) return;

        container.innerHTML = `<canvas></canvas>`;
        const ctx = container.querySelector("canvas").getContext("2d");
        const ag = (this.data.aiMemory.war || {}).aggression || [];

        if(!ag.length) return;

        new Chart(ctx, {
            type: "bar",
            data: {
                labels: ag.map(x => new Date(x.ts).toLocaleTimeString()),
                datasets: [{
                    label: "Aggression",
                    data: ag.map(x => x.status.includes("active")?3:1),
                    backgroundColor: "#ff2a42"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    });
};

Major.renderHeatmap = function(){
    const container = this.shadow.querySelector("#wnx-heatmap");
    if(!container) return;
    
    // Manual Canvas Drawing for Heatmap (Performance)
    const canvas = document.createElement("canvas");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.innerHTML = "";
    container.appendChild(canvas);
    
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    
    // Grid Effect
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    
    const mem = this.data.aiMemory.enemy || {};
    const enemies = Object.values(mem);
    const bins = new Array(24).fill(0);
    
    enemies.forEach(e => {
        if(e.onlineTrend) e.onlineTrend.forEach(ts => {
            bins[new Date(ts).getHours()]++;
        });
    });
    
    const max = Math.max(...bins, 1);
    const colW = w / 24;
    
    bins.forEach((val, i) => {
        const intensity = val / max;
        // Cyber Green to Red gradient simulation
        const r = Math.floor(intensity * 255);
        const g = Math.floor((1-intensity) * 255);
        
        ctx.fillStyle = `rgba(${r}, ${g}, 100, 0.6)`;
        if(val === 0) ctx.fillStyle = "rgba(255,255,255,0.02)";
        
        ctx.fillRect(i * colW, 0, colW - 1, h);
        
        // Hour label
        if(i % 3 === 0){
            ctx.fillStyle = "#555";
            ctx.font = "9px monospace";
            ctx.fillText(`${i}h`, i*colW + 2, h - 5);
        }
    });
};

Major.finalizeStrategy = function(){
    this.renderHeatmap();
    this.renderWarGraph();
};

/* BLOCK: REGISTRATION */

if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name: "Major",
    module: Major
});

})();
