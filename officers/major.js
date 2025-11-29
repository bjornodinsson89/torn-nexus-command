// major.js — WAR ROOM COMMAND INTERFACE (v2.0 Ultimate)

////////////////////////////////////////////////////////////
// MAJOR — THE WAR ROOM
// High-Fidelity Tactical HUD for Torn City
// Features:
// - Visual/Audio Chain Alerts
// - Direct Attack Links
// - Advanced Enemy Filtering
// - Real-time Momentum Graphs
////////////////////////////////////////////////////////////

(function(){
"use strict";

/* BLOCK: STATE & CONFIG */

const Major = {
    nexus: null,
    host: null,
    shadow: null,
    drawer: null,
    btn: null,
    
    // UI State
    detached: false,
    attachedSide: "left",
    activeTab: "overview",
    targetSubTab: "personal",
    strategyMode: "HYBRID",
    
    // Filters
    filterHideHosp: false,
    filterHideTravel: false,

    // Alerts
    alerts: {
        enabled: true,
        threshold: 90, // seconds
        flash: true,
        audio: false // browser policy often blocks auto-audio, but we provide the toggle
    },
    
    // Internal
    renderHookApplied: false,
    dataScale: 1.0,
    audioCtx: null, // Simple oscillator for beeps

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

/* BLOCK: INITIALIZATION */

Major.init = function(nexus){
    this.nexus = nexus;
    this.createHost();
    this.createUI();
    this.applyWarRoomStyles();
    this.bindInteractions();
    this.bindNexusEvents();
    this.applyRenderHook();
    
    // Load saved settings
    try {
        const saved = localStorage.getItem("WN_MAJOR_OPTS");
        if(saved) {
            const parsed = JSON.parse(saved);
            this.alerts = { ...this.alerts, ...parsed.alerts };
            this.detached = parsed.detached || false;
            this.attachedSide = parsed.attachedSide || "left";
            this.dataScale = parsed.dataScale || 1.0;
            this.applyWindowSettings();
        }
    } catch(e) {}
};

Major.saveSettings = function(){
    const save = {
        alerts: this.alerts,
        detached: this.detached,
        attachedSide: this.attachedSide,
        dataScale: this.dataScale
    };
    localStorage.setItem("WN_MAJOR_OPTS", JSON.stringify(save));
};

/* BLOCK: HOST & SHADOW DOM */

Major.createHost = function(){
    if (document.getElementById("war-nexus-major")) return;
    this.host = document.createElement("div");
    this.host.id = "war-nexus-major";
    this.host.style.position = "fixed";
    this.host.style.zIndex = "2147483647";
    this.shadow = this.host.attachShadow({ mode: "open" });
    document.body.appendChild(this.host);
};

/* BLOCK: UI SCAFFOLDING */

Major.createUI = function(){
    const ICONS = {
        dash: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
        target: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 13l-1-1 4-4-4-4 1-1 5 5-5 5z"/></svg>`,
        chain: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`,
        list: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>`
    };

    this.shadow.innerHTML = `
        <div id="wnx-trigger">W</div>
        
        <div id="wnx-alert-flash"></div>

        <div id="wnx-drawer" class="closed">
            <div id="wnx-sidebar">
                <div class="wnx-brand">WN</div>
                <div class="wnx-nav">
                    <button data-t="overview" class="active">${ICONS.dash}</button>
                    <button data-t="enemy">${ICONS.target}</button>
                    <button data-t="chain">${ICONS.chain}</button>
                    <button data-t="targets">${ICONS.list}</button>
                    <div class="spacer"></div>
                    <button data-t="settings">${ICONS.settings}</button>
                </div>
            </div>

            <div id="wnx-viewport">
                <div class="wnx-header">
                    <div class="wnx-title">WAR ROOM // <span id="wnx-tab-name">OVERVIEW</span></div>
                    <div id="wnx-chain-mini" class="hidden">00:00</div>
                    <button id="wnx-close-mobile">✕</button>
                </div>
                
                <div id="wnx-panels">
                    <div id="p-overview" class="panel active"></div>
                    <div id="p-enemy" class="panel"></div>
                    <div id="p-chain" class="panel"></div>
                    <div id="p-targets" class="panel"></div>
                    <div id="p-settings" class="panel"></div>
                </div>
            </div>
        </div>
    `;

    this.drawer = this.shadow.querySelector("#wnx-drawer");
    this.btn = this.shadow.querySelector("#wnx-trigger");
    this.flashLayer = this.shadow.querySelector("#wnx-alert-flash");
    
    this.shadow.querySelector("#wnx-close-mobile").onclick = () => {
        this.drawer.classList.remove("open");
    };
};

/* BLOCK: WAR ROOM STYLES (Cyber-Tactical) */

Major.applyWarRoomStyles = function(){
    const s = document.createElement("style");
    s.textContent = `
        :host {
            --bg-dark: #050505;
            --bg-panel: rgba(10, 12, 16, 0.96);
            --border: #333;
            --primary: #0ff;        /* Cyan */
            --primary-dim: rgba(0, 255, 255, 0.1);
            --danger: #ff003c;      /* Cyber Red */
            --danger-dim: rgba(255, 0, 60, 0.15);
            --warning: #fcee0a;     /* Yellow */
            --success: #00ff9f;
            --text-main: #eee;
            --text-mute: #666;
            --font-mono: "Courier New", Consolas, monospace;
            --font-ui: "Segoe UI", Roboto, sans-serif;
            all: initial;
        }

        /* RESET */
        * { box-sizing: border-box; }

        /* TRIGGER */
        #wnx-trigger {
            position: fixed; bottom: 15px; left: 15px;
            width: 50px; height: 50px;
            background: #000; border: 2px solid var(--primary);
            color: var(--primary);
            font-family: var(--font-mono); font-weight: 900; font-size: 20px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; z-index: 10000;
            box-shadow: 0 0 10px var(--primary-dim);
            transition: 0.2s;
            clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%);
        }
        #wnx-trigger:hover { transform: scale(1.1); box-shadow: 0 0 20px var(--primary); background: var(--primary-dim); }

        /* ALERT FLASH OVERLAY */
        #wnx-alert-flash {
            position: fixed; inset: 0;
            background: radial-gradient(circle, transparent 50%, rgba(255,0,60,0.4) 100%);
            z-index: 9999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        }
        #wnx-alert-flash.active { opacity: 1; animation: alarmPulse 0.8s infinite; }

        /* DRAWER */
        #wnx-drawer {
            position: fixed; top: 0; left: 0;
            width: 400px; max-width: 100vw; height: 100vh;
            background: var(--bg-panel);
            border-right: 1px solid var(--border);
            display: flex;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            color: var(--text-main); font-family: var(--font-ui);
            box-shadow: 10px 0 50px #000;
        }
        #wnx-drawer.open { transform: translateX(0); }

        /* SIDEBAR */
        #wnx-sidebar {
            width: 50px; background: #000;
            border-right: 1px solid var(--border);
            display: flex; flex-direction: column; align-items: center;
            padding: 10px 0;
        }
        .wnx-brand { color: var(--danger); font-family: var(--font-mono); font-weight: 900; margin-bottom: 20px; letter-spacing: -1px; }
        .wnx-nav button {
            background: none; border: none; color: var(--text-mute);
            padding: 12px; cursor: pointer; transition: 0.2s;
            width: 100%; border-left: 2px solid transparent;
        }
        .wnx-nav button.active { color: var(--primary); border-left-color: var(--primary); background: var(--primary-dim); }
        .wnx-nav button:hover { color: #fff; }
        .wnx-nav svg { width: 22px; height: 22px; }
        .spacer { flex: 1; }

        /* VIEWPORT */
        #wnx-viewport { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(180deg, rgba(0,255,255,0.02) 0%, #000 100%); }
        .wnx-header {
            height: 50px; border-bottom: 1px solid var(--border);
            display: flex; align-items: center; padding: 0 15px;
            background: rgba(0,0,0,0.5); justify-content: space-between;
        }
        .wnx-title { font-family: var(--font-mono); font-size: 12px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 1px; }
        .wnx-title span { color: var(--primary); font-weight: bold; }
        
        #wnx-chain-mini {
            font-family: var(--font-mono); color: var(--danger); font-weight: bold;
            border: 1px solid var(--danger); padding: 2px 6px; font-size: 11px;
            background: rgba(255,0,0,0.1);
        }
        #wnx-chain-mini.hidden { display: none; }
        #wnx-close-mobile { background: none; border: none; color: var(--text-mute); font-size: 18px; cursor: pointer; }

        /* PANELS */
        #wnx-panels { flex: 1; overflow-y: auto; padding: 0; scrollbar-width: thin; scrollbar-color: #333 #000; }
        .panel { display: none; padding: 15px; animation: slideIn 0.2s ease; }
        .panel.active { display: block; }

        /* COMPONENTS */
        .hud-card {
            background: rgba(255,255,255,0.02); border: 1px solid var(--border);
            padding: 12px; margin-bottom: 10px; position: relative;
        }
        .hud-card::before {
            content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--border);
        }
        .hud-card.prio::before { background: var(--primary); }
        .hud-card.alert::before { background: var(--danger); }
        
        .hud-header {
            font-family: var(--font-mono); font-size: 10px; color: var(--text-mute);
            margin-bottom: 8px; text-transform: uppercase; display: flex; justify-content: space-between;
        }
        
        .big-stat { font-size: 24px; font-family: var(--font-mono); color: #fff; font-weight: bold; }
        .sub-stat { font-size: 11px; color: var(--text-mute); }

        /* BUTTONS */
        .btn-act {
            background: var(--bg-dark); border: 1px solid var(--border);
            color: var(--text-main); padding: 6px 12px; cursor: pointer;
            font-family: var(--font-mono); font-size: 10px; text-transform: uppercase;
            transition: 0.2s;
        }
        .btn-act:hover { border-color: var(--primary); color: var(--primary); }
        .btn-act.danger:hover { border-color: var(--danger); color: var(--danger); }
        .btn-act.active { background: var(--primary); color: #000; border-color: var(--primary); font-weight: bold; }

        .btn-atk {
            display: inline-block; text-decoration: none;
            background: var(--danger-dim); border: 1px solid var(--danger);
            color: var(--danger); padding: 2px 6px; font-size: 9px;
            font-family: var(--font-mono); letter-spacing: 1px;
            transition: 0.2s;
        }
        .btn-atk:hover { background: var(--danger); color: #000; }

        /* TABLES */
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; color: var(--text-mute); font-family: var(--font-mono); font-size: 9px; padding: 5px; border-bottom: 1px solid var(--border); }
        td { padding: 8px 5px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        
        /* UTILS */
        .text-c { color: var(--primary); }
        .text-r { color: var(--danger); }
        .text-y { color: var(--warning); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .flex-row { display: flex; gap: 8px; align-items: center; }
        
        /* ANIMATIONS */
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes alarmPulse { 0% { opacity: 0.1; } 50% { opacity: 0.6; } 100% { opacity: 0.1; } }

        /* MOBILE OVERRIDES */
        @media (max-width: 450px) {
            #wnx-drawer { width: 100%; }
            .hide-mob { display: none; }
        }
    `;
    this.shadow.appendChild(s);
};

/* BLOCK: LOGIC & BINDINGS */

Major.bindInteractions = function(){
    this.btn.onclick = () => {
        this.drawer.classList.toggle("open");
        if(this.drawer.classList.contains("open")) this.nexus.events.emit("UI_DRAWER_OPENED");
    };

    const tabName = this.shadow.querySelector("#wnx-tab-name");
    this.shadow.querySelectorAll(".wnx-nav button").forEach(b => {
        b.onclick = () => {
            if(b.classList.contains("spacer")) return;
            this.shadow.querySelectorAll(".wnx-nav button").forEach(x => x.classList.remove("active"));
            this.shadow.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
            
            b.classList.add("active");
            this.activeTab = b.dataset.t;
            this.shadow.querySelector(`#p-${this.activeTab}`).classList.add("active");
            tabName.textContent = this.activeTab.toUpperCase();
            this.renderActiveTab();
        }
    });
};

Major.bindNexusEvents = function(){
    this.nexus.events.on("SITREP_UPDATE", d => {
        this.data.user = d.user;
        this.data.faction = d.factionMembers;
        this.data.enemy = d.enemyMembers;
        this.data.chain = d.chain;
        this.data.targets = d.targets || this.data.targets;
        this.data.ai = d.ai;
        this.checkAlerts();
        this.renderActiveTab();
        this.updateMiniHeader();
    });
    
    this.nexus.events.on("AI_MEMORY_UPDATE", mem => {
        this.data.aiMemory = mem || {};
        if(this.activeTab === "chain") this.renderChainGraph();
    });
};

Major.applyRenderHook = function(){
    if(this.renderHookApplied) return;
    const oldRender = this.renderActiveTab.bind(this);
    this.renderActiveTab = function(){
        oldRender();
        if(this.activeTab === "chain") this.renderChainGraph();
    };
    this.renderHookApplied = true;
};

/* BLOCK: ALERT SYSTEM */

Major.checkAlerts = function(){
    if(!this.alerts.enabled) {
        this.flashLayer.classList.remove("active");
        return;
    }

    const c = this.data.chain || {};
    const t = c.timeLeft ?? c.timeout ?? 0;
    
    // Trigger if chain active (>0 hits) and timeout < threshold
    if(c.hits > 0 && t > 0 && t <= this.alerts.threshold){
        if(this.alerts.flash) this.flashLayer.classList.add("active");
        if(this.alerts.audio) this.playBeep();
    } else {
        this.flashLayer.classList.remove("active");
    }
};

Major.playBeep = function(){
    // Simple throttle to prevent ear death
    const now = Date.now();
    if(this.lastBeep && (now - this.lastBeep < 2000)) return; 
    
    try {
        if(!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, this.audioCtx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
        this.lastBeep = now;
    } catch(e) {}
};

Major.updateMiniHeader = function(){
    const el = this.shadow.querySelector("#wnx-chain-mini");
    const c = this.data.chain || {};
    const t = c.timeLeft ?? c.timeout ?? 0;
    
    if(c.hits > 0){
        el.classList.remove("hidden");
        el.textContent = `${t}s`;
        el.style.color = t < 60 ? "var(--danger)" : "var(--primary)";
        el.style.borderColor = t < 60 ? "var(--danger)" : "var(--primary)";
    } else {
        el.classList.add("hidden");
    }
};

/* BLOCK: RENDERERS */

Major.renderActiveTab = function(){
    switch(this.activeTab){
        case "overview": this.renderOverview(); break;
        case "enemy": this.renderEnemy(); break;
        case "chain": this.renderChain(); break;
        case "targets": this.renderTargets(); break;
        case "settings": this.renderSettings(); break;
    }
};

/* TAB: OVERVIEW */
Major.renderOverview = function(){
    const p = this.shadow.querySelector("#p-overview");
    const u = this.data.user || {};
    const c = this.data.chain || {};
    const a = this.data.ai || {};
    const t = c.timeLeft ?? c.timeout ?? 0;
    
    if(!u.name) { p.innerHTML = "<div style='color:#666; padding:20px;'>INITIALIZING UPLINK...</div>"; return; }

    const hpPct = u.max_hp ? (u.hp / u.max_hp) * 100 : 0;
    const hpColor = hpPct < 30 ? "var(--danger)" : "var(--success)";

    p.innerHTML = `
        <div class="hud-card prio">
            <div class="hud-header">OPERATOR STATUS</div>
            <div style="display:flex; justify-content:space-between; align-items:end;">
                <div>
                    <div class="big-stat" style="color:${hpColor}">${u.hp} <span style="font-size:12px;color:#666">/ ${u.max_hp}</span></div>
                    <div class="sub-stat">${u.name} [Lv${u.level}]</div>
                </div>
                <div style="text-align:right;">
                    <div class="sub-stat" style="color:var(--primary);">${u.status}</div>
                </div>
            </div>
            <div style="height:4px; background:#222; margin-top:8px; width:100%;">
                <div style="height:100%; width:${hpPct}%; background:${hpColor}; transition: width 0.3s;"></div>
            </div>
        </div>

        <div class="hud-card ${t < 60 && c.hits > 0 ? 'alert' : ''}">
            <div class="hud-header">CHAIN LINK</div>
            <div class="grid-2">
                <div style="text-align:center;">
                    <div class="big-stat text-c">${c.hits || 0}</div>
                    <div class="sub-stat">HITS</div>
                </div>
                <div style="text-align:center;">
                    <div class="big-stat ${t<60?'text-r':'text-main'}">${t}s</div>
                    <div class="sub-stat">TIMEOUT</div>
                </div>
            </div>
        </div>

        <div class="hud-card">
            <div class="hud-header">TACTICAL AI</div>
            <div class="grid-2">
                <div>THREAT: <span style="color:${a.threat > 0.5?'var(--danger)':'var(--success)'}">${(a.threat*100).toFixed(0)}%</span></div>
                <div>RISK: <span style="color:${a.risk > 0.5?'var(--danger)':'var(--success)'}">${(a.risk*100).toFixed(0)}%</span></div>
            </div>
            <div style="margin-top:10px; font-size:11px; color:var(--text-mute); font-family:var(--font-mono); border-top:1px solid #222; padding-top:5px;">
                ${(a.summary||[]).map(x => `> ${x}`).join('<br>')}
            </div>
        </div>
    `;
};

/* TAB: ENEMY (With Filters & Attack Links) */
Major.renderEnemy = function(){
    const p = this.shadow.querySelector("#p-enemy");
    let list = this.data.enemy || [];
    
    // Filters
    if(this.filterHideHosp) list = list.filter(e => !(e.status||"").toLowerCase().includes("hospital"));
    if(this.filterHideTravel) list = list.filter(e => !(e.status||"").toLowerCase().includes("travel"));
    
    // Sort: Online > Score
    list.sort((a,b) => {
        if(a.online !== b.online) return b.online ? 1 : -1;
        return (b.score || 0) - (a.score || 0);
    });

    const rows = list.map(e => {
        const status = (e.status || "").toLowerCase();
        let sColor = "#666";
        if(status.includes("hospital")) sColor = "var(--danger)";
        else if(status.includes("travel")) sColor = "var(--primary)";
        else if(e.online) sColor = "var(--success)";

        return `
            <tr>
                <td style="color:${e.online ? 'var(--success)' : '#444'}; font-size:14px;">●</td>
                <td>
                    <div style="font-weight:bold; color:#eee;">${e.name}</div>
                    <div style="font-size:9px; color:#888;">Lv${e.level} • ${status}</div>
                </td>
                <td style="text-align:right;">
                    <a href="https://www.torn.com/loader.php?sid=attack&user2ID=${e.id}" target="_blank" class="btn-atk">ATK</a>
                </td>
            </tr>
        `;
    }).join("");

    p.innerHTML = `
        <div style="display:flex; gap:5px; margin-bottom:10px;">
            <button class="btn-act ${this.filterHideHosp?'active':''}" id="f-hosp">Hide Hosp</button>
            <button class="btn-act ${this.filterHideTravel?'active':''}" id="f-trav">Hide Trav</button>
        </div>
        <div class="hud-card" style="padding:0;">
            <table>
                <thead><tr><th width="10"></th><th>TARGET</th><th style="text-align:right">ACTION</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="3" style="padding:20px; text-align:center;">NO TARGETS FOUND</td></tr>'}</tbody>
            </table>
        </div>
    `;

    p.querySelector("#f-hosp").onclick = () => { this.filterHideHosp = !this.filterHideHosp; this.renderEnemy(); };
    p.querySelector("#f-trav").onclick = () => { this.filterHideTravel = !this.filterHideTravel; this.renderEnemy(); };
};

/* TAB: CHAIN (Graph + Alert Config) */
Major.renderChain = function(){
    const p = this.shadow.querySelector("#p-chain");
    const c = this.data.chain || {};
    
    p.innerHTML = `
        <div class="hud-card alert">
            <div class="hud-header">ALERT CONFIG</div>
            <div class="flex-row" style="justify-content:space-between; margin-bottom:8px;">
                <span>ENABLE ALERTS</span>
                <button class="btn-act ${this.alerts.enabled?'active':''}" id="c-tog">ON/OFF</button>
            </div>
            <div class="flex-row" style="justify-content:space-between; margin-bottom:8px;">
                <span>FLASH SCREEN</span>
                <button class="btn-act ${this.alerts.flash?'active':''}" id="c-fls">VISUAL</button>
            </div>
            <div class="flex-row" style="justify-content:space-between; margin-bottom:8px;">
                <span>AUDIO BEEP</span>
                <button class="btn-act ${this.alerts.audio?'active':''}" id="c-aud">AUDIO</button>
            </div>
            <div style="margin-top:10px;">
                <div class="sub-stat">PANIC THRESHOLD: <span class="text-c">${this.alerts.threshold}s</span></div>
                <input type="range" min="30" max="180" value="${this.alerts.threshold}" id="c-sld" style="width:100%; accent-color:var(--primary);">
            </div>
        </div>

        <div class="hud-card">
            <div class="hud-header">MOMENTUM GRAPH</div>
            <div id="wnx-chain-graph" style="height:150px;"></div>
        </div>
    `;

    // Bindings
    p.querySelector("#c-tog").onclick = () => { this.alerts.enabled = !this.alerts.enabled; this.saveSettings(); this.renderChain(); };
    p.querySelector("#c-fls").onclick = () => { this.alerts.flash = !this.alerts.flash; this.saveSettings(); this.renderChain(); };
    p.querySelector("#c-aud").onclick = () => { this.alerts.audio = !this.alerts.audio; this.saveSettings(); this.renderChain(); };
    p.querySelector("#c-sld").oninput = (e) => { this.alerts.threshold = parseInt(e.target.value); this.saveSettings(); p.querySelector(".text-c").textContent = this.alerts.threshold + "s"; };
};

/* TAB: TARGETS (Simplified List) */
Major.renderTargets = function(){
    const p = this.shadow.querySelector("#p-targets");
    const list = this.data.targets[this.targetSubTab] || [];
    
    const rows = list.map(t => `
        <tr>
            <td><b class="text-c">${t.name}</b> <span style="font-size:9px;color:#666">[${t.level}]</span></td>
            <td>${t.status}</td>
            <td style="text-align:right;">
                <a href="https://www.torn.com/loader.php?sid=attack&user2ID=${t.id}" target="_blank" class="btn-atk">ATK</a>
            </td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div style="display:flex; gap:5px; margin-bottom:10px;">
            <button class="btn-act ${this.targetSubTab==='personal'?'active':''}" id="t-per">Personal</button>
            <button class="btn-act ${this.targetSubTab==='war'?'active':''}" id="t-war">War</button>
            <button class="btn-act ${this.targetSubTab==='shared'?'active':''}" id="t-shr">Shared</button>
        </div>
        <div class="hud-card" style="padding:0;">
            <table>
                <thead><tr><th>NAME</th><th>STATUS</th><th style="text-align:right">ATK</th></tr></thead>
                <tbody>${list.length ? rows : '<tr><td colspan="3" style="padding:10px;text-align:center;">EMPTY</td></tr>'}</tbody>
            </table>
        </div>
    `;
    
    p.querySelector("#t-per").onclick = () => { this.targetSubTab = 'personal'; this.renderTargets(); };
    p.querySelector("#t-war").onclick = () => { this.targetSubTab = 'war'; this.renderTargets(); };
    p.querySelector("#t-shr").onclick = () => { this.targetSubTab = 'shared'; this.renderTargets(); };
};

/* TAB: SETTINGS */
Major.renderSettings = function(){
    const p = this.shadow.querySelector("#p-settings");
    p.innerHTML = `
        <div class="hud-card">
            <div class="hud-header">WINDOW SETTINGS</div>
            <button class="btn-act" style="width:100%; margin-bottom:5px;" id="s-det">
                ${this.detached ? 'DOCK TO LEFT' : 'DETACH WINDOW'}
            </button>
            <button class="btn-act" style="width:100%; margin-bottom:5px;" id="s-side">
                SIDE: ${this.attachedSide.toUpperCase()}
            </button>
            <button class="btn-act" style="width:100%;" id="s-scl">
                SCALE: ${this.dataScale.toFixed(1)}x
            </button>
        </div>
        <div class="hud-card alert">
            <div class="hud-header">DATA RESET</div>
            <button class="btn-act danger" style="width:100%;" id="s-rst">PURGE LOCAL CACHE</button>
        </div>
    `;
    
    p.querySelector("#s-det").onclick = () => {
        this.detached = !this.detached;
        this.applyWindowSettings();
        this.saveSettings();
        this.renderSettings();
    };
    p.querySelector("#s-side").onclick = () => {
        this.attachedSide = this.attachedSide === "left" ? "right" : "left";
        this.applyWindowSettings();
        this.saveSettings();
        this.renderSettings();
    };
    p.querySelector("#s-scl").onclick = () => {
        this.dataScale = (this.dataScale >= 1.5) ? 0.8 : this.dataScale + 0.1;
        this.applyWindowSettings();
        this.saveSettings();
        this.renderSettings();
    };
    p.querySelector("#s-rst").onclick = () => {
        localStorage.removeItem("WN_AI_HISTORY");
        this.nexus.log("Cache Purged");
    };
};

Major.applyWindowSettings = function(){
    const v = this.shadow.querySelector("#wnx-viewport");
    v.style.zoom = this.dataScale;
    
    if(this.detached){
        this.drawer.style.position = "absolute";
        this.drawer.style.height = "600px";
        this.drawer.style.width = "400px";
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

/* CHARTS */
Major.renderChainGraph = function(){
    if(!window.Chart) return;
    const container = this.shadow.querySelector("#wnx-chain-graph");
    if(!container || container.querySelector("canvas")) return;
    
    container.innerHTML = "<canvas></canvas>";
    const ctx = container.querySelector("canvas").getContext("2d");
    const pace = (this.data.aiMemory.chain || {}).pace || [];
    
    if(pace.length < 2) {
        ctx.fillStyle = "#555"; ctx.font = "10px monospace";
        ctx.fillText("INSUFFICIENT DATA", 10, 20); return;
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: pace.map(p => new Date(p.ts).toLocaleTimeString([], {minute:'2-digit'})),
            datasets: [{
                label: 'Hits',
                data: pace.map(p => p.hits),
                borderColor: '#0ff',
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                borderWidth: 1,
                pointRadius: 0,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { grid: { color: '#222' }, ticks: { color: '#666', font: {size: 9} } }
            },
            animation: false
        }
    });
};

/* REGISTRATION */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Major", module: Major });

})();
