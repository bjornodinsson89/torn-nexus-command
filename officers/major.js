(function(){
"use strict";

/* =======================================================================
   MAJOR — DARK OPS TACTICAL UI MODULE
   Horizontal Top Navigation
   Real-time & Historical Chain Graphs
   Heatmaps
   Tables
   Full AI Console
   Internal Log Panel
   ======================================================================= */

const Major = {
    nexus: null,
    host: null,
    shadow: null,
    drawer: null,

    activeTab: "overview",
    enemyFilters: { hideHosp:false, hideTravel:false },

    data: {
        user: {},
        factionMembers: [],
        chain: {},
        war: {},
        ai: {},
        enemy: [],
        logs: []
    },

    chainReal: [],        // real-time dataset
    chainHistoric: [],    // from Firebase

    chainGraph: null,
    chainHistoricGraph: null,

    MAX_LOGS: 300
};

/* =======================================================================
   INIT
   ======================================================================= */
Major.init = function(nexus){
    this.nexus = nexus;

    this.createHost();
    this.createUI();
    this.bindEvents();
    this.bindNexusLogs();

    this.renderActiveTab();
};

/* =======================================================================
   LOGGING
   ======================================================================= */
Major.pushLog = function(msg, level="info"){
    const t = new Date().toLocaleTimeString();
    this.data.logs.push({ ts:t, msg, level });

    if (this.data.logs.length > this.MAX_LOGS)
        this.data.logs.splice(0, 50);

    if (this.activeTab==="logs") this.renderLogs();
};

Major.bindNexusLogs = function(){
    const orig = this.nexus.log;
    this.nexus.log = txt => {
        try { this.pushLog(txt); } catch(e){}
        orig(txt);
    };

    this.nexus.events.on("ERROR", err => this.pushLog(err, "error"));
};

/* =======================================================================
   HOST + UI CREATION
   ======================================================================= */
Major.createHost = function(){
    if (document.getElementById("war-nexus-major")) return;
    this.host = document.createElement("div");
    this.host.id = "war-nexus-major";
    this.shadow = this.host.attachShadow({ mode:"open" });
    document.body.appendChild(this.host);
};

Major.createUI = function(){
    this.shadow.innerHTML = `
        <style>
            :host {
                --bg:#0a0a0a;
                --panel:#111;
                --border:#1e1e1e;
                --accent:#00e5ff;
                --accent2:#00ffbf;
                --danger:#ff2255;
                --warn:#ffcc00;
                --text:#dcdcdc;
                --mute:#777;
                --font:Segoe UI,Roboto,Helvetica,Arial,sans-serif;
            }
            *, *::before, *::after { box-sizing:border-box; }

            #trigger {
                position:fixed; bottom:20px; right:20px;
                width:46px; height:46px;
                background:#000;
                border:1px solid var(--accent);
                border-radius:4px;
                color:var(--accent);
                font-family:var(--font);
                display:flex;align-items:center;justify-content:center;
                cursor:pointer;z-index:999999;
                transition:0.2s;
            }
            #trigger:hover {
                box-shadow:0 0 8px var(--accent);
            }

            #drawer {
                position:fixed; top:0; right:0;
                width:600px; max-width:100%; height:100vh;
                background:var(--bg);
                border-left:1px solid var(--border);
                transform:translateX(100%);
                transition:0.32s;
                z-index:999998;
                display:flex; flex-direction:column;
            }
            #drawer.open { transform:translateX(0); }

            #tabs {
                display:flex; flex-shrink:0;
                background:#000;
                border-bottom:1px solid var(--border);
            }
            #tabs button {
                flex:1; padding:12px 0;
                background:#000;
                border:0; color:var(--mute);
                display:flex; flex-direction:column; gap:4px;
                align-items:center; justify-content:center;
                font-family:var(--font); font-size:12px;
                cursor:pointer; transition:0.2s;
            }
            #tabs button svg { width:20px; height:20px; fill:currentColor; }
            #tabs button.active { color:var(--accent); }

            #panels {
                flex:1; overflow-y:auto; padding:16px;
            }
            .panel { display:none; }
            .panel.active { display:block; }

            .card {
                background:var(--panel);
                border:1px solid var(--border);
                padding:14px; border-radius:4px;
                margin-bottom:14px;
            }

            table { width:100%; border-collapse:collapse; font-size:13px; }
            th {
                padding:6px; text-align:left;
                font-weight:600; color:var(--accent2);
                border-bottom:1px solid var(--border);
            }
            td { padding:6px; border-bottom:1px solid #1a1a1a; color:var(--text); }

            .btn {
                padding:4px 8px;
                background:#000; border:1px solid var(--border);
                color:var(--text); font-size:12px;
                cursor:pointer; border-radius:3px;
            }
            .btn:hover { border-color:var(--accent); color:var(--accent); }

            #chainGraph, #chainHistoricGraph {
                width:100%; height:240px; margin-top:10px;
            }

            /* AI Console */
            #ai-console {
                background:#000;
                border:1px solid var(--border);
                padding:12px; border-radius:4px;
                font-family:Consolas,monospace;
            }
            #ai-log { max-height:250px; overflow-y:auto; margin-bottom:10px; }
            .ai-user { color:var(--accent2); margin-bottom:4px; }
            .ai-colonel { color:var(--accent); margin-bottom:8px; }
            #ai-input {
                width:100%; padding:8px;
                background:#111; border:1px solid var(--border);
                border-radius:3px; color:var(--text);
            }

            /* Log Panel */
            #logbox {
                background:#000; border:1px solid #333;
                padding:10px; height:300px;
                overflow-y:auto; font-size:11px;
                font-family:Consolas,monospace;
            }
            .log-entry{ margin-bottom:4px; }
            .log-error{ color:var(--danger); }
            .log-info{ color:var(--accent); }

            /* Heatmaps */
            .heatmap {
                display:grid; grid-template-columns:repeat(24,1fr);
                gap:2px; padding:4px 0;
            }
            .heat {
                height:20px; border-radius:2px;
                background:linear-gradient(180deg,#111,#0a0a0a);
                transition:background 0.2s;
            }
        </style>

        <div id="trigger">W</div>

        <div id="drawer">
            <div id="tabs">
                <button data-t="overview" class="active">${icon("overview")}Overview</button>
                <button data-t="war">${icon("war")}War</button>
                <button data-t="enemy">${icon("enemy")}Enemy</button>
                <button data-t="chain">${icon("chain")}Chain</button>
                <button data-t="faction">${icon("faction")}Faction</button>
                <button data-t="ai">${icon("ai")}AI</button>
                <button data-t="logs">${icon("logs")}Logs</button>
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

    function icon(name){
        const map = {
            overview:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
            war:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`,
            enemy:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 13l-1-1 4-4-4-4 1-1 5 5-5 5z"/></svg>`,
            chain:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`,
            faction:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
            ai:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 14H4v-4h8v4zm0-6H4V8h8v4zm8 6h-6v-4h6v4zm0-6h-6V8h6v4z"/></svg>`,
            logs:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z"/></svg>`
        };
        return map[name] || "";
    }
};


/* =======================================================================
   BIND EVENTS
   ======================================================================= */
Major.bindEvents = function(){
    const trigger = this.shadow.querySelector("#trigger");
    trigger.onclick = ()=>{
        const d = this.shadow.querySelector("#drawer");
        d.classList.toggle("open");
        if (d.classList.contains("open"))
            this.nexus.events.emit("UI_DRAWER_OPENED");
    };

    this.shadow.querySelectorAll("#tabs button").forEach(btn=>{
        btn.onclick = ()=>{
            this.activeTab = btn.dataset.t;
            this.shadow.querySelectorAll("#tabs button").forEach(x=>x.classList.remove("active"));
            btn.classList.add("active");

            this.shadow.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
            this.shadow.querySelector(`#p-${this.activeTab}`).classList.add("active");

            this.renderActiveTab();
        };
    });

    this.nexus.events.on("SITREP_UPDATE", data=>{
        try {
            this.data.user = data.user;
            this.data.factionMembers = data.factionMembers;
            this.data.chain = data.chain;
            this.data.war = data.war;
            this.data.ai = data.ai;
            this.data.enemy = data.enemyMembers;

            this.pushChainRealtime();
            this.renderActiveTab();
        } catch(e){
            this.pushLog("Render error "+e, "error");
        }
    });

    this.nexus.events.on("ASK_COLONEL_RESPONSE", d=> this.renderAIMessage(d.answer));
};


/* =======================================================================
   RENDER DISPATCH
   ======================================================================= */
Major.renderActiveTab = function(){
    switch(this.activeTab){
        case "overview": return this.renderOverview();
        case "war": return this.renderWar();
        case "enemy": return this.renderEnemy();
        case "chain": return this.renderChain();
        case "faction": return this.renderFaction();
        case "ai": return this.renderAI();
        case "logs": return this.renderLogs();
    }
};

/* =======================================================================
   OVERVIEW TAB
   ======================================================================= */
Major.renderOverview = function(){
    const p = this.shadow.querySelector("#p-overview");
    const u = this.data.user;

    if (!u || !u.name){
        p.innerHTML = `<div class="card">Awaiting data...</div>`;
        return;
    }

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent)">Operator</h3>
            <table>
                <tr><th>Name</th><td>${u.name}</td></tr>
                <tr><th>Level</th><td>${u.level}</td></tr>
                <tr><th>Status</th><td>${u.status}</td></tr>
                <tr><th>HP</th><td>${u.hp}/${u.max_hp}</td></tr>
                <tr><th>Energy</th><td>${u.bars.energy.current}/${u.bars.energy.maximum}</td></tr>
                <tr><th>Nerve</th><td>${u.bars.nerve.current}/${u.bars.nerve.maximum}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3 style="color:var(--accent)">Chain Summary</h3>
            ${this.renderChainInfoHTML()}
        </div>

        <div class="card">
            <h3 style="color:var(--accent)">AI Summary</h3>
            <div>${this.data.ai.summary.join("<br>")}</div>
        </div>
    `;
};


/* =======================================================================
   WAR TAB
   ======================================================================= */
Major.renderWar = function(){
    const p = this.shadow.querySelector("#p-war");
    const w = this.data.war?.wars || {};

    if (!w || Object.keys(w).length===0){
        p.innerHTML = `<div class="card">No active wars.</div>`;
        return;
    }

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent)">War Overview</h3>
            <pre>${escapeHTML(JSON.stringify(w,null,2))}</pre>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2)">Enemy Activity Heatmap</h3>
            ${this.renderHeatmap()}
        </div>
    `;
};


/* =======================================================================
   ENEMY TAB
   ======================================================================= */
Major.renderEnemy = function(){
    const p = this.shadow.querySelector("#p-enemy");
    let list = [...this.data.enemy];

    if (this.enemyFilters.hideHosp)
        list = list.filter(e=>!/(hospital)/i.test(e.status||""));
    if (this.enemyFilters.hideTravel)
        list = list.filter(e=>!/(travel)/i.test(e.status||""));

    list.sort((a,b)=>b.level - a.level);

    const rows = list.map(e=>`
        <tr>
            <td>${e.online?"🟢":"⚫"}</td>
            <td>${e.name}</td>
            <td>${e.level}</td>
            <td>${e.status}</td>
            <td>${e.estimatedTotal || "?"}</td>
            <td><a class="btn" target="_blank" href="https://www.torn.com/loader.php?sid=attack&user2ID=${e.id}">Attack</a></td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div style="margin-bottom:10px;">
            <button id="ehosp" class="btn ${this.enemyFilters.hideHosp?"active":""}">Hide Hospital</button>
            <button id="etrav" class="btn ${this.enemyFilters.hideTravel?"active":""}">Hide Travel</button>
        </div>

        <div class="card">
            <h3 style="color:var(--accent)">Enemy Targets</h3>
            <table>
                <thead>
                    <tr><th></th><th>Name</th><th>Lvl</th><th>Status</th><th>Est Stats</th><th></th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2)">Enemy Activity Heatmap</h3>
            ${this.renderHeatmap()}
        </div>
    `;

    this.shadow.querySelector("#ehosp").onclick = ()=>{
        this.enemyFilters.hideHosp = !this.enemyFilters.hideHosp;
        this.renderEnemy();
    };
    this.shadow.querySelector("#etrav").onclick = ()=>{
        this.enemyFilters.hideTravel = !this.enemyFilters.hideTravel;
        this.renderEnemy();
    };
};


/* =======================================================================
   CHAIN TAB
   ======================================================================= */
Major.renderChain = function(){
    const p = this.shadow.querySelector("#p-chain");

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent)">Real-Time Chain</h3>
            <canvas id="chainGraph"></canvas>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2)">Historical Performance</h3>
            <select id="chainRange" class="btn">
                <option value="1">Last 1 Hour</option>
                <option value="4">Last 4 Hours</option>
                <option value="12">Last 12 Hours</option>
                <option value="24">Last 24 Hours</option>
            </select>
            <canvas id="chainHistoricGraph"></canvas>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2)">Chain Info</h3>
            ${this.renderChainInfoHTML()}
        </div>
    `;

    this.buildChainGraph();
    this.buildChainHistoricGraph();

    this.shadow.querySelector("#chainRange").onchange = ()=>{
        this.buildChainHistoricGraph();
    };
};

Major.renderChainInfoHTML = function(){
    const c = this.data.chain || {};
    return `
        <table>
            <tr><th>Hits</th><td>${c.hits||0}</td></tr>
            <tr><th>Timeout</th><td>${c.timeout||0}s</td></tr>
            <tr><th>Modifier</th><td>${c.modifier||1}x</td></tr>
            <tr><th>Cooldown</th><td>${c.cooldown||0}s</td></tr>
        </table>
    `;
};


/* =======================================================================
   FACTION TAB
   ======================================================================= */
Major.renderFaction = function(){
    const p = this.shadow.querySelector("#p-faction");
    const list = this.data.factionMembers || [];

    const rows = list.map(m=>`
        <tr>
            <td>${m.online?"🟢":"⚫"}</td>
            <td>${m.name}</td>
            <td>${m.level}</td>
            <td>${m.status}</td>
            <td>${m.last_action?.relative || ""}</td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent)">Faction Members</h3>
            <table>
                <thead>
                    <tr><th></th><th>Name</th><th>Lvl</th><th>Status</th><th>Last Action</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};


/* =======================================================================
   AI TAB — Natural Language Terminal
   ======================================================================= */
Major.renderAI = function(){
    const p = this.shadow.querySelector("#p-ai");

    if (!this.aiHistory) this.aiHistory = [];

    const html = this.aiHistory.map(item=>`
        <div class="${item.from==="user"?"ai-user":"ai-colonel"}">${item.text}</div>
    `).join("");

    p.innerHTML = `
        <div id="ai-console">
            <div id="ai-log">${html}</div>
            <input id="ai-input" placeholder="Ask the Colonel..." />
        </div>
    `;

    const input = this.shadow.querySelector("#ai-input");
    input.onkeydown = e=>{
        if (e.key !== "Enter") return;

        const msg = input.value.trim();
        if (!msg) return;
        input.value = "";

        this.aiHistory.push({ from:"user", text:escapeHTML(msg) });
        this.renderAI();

        this.nexus.events.emit("ASK_COLONEL", { question: msg });
    };
};

Major.renderAIMessage = function(text){
    this.aiHistory.push({ from:"colonel", text:escapeHTML(text) });
    this.renderAI();
};


/* =======================================================================
   LOGS TAB
   ======================================================================= */
Major.renderLogs = function(){
    const p = this.shadow.querySelector("#p-logs");

    const lines = this.data.logs.map(l=>`
        <div class="log-entry ${l.level==="error"?"log-error":"log-info"}">
            [${l.ts}] ${escapeHTML(l.msg)}
        </div>
    `).join("");

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent)">System Logs</h3>
            <div id="logbox">${lines}</div>
        </div>
    `;
};


/* =======================================================================
   CHAIN REAL-TIME DATA FEED
   ======================================================================= */
Major.pushChainRealtime = function(){
    const now = Date.now();
    const hits = this.data.chain.hits || 0;

    this.chainReal.push({ x: now, y: hits });
    if (this.chainReal.length > 180) this.chainReal.splice(0, 60);

    if (this.chainGraph){
        this.chainGraph.data.datasets[0].data = this.chainReal;
        this.chainGraph.update("none");
    }
};


/* =======================================================================
   BUILD GRAPHS — REAL-TIME
   ======================================================================= */
Major.buildChainGraph = function(){
    const canvas = this.shadow.querySelector("#chainGraph");
    if (!canvas) return;

    if (this.chainGraph) this.chainGraph.destroy();

    this.chainGraph = new Chart(canvas.getContext("2d"), {
        type:"line",
        data:{
            datasets:[
                {
                    label:"Chain Hits",
                    data:this.chainReal,
                    borderColor:"#00e5ff",
                    borderWidth:2,
                    pointRadius:0,
                }
            ]
        },
        options:{
            animation:false,
            scales:{
                x:{ type:"time", time:{ unit:"minute" }, ticks:{ color:"#777" } },
                y:{ ticks:{ color:"#777" } }
            },
            plugins:{ legend:{ display:false } }
        }
    });
};


/* =======================================================================
   BUILD HISTORICAL GRAPH
   ======================================================================= */
Major.buildChainHistoricGraph = function(){
    const canvas = this.shadow.querySelector("#chainHistoricGraph");
    if (!canvas) return;

    const hours = parseInt(this.shadow.querySelector("#chainRange").value);
    const cutoff = Date.now() - hours*3600*1000;

    const data = (this.nexus.colonel?.memory.chain.pace || [])
        .filter(x => x.ts >= cutoff)
        .map(x => ({ x:x.ts, y:x.hits }));

    if (this.chainHistoricGraph) this.chainHistoricGraph.destroy();

    this.chainHistoricGraph = new Chart(canvas.getContext("2d"), {
        type:"line",
        data:{
            datasets:[
                {
                    label:"Chain History",
                    data,
                    borderColor:"#00ffbf",
                    borderWidth:2,
                    pointRadius:0,
                }
            ]
        },
        options:{
            animation:false,
            scales:{
                x:{ type:"time", time:{ unit:"hour" }, ticks:{ color:"#777" } },
                y:{ ticks:{ color:"#777" } }
            },
            plugins:{ legend:{ display:false } }
        }
    });
};


/* =======================================================================
   HEATMAP (enemy activity)
   ======================================================================= */
Major.renderHeatmap = function(){
    // 24-hour heat buckets
    const buckets = new Array(24).fill(0);
    const enemies = this.data.enemy || [];
    const now = Date.now();

    // Activity score: online = 1
    for (const e of enemies){
        if (!e.online) continue;
        const hour = new Date().getHours();
        buckets[hour] += 1;
    }

    const cells = buckets.map(b=>{
        const intensity = b > 10 ? 1 : b/10;
        const c = Math.round(intensity * 255);
        return `<div class="heat" style="background:rgba(0,229,255,${intensity});"></div>`;
    }).join("");

    return `<div class="heatmap">${cells}</div>`;
};


/* =======================================================================
   UTILS
   ======================================================================= */
function escapeHTML(x){
    return x.replace(/[<>&]/g, m=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[m]));
}

/* =======================================================================
   REGISTER MODULE
   ======================================================================= */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name:"Major", module: Major });

})();
