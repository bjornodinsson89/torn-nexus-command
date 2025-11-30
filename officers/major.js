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

    activeTab: "overview",
    enemyFilters: { hideHosp: false, hideTravel: false },

    data: {
        user: {},
        faction: [],
        chain: {},
        war: {},
        ai: {},
        enemy: [],
        logs: []
    },

    MAX_LOGS: 300
};

/* ============================================================
   INIT
   ============================================================ */
Major.init = function(nexus){
    this.nexus = nexus;

    this.createHost();
    this.createUI();
    this.bindEvents();
    this.bindNexusLogs();

    this.renderActiveTab();
};

/* ============================================================
   LOGGING (INSIDE SETTINGS TAB)
   ============================================================ */
Major.pushLog = function(msg, level="info"){
    const t = new Date().toLocaleTimeString();
    this.data.logs.push({ ts:t, msg, level });

    if (this.data.logs.length > this.MAX_LOGS)
        this.data.logs.splice(0, 50);

    const panel = this.shadow?.querySelector("#p-logs");
    if (panel) this.renderLogs();
};

/* Bind WAR_NEXUS.log() interception */
Major.bindNexusLogs = function(){
    const original = this.nexus.log;
    this.nexus.log = (txt) => {
        try { this.pushLog(txt, "info"); }
        catch(e){ console.warn("Major log error:", e); }
        original(txt);
    };

    this.nexus.events.on("ERROR", err => {
        this.pushLog(err, "error");
    });
};

/* ============================================================
   CREATE HOST & UI
   ============================================================ */
Major.createHost = function(){
    if (document.getElementById("war-nexus-major")) return;
    this.host = document.createElement("div");
    this.host.id = "war-nexus-major";
    this.shadow = this.host.attachShadow({ mode:"open" });
    document.body.appendChild(this.host);
};

Major.createUI = function(){
    const I = {
        dash: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
        war: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`,
        enemy: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 13l-1-1 4-4-4-4 1-1 5 5-5 5z"/></svg>`,
        chain: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`,
        faction: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
        ai: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 14H4v-4h8v4zm0-6H4V8h8v4zm8 6h-6v-4h6v4zm0-6h-6V8h6v4z"/></svg>`,
        logs: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z"/></svg>`
    };

    this.shadow.innerHTML = `
        <style>
            :host {
                --bg:#050505; --panel:#0c0f11; --border:#222;
                --primary:#0ff; --warn:#ffcc00; --danger:#ff2255; --ok:#00ff9d;
                --text:#ddd; --mute:#666;
                font-family:Segoe UI, sans-serif;
            }
            *{box-sizing:border-box; margin:0; padding:0;}
            #trigger{position:fixed;bottom:16px;right:16px;width:50px;height:50px;
                background:#000;border:2px solid var(--primary);color:var(--primary);
                display:flex;align-items:center;justify-content:center;font-weight:bold;
                cursor:pointer;z-index:999999;}
            #drawer{position:fixed;top:0;right:0;width:440px;max-width:100%;height:100vh;
                background:var(--panel);transform:translateX(100%);
                transition:0.3s;border-left:1px solid var(--border);
                display:flex;flex-direction:column;z-index:999998;}
            #drawer.open{transform:translateX(0);}
            #tabs{display:flex;background:#000;border-bottom:1px solid var(--border);}
            #tabs button{flex:1;padding:10px;background:#000;border:0;color:var(--mute);
                cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;}
            #tabs button.active{color:var(--primary);border-bottom:2px solid var(--primary);}
            #panels{flex:1;overflow-y:auto;padding:12px;}
            .panel{display:none;}
            .panel.active{display:block;}
            .card{background:#111;border:1px solid var(--border);padding:10px;margin-bottom:10px;}
            table{width:100%;border-collapse:collapse;font-size:12px;}
            th{color:var(--mute);border-bottom:1px solid var(--border);padding:5px;text-align:left;}
            td{padding:6px;border-bottom:1px solid #1a1a1a;}
            .btn{background:#000;border:1px solid var(--border);color:var(--text);
                padding:4px 8px;cursor:pointer;}
            .btn.active{background:var(--primary);color:#000;}
            #logbox{background:#000;border:1px solid #333;padding:10px;
                height:280px;overflow-y:auto;font-size:11px;font-family:Consolas, monospace;color:#aaa;}
            .log-entry{margin-bottom:4px;}
            .log-error{color:var(--danger);}
            .log-info{color:var(--primary);}
        </style>

        <div id="trigger">W</div>

        <div id="drawer">
            <div id="tabs">
                <button data-t="overview" class="active">${I.dash}<span>OVERVIEW</span></button>
                <button data-t="war">${I.war}<span>WAR</span></button>
                <button data-t="enemy">${I.enemy}<span>ENEMY</span></button>
                <button data-t="chain">${I.chain}<span>CHAIN</span></button>
                <button data-t="faction">${I.faction}<span>FACTION</span></button>
                <button data-t="ai">${I.ai}<span>AI</span></button>
                <button data-t="logs">${I.logs}<span>LOGS</span></button>
            </div>

            <div id="panels">
                <div id="p-overview" class="panel active"></div>
                <div id="p-war" class="panel"></div>
                <div id="p-enemy" class="panel"></div>
                <div id="p-chain" class="panel"></div>
                <div id="p-faction" class="panel"></div>
                <div id="p-ai" class="panel"></div>
                <div id="p-logs" class="panel"></div>
            </div>
        </div>
    `;
};

/* ============================================================
   EVENT BINDING
   ============================================================ */
Major.bindEvents = function(){
    const trigger = this.shadow.querySelector("#trigger");
    trigger.onclick = () => {
        const d = this.shadow.querySelector("#drawer");
        d.classList.toggle("open");
        if (d.classList.contains("open"))
            this.nexus.events.emit("UI_DRAWER_OPENED");
    };

    this.shadow.querySelectorAll("#tabs button").forEach(btn => {
        btn.onclick = () => {
            this.activeTab = btn.dataset.t;

            this.shadow.querySelectorAll("#tabs button").forEach(x => x.classList.remove("active"));
            btn.classList.add("active");

            this.shadow.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
            this.shadow.querySelector(`#p-${this.activeTab}`).classList.add("active");

            this.renderActiveTab();
        };
    });

    this.nexus.events.on("SITREP_UPDATE", data => {
        try{
            this.data.user = data.user;
            this.data.faction = data.factionMembers;
            this.data.chain = data.chain;
            this.data.war = data.war;
            this.data.ai = data.ai;
            this.data.enemy = data.enemyMembers;
            this.renderActiveTab();
        } catch(e){
            this.pushLog("Render error: "+e, "error");
        }
    });

    this.nexus.events.on("ASK_COLONEL_RESPONSE", d => {
        this.renderAIResponse(d.answer);
    });
};

/* ============================================================
   RENDERING
   ============================================================ */
Major.renderActiveTab = function(){
    if (this.activeTab === "overview") this.renderOverview();
    if (this.activeTab === "war") this.renderWar();
    if (this.activeTab === "enemy") this.renderEnemy();
    if (this.activeTab === "chain") this.renderChain();
    if (this.activeTab === "faction") this.renderFaction();
    if (this.activeTab === "ai") this.renderAI();
    if (this.activeTab === "logs") this.renderLogs();
};

Major.renderOverview = function(){
    const p = this.shadow.querySelector("#p-overview");
    const u = this.data.user;
    const c = this.data.chain;

    if (!u || !u.name){
        p.innerHTML = `<div class="card">WAITING FOR DATA...</div>`;
        return;
    }

    p.innerHTML = `
        <div class="card">
            <h3>Operator</h3>
            <div>Name: ${u.name}</div>
            <div>Level: ${u.level}</div>
            <div>Status: ${u.status}</div>
            <div>HP: ${u.hp}/${u.max_hp}</div>
        </div>

        <div class="card">
            <h3>Chain</h3>
            <div>Hits: ${c.hits}</div>
            <div>Timeout: ${c.timeout}s</div>
            <div>Modifier: ${c.modifier}x</div>
        </div>

        <div class="card">
            <h3>AI Summary</h3>
            <div>${this.data.ai.summary?.join("<br>") || "None"}</div>
        </div>
    `;
};

Major.renderWar = function(){
    const p = this.shadow.querySelector("#p-war");
    const war = this.data.war?.wars || {};

    if (!war || Object.keys(war).length===0){
        p.innerHTML = `<div class="card">No active wars.</div>`;
        return;
    }

    p.innerHTML = `
        <div class="card"><h3>War Status</h3><pre>${JSON.stringify(war,null,2)}</pre></div>
    `;
};

Major.renderEnemy = function(){
    const p = this.shadow.querySelector("#p-enemy");
    let list = [...this.data.enemy];

    if (this.enemyFilters.hideHosp)
        list = list.filter(e => !(e.status||"").toLowerCase().includes("hospital"));
    if (this.enemyFilters.hideTravel)
        list = list.filter(e => !(e.status||"").toLowerCase().includes("travel"));

    list.sort((a,b)=>b.level-a.level);

    const rows = list.map(e => `
        <tr>
            <td>${e.online?"🟢":"⚫"}</td>
            <td>${e.name} (Lv ${e.level})<br><span style="color:#666">${e.status}</span></td>
            <td><a class="btn" target="_blank" href="https://www.torn.com/loader.php?sid=attack&user2ID=${e.id}">Attack</a></td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div style="margin-bottom:8px;">
            <button class="btn ${this.enemyFilters.hideHosp?"active":""}" id="hide-hosp">Hide Hosp</button>
            <button class="btn ${this.enemyFilters.hideTravel?"active":""}" id="hide-trav">Hide Travel</button>
        </div>

        <div class="card">
            <table>
                <thead><tr><th></th><th>Enemy</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    this.shadow.querySelector("#hide-hosp").onclick = ()=>{ this.enemyFilters.hideHosp=!this.enemyFilters.hideHosp; this.renderEnemy(); };
    this.shadow.querySelector("#hide-trav").onclick = ()=>{ this.enemyFilters.hideTravel=!this.enemyFilters.hideTravel; this.renderEnemy(); };
};

Major.renderChain = function(){
    const p = this.shadow.querySelector("#p-chain");
    const c = this.data.chain;

    p.innerHTML = `
        <div class="card">
            <h3>Chain Details</h3>
            <div>Hits: ${c.hits}</div>
            <div>Timeout: ${c.timeout}s</div>
            <div>Modifier: ${c.modifier}x</div>
            <div>Cooldown: ${c.cooldown}s</div>
        </div>
    `;
};

Major.renderFaction = function(){
    const p = this.shadow.querySelector("#p-faction");
    const list = this.data.faction || [];

    const rows = list.map(m => `
        <tr>
            <td>${m.online?"🟢":"⚫"}</td>
            <td>${m.name} (Lv ${m.level})</td>
            <td>${m.status}</td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div class="card">
            <table>
                <thead><tr><th></th><th>Member</th><th>Status</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

Major.renderAI = function(){
    const p = this.shadow.querySelector("#p-ai");

    const history = this.aiHistory || [];

    p.innerHTML = `
        <div class="card">
            <div id="ai-output" style="height:200px;overflow-y:auto;background:#000;padding:8px;font-family:Consolas;">
                ${history.map(x=>`<div>>> ${x}</div>`).join("")}
            </div>
            <input id="ai-input" placeholder="Enter command..." style="width:100%;padding:6px;background:#111;border:1px solid #333;color:#0ff;margin-top:6px;">
        </div>
    `;

    const input = this.shadow.querySelector("#ai-input");
    input.onkeydown = (e)=>{
        if (e.key!=="Enter") return;
        const msg = input.value.trim();
        if (!msg) return;
        input.value = "";

        this.nexus.events.emit("ASK_COLONEL", { question: msg });
    };
};

Major.renderAIResponse = function(text){
    this.aiHistory = this.aiHistory || [];
    this.aiHistory.push(text);
    if (this.aiHistory.length > 200) this.aiHistory.splice(0,50);
    this.renderAI();
};

/* ============================================================
   LOG PANEL
   ============================================================ */
Major.renderLogs = function(){
    const p = this.shadow.querySelector("#p-logs");

    const lines = this.data.logs.map(l => `
        <div class="log-entry ${l.level==="error"?"log-error":"log-info"}">
            [${l.ts}] ${l.level.toUpperCase()}: ${l.msg}
        </div>
    `).join("");

    p.innerHTML = `
        <div class="card">
            <h3>System Logs</h3>
            <div id="logbox">${lines}</div>
        </div>
    `;
};

/* ============================================================
   REGISTER
   ============================================================ */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name:"Major", module: Major });

})();
