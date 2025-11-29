// major.js — WAR ROOM COMMAND INTERFACE (v3.0)

////////////////////////////////////////////////////////////
// MAJOR — THE WAR ROOM
// - Dynamic "War" tab (Upcoming vs Active)
// - Faction Roster Table
// - Enemy Filtered Table
// - AI Command Dashboard
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
    targetSubTab: "war",
    
    // Filters
    enemyFilters: { hideHosp: false, hideTravel: false },

    // Config
    alerts: { enabled: true, threshold: 90, flash: true },
    dataScale: 1.0,
    
    // Data Store
    data: {
        user: {},
        faction: [],
        chain: {},
        war: {}, // Raw war object
        targets: { personal: [], war: [], shared: [] },
        ai: { topTargets: [], summary: [] },
        aiMemory: {}
    }
};

/* BLOCK: INIT */

Major.init = function(nexus){
    this.nexus = nexus;
    this.createHost();
    this.createUI();
    this.applyTacticalStyles();
    this.bindInteractions();
    this.bindNexusEvents();
    this.loadSettings();
};

/* BLOCK: UI BUILDER */

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
    const I = {
        dash: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
        war: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`,
        chain: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`,
        target: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 13l-1-1 4-4-4-4 1-1 5 5-5 5z"/></svg>`,
        faction: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
        ai: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 14H4v-4h8v4zm0-6H4V8h8v4zm8 6h-6v-4h6v4zm0-6h-6V8h6v4z"/></svg>`
    };

    this.shadow.innerHTML = `
        <div id="wnx-trigger">W</div>
        <div id="wnx-alert-layer"></div>
        
        <div id="wnx-drawer" class="closed">
            <div id="wnx-sidebar">
                <div class="wnx-brand">WN</div>
                <div class="wnx-nav">
                    <button data-t="overview" class="active" title="Overview">${I.dash}</button>
                    <button data-t="war" title="War Room">${I.war}</button>
                    <button data-t="enemy" title="Enemies">${I.target}</button>
                    <button data-t="chain" title="Chain">${I.chain}</button>
                    <button data-t="faction" title="Faction">${I.faction}</button>
                    <button data-t="ai" title="AI Console">${I.ai}</button>
                    <div class="spacer"></div>
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
                    <div id="p-enemy" class="panel"></div>
                    <div id="p-chain" class="panel"></div>
                    <div id="p-faction" class="panel"></div>
                    <div id="p-ai" class="panel"></div>
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
            --bg: #050505; --panel: rgba(14, 18, 22, 0.96); --border: #333;
            --primary: #0ff; --danger: #ff003c; --warn: #ffcc00; --ok: #00ff9d;
            --text: #eee; --mute: #777;
            --mono: "Consolas", monospace; --ui: "Segoe UI", sans-serif;
            all: initial;
        }
        * { box-sizing: border-box; }
        
        #wnx-trigger {
            position: fixed; bottom: 15px; left: 15px; width: 48px; height: 48px;
            background: #000; border: 2px solid var(--primary); color: var(--primary);
            display: flex; align-items: center; justify-content: center;
            font-family: var(--mono); font-weight: 900; font-size: 20px;
            cursor: pointer; z-index: 10000; transition: 0.2s;
            clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%);
        }
        #wnx-trigger:hover { transform: scale(1.1); box-shadow: 0 0 15px var(--primary); }

        #wnx-drawer {
            position: fixed; top: 0; left: 0; height: 100vh; width: 500px; max-width: 100vw;
            background: var(--panel); border-right: 1px solid var(--border);
            display: flex; transform: translateX(-100%); transition: transform 0.25s;
            color: var(--text); font-family: var(--ui); box-shadow: 10px 0 50px #000;
        }
        #wnx-drawer.open { transform: translateX(0); }
        
        #wnx-sidebar { width: 50px; background: #000; border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; padding: 10px 0; }
        .wnx-nav button { background: none; border: none; color: var(--mute); padding: 12px; cursor: pointer; width: 100%; border-left: 2px solid transparent; }
        .wnx-nav button.active { color: var(--primary); border-left-color: var(--primary); background: rgba(0,255,255,0.05); }
        .wnx-nav svg { width: 22px; height: 22px; }
        .spacer { flex: 1; }
        
        #wnx-viewport { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(180deg, rgba(0,255,255,0.01) 0%, #000 100%); }
        .wnx-header { height: 44px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 15px; justify-content: space-between; background: rgba(0,0,0,0.5); }
        .wnx-title { font-family: var(--mono); font-size: 11px; color: var(--mute); letter-spacing: 1px; }
        .wnx-title span { color: var(--primary); font-weight: bold; }
        #wnx-close { background: none; border: none; color: var(--mute); cursor: pointer; font-size: 16px; }

        #wnx-panels { flex: 1; overflow-y: auto; padding: 0; scrollbar-width: thin; scrollbar-color: #333 #000; }
        .panel { display: none; padding: 15px; }
        .panel.active { display: block; }
        
        .card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 10px; margin-bottom: 10px; position: relative; }
        .card.prio { border-left: 2px solid var(--primary); }
        .card.alert { border-left: 2px solid var(--danger); }
        .card-head { font-family: var(--mono); font-size: 10px; color: var(--mute); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .stat-big { font-size: 20px; font-family: var(--mono); color: #fff; font-weight: bold; }
        .stat-sm { font-size: 10px; color: var(--mute); }
        .text-c { color: var(--primary); } .text-r { color: var(--danger); } .text-y { color: var(--warn); } .text-g { color: var(--ok); }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; color: var(--mute); font-family: var(--mono); font-size: 9px; padding: 4px; border-bottom: 1px solid var(--border); }
        td { padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        
        .btn-act { background: #000; border: 1px solid var(--border); color: var(--text); padding: 4px 8px; cursor: pointer; font-family: var(--mono); font-size: 9px; text-transform: uppercase; margin-right: 4px; }
        .btn-act.active { background: var(--primary); color: #000; border-color: var(--primary); font-weight: bold; }
        
        .btn-atk { text-decoration: none; background: rgba(255,0,60,0.1); border: 1px solid var(--danger); color: var(--danger); padding: 2px 6px; font-size: 9px; font-family: var(--mono); transition: 0.2s; display: inline-block; }
        .btn-atk:hover { background: var(--danger); color: #000; }
        
        .term { background: #000; border: 1px solid var(--border); padding: 10px; height: 200px; overflow-y: auto; font-family: var(--mono); font-size: 11px; color: #ccc; }
        .term-input { width: 100%; background: #111; border: 1px solid var(--border); color: var(--primary); font-family: var(--mono); padding: 8px; margin-top: 5px; outline: none; }
        .term-line { margin-bottom: 4px; }
        
        @media (max-width: 500px) { #wnx-drawer { width: 100%; } }
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
        this.data.enemy = d.enemyMembers;
        this.data.targets.war = d.ai?.topTargets || [];
        this.renderActiveTab();
    });
    
    this.nexus.events.on("ASK_COLONEL_RESPONSE", d => {
        this.appendTermLine(d.answer, true);
    });
};

/* BLOCK: LOGIC */

Major.loadSettings = function(){
    try {
        const s = JSON.parse(localStorage.getItem("WN_MAJOR_CFG"));
        if(s) { this.alerts = s.alerts; this.dataScale = s.dataScale; }
    } catch(e) {}
    this.shadow.querySelector("#wnx-viewport").style.zoom = this.dataScale;
};

Major.renderActiveTab = function(){
    if(this.activeTab === "overview") this.renderOverview();
    else if(this.activeTab === "war") this.renderWar();
    else if(this.activeTab === "enemy") this.renderEnemy();
    else if(this.activeTab === "faction") this.renderFaction();
    else if(this.activeTab === "chain") this.renderChain();
    else if(this.activeTab === "ai") this.renderAI();
};

/* --- RENDERERS --- */

Major.renderOverview = function(){
    const p = this.shadow.querySelector("#p-overview");
    const u = this.data.user || {};
    const c = this.data.chain || {};
    const t = c.timeLeft ?? c.timeout ?? 0;
    const a = this.data.ai || { summary: [] };
    
    if(!u.name) { p.innerHTML = "<div style='padding:20px;color:#555'>CONNECTING...</div>"; return; }
    
    p.innerHTML = `
        <div class="card prio">
            <div class="card-head">OPERATOR</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div><div class="stat-lg" style="color:var(--primary)">${u.name}</div><div class="stat-sm">Lv${u.level}</div></div>
                <div style="text-align:right"><div class="stat-lg text-g">${u.hp}</div><div class="stat-sm">HP / ${u.max_hp}</div></div>
            </div>
        </div>
        
        <div class="grid-2">
            <div class="card">
                <div class="card-head">CHAIN</div>
                <div class="stat-lg text-c">${c.hits||0}</div>
                <div class="stat-sm">HITS</div>
            </div>
            <div class="card ${t<60?'alert':''}">
                <div class="card-head">TIMEOUT</div>
                <div class="stat-lg ${t<60?'text-r':'text-text'}">${t}s</div>
                <div class="stat-sm">SEC</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-head">AI SUMMARY</div>
            <div style="font-size:11px; color:#888; font-family:var(--mono); line-height:1.4">
                ${a.summary.length ? a.summary.map(x => `> ${x}`).join('<br>') : "> ALL QUIET"}
            </div>
        </div>
    `;
};

Major.renderWar = function(){
    const p = this.shadow.querySelector("#p-war");
    const warData = this.data.war || {};
    // Calculate if we have an active ranked war
    // Often torn API returns war info in 'wars' object
    let activeWar = null;
    let upcomingWar = null;
    
    if (warData.wars) {
        Object.values(warData.wars).forEach(w => {
            // Timestamp based check (API V2 usually gives start/end)
            const now = Date.now() / 1000;
            if(w.start > now) upcomingWar = w;
            else if (w.end > now || w.end === 0) activeWar = w;
        });
    }

    if(activeWar) {
        // ACTIVE WAR VIEW
        p.innerHTML = `
            <div class="card alert">
                <div class="card-head">ACTIVE ENGAGEMENT</div>
                <div style="text-align:center; padding:10px;">
                    <div class="stat-lg text-r">WAR IN PROGRESS</div>
                    <div class="stat-sm">ENEMY FACTION ID: ${activeWar.opponent || activeWar.enemy_faction}</div>
                </div>
                <div class="grid-2" style="margin-top:10px;">
                    <div style="text-align:center; background:#111; padding:5px;">
                        <div class="stat-lg text-g">US</div>
                        <div class="stat-sm">SCORE</div>
                    </div>
                    <div style="text-align:center; background:#111; padding:5px;">
                        <div class="stat-lg text-r">THEM</div>
                        <div class="stat-sm">SCORE</div>
                    </div>
                </div>
            </div>
        `;
    } else if (upcomingWar) {
        // UPCOMING VIEW
        const start = new Date(upcomingWar.start * 1000).toLocaleString();
        p.innerHTML = `
            <div class="card prio">
                <div class="card-head">SCHEDULED CONFLICT</div>
                <div style="padding:15px; text-align:center;">
                    <div class="stat-lg text-y">UPCOMING</div>
                    <div style="margin-top:10px; font-size:12px;">STARTS: ${start}</div>
                    <div style="margin-top:5px; font-size:11px; color:#666;">PREPARE FOR DEPLOYMENT</div>
                </div>
            </div>
        `;
    } else {
        // PEACE VIEW
        p.innerHTML = `
            <div class="card">
                <div class="card-head">WAR STATUS</div>
                <div style="text-align:center; padding:30px; color:#444;">
                    NO ACTIVE CONFLICTS
                </div>
            </div>
        `;
    }
};

Major.renderEnemy = function(){
    const p = this.shadow.querySelector("#p-enemy");
    let list = this.data.enemy || [];
    
    // Filters
    if(this.enemyFilters.hideHosp) list = list.filter(e => !(e.status||"").toLowerCase().includes("hospital"));
    if(this.enemyFilters.hideTravel) list = list.filter(e => !(e.status||"").toLowerCase().includes("travel"));
    
    // Sorting (Online > Level)
    list.sort((a,b) => (b.online?1:0) - (a.online?1:0) || b.level - a.level);

    const rows = list.map(e => `
        <tr>
            <td style="color:${e.online?'var(--ok)':'#444'}">●</td>
            <td>
                <div style="font-weight:bold; color:#eee;">${e.name}</div>
                <div style="font-size:9px; color:#666;">Lv${e.level} • ${e.status}</div>
            </td>
            <td style="text-align:right;">
                <a href="https://www.torn.com/loader.php?sid=attack&user2ID=${e.id}" target="_blank" class="btn-atk">ATK</a>
            </td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div style="margin-bottom:10px;">
            <button class="btn-act ${this.enemyFilters.hideHosp?'active':''}" id="f-hosp">HIDE HOSP</button>
            <button class="btn-act ${this.enemyFilters.hideTravel?'active':''}" id="f-trav">HIDE TRAV</button>
        </div>
        <div class="card" style="padding:0;">
            <div class="card-head" style="padding:10px;">HOSTILES (${list.length})</div>
            <table>
                <thead><tr><th width="10"></th><th>TARGET</th><th style="text-align:right">OP</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="3" style="text-align:center;padding:15px;">NO TARGETS</td></tr>'}</tbody>
            </table>
        </div>
    `;
    
    p.querySelector("#f-hosp").onclick = () => { this.enemyFilters.hideHosp = !this.enemyFilters.hideHosp; this.renderEnemy(); };
    p.querySelector("#f-trav").onclick = () => { this.enemyFilters.hideTravel = !this.enemyFilters.hideTravel; this.renderEnemy(); };
};

Major.renderFaction = function(){
    const p = this.shadow.querySelector("#p-faction");
    const list = this.data.faction || [];
    
    list.sort((a,b) => (b.online?1:0) - (a.online?1:0));

    const rows = list.map(m => `
        <tr>
            <td style="color:${m.online?'var(--ok)':'#444'}">●</td>
            <td style="color:#ddd">${m.name} <span style="color:#555;font-size:9px;">[${m.level}]</span></td>
            <td style="text-align:right; font-size:10px; color:#888;">${m.status}</td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div class="card" style="padding:0;">
            <div class="card-head" style="padding:10px;">ROSTER (${list.length})</div>
            <table>
                <thead><tr><th width="10"></th><th>NAME</th><th style="text-align:right">STATUS</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

Major.renderAI = function(){
    const p = this.shadow.querySelector("#p-ai");
    
    // Preserve terminal history if it exists
    const oldTerm = p.querySelector(".term");
    const history = oldTerm ? oldTerm.innerHTML : '<div class="term-line">> COLONEL AI ONLINE.</div>';

    p.innerHTML = `
        <div class="card">
            <div class="card-head">COMMAND UPLINK</div>
            <div class="term" id="ai-term">${history}</div>
            <input type="text" class="term-input" id="ai-input" placeholder="ENTER COMMAND..." autocomplete="off">
        </div>
        <div class="grid-2">
            <button class="btn-act" id="cmd-stat">STATUS</button>
            <button class="btn-act" id="cmd-tgt">TARGET</button>
            <button class="btn-act" id="cmd-war">WAR</button>
            <button class="btn-act" id="cmd-help">HELP</button>
        </div>
    `;
    
    const term = p.querySelector("#ai-term");
    const inp = p.querySelector("#ai-input");
    
    const send = (txt) => {
        this.appendTermLine(`> ${txt}`, false);
        this.nexus.events.emit("ASK_COLONEL", { question: txt });
    };

    inp.onkeydown = (e) => {
        if(e.key === "Enter" && inp.value.trim()){
            send(inp.value.trim());
            inp.value = "";
        }
    };
    
    p.querySelector("#cmd-stat").onclick = () => send("status");
    p.querySelector("#cmd-tgt").onclick = () => send("target");
    p.querySelector("#cmd-war").onclick = () => send("war");
    p.querySelector("#cmd-help").onclick = () => send("help");
    
    term.scrollTop = term.scrollHeight;
};

Major.appendTermLine = function(txt, isResponse){
    const term = this.shadow.querySelector("#ai-term");
    if(!term) return;
    const div = document.createElement("div");
    div.className = "term-line";
    div.style.color = isResponse ? "var(--primary)" : "#888";
    div.textContent = txt;
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
};

/* MISC */
Major.renderChain = function(){
    const p = this.shadow.querySelector("#p-chain");
    const c = this.data.chain || {};
    p.innerHTML = `
        <div class="card">
            <div class="card-head">CHAIN DETAILS</div>
            <div class="grid-2">
                 <div style="text-align:center"><div class="stat-lg">${c.hits||0}</div><div class="stat-sm">HITS</div></div>
                 <div style="text-align:center"><div class="stat-lg">${c.modifier||"1.00"}x</div><div class="stat-sm">MULT</div></div>
            </div>
        </div>
    `;
};

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Major", module: Major });

})();
