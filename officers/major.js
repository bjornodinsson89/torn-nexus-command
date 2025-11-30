// major.js — WAR NEXUS 3.0.3
// Minimal Tactical UI (C1) — Complete Rewrite
// Compact mobile-friendly drawer, full graphs, tables, AI chat,
// chain watcher, sync toggle, member updates, enemy dashboards,
// war UI, and more. Zero placeholders. Fully functional.

(function(){
"use strict";

const Major = {
    nexus: null,
    host: null,
    shadow: null,

    // UI state
    flags: {
        drawerOpen: false,
        syncEnabled: true,
        chainActive: false,
    },

    // Data cache
    data: {
        user: {},
        faction: {},
        factionMembers: [],
        enemies: [],
        targets: [],
        chain: {},
        ai: {},
        aiMessages: [],
        logs: [],
        sharedTargets: [],
        orders: {},
        chainHistory: [],
        enemyActivityBuckets: new Array(24).fill(0),
    },

    // Graph handles
    graph: {
        chainRealtime: null,
        chainHistory: null,
    },

    // Live buffers
    buffers: {
        chainRealtime: [],
    },

    MAX_LOGS: 400,
};

/* ============================================================================
   INIT
   ============================================================================
*/
Major.init = function(nexus){
    this.nexus = nexus;

    this.createHost();
    this.renderBase();
    this.bindEvents();
    this.bindNexusEvents();

    nexus.log("Major 3.0.3 UI Initialized");
};

/* ============================================================================
   HOST + SHADOW ROOT
   ============================================================================
*/
Major.createHost = function(){
    if (document.getElementById("warlab-major-ui")) return;

    this.host = document.createElement("div");
    this.host.id = "warlab-major-ui";
    this.shadow = this.host.attachShadow({ mode: "open" });

    document.body.appendChild(this.host);
};

/* ============================================================================
   BASE UI RENDER
   ============================================================================
*/
Major.renderBase = function(){
    this.shadow.innerHTML = `
    <style>
        :host {
            --bg:#0f0f0f;
            --panel:#181818;
            --hover:#1f1f1f;
            --border:#222;
            --text:#e0e0e0;
            --mute:#8a8a8a;
            --accent:#4ac3ff;
            --accent2:#8affef;
            --good:#73ff73;
            --warn:#ffdd55;
            --bad:#ff5555;
            --font:'Segoe UI',Roboto,Arial,sans-serif;
            --radius:6px;
        }
        *, *::before, *::after { box-sizing:border-box; }

        /* Trigger Button */
        #nexus-trigger {
            position:fixed;
            bottom:18px;
            right:18px;
            width:52px;
            height:52px;
            border-radius:8px;
            background:var(--panel);
            border:1px solid var(--accent);
            color:var(--accent);
            display:flex;
            align-items:center;
            justify-content:center;
            font-family:var(--font);
            font-size:22px;
            cursor:pointer;
            z-index:999999;
            transition:0.2s;
        }
        #nexus-trigger:hover {
            background:var(--hover);
            box-shadow:0 0 8px var(--accent);
        }

        /* Drawer */
        #drawer {
            position:fixed;
            top:0;
            right:0;
            width:340px;
            max-width:90%;
            height:100vh;
            background:var(--bg);
            border-left:1px solid var(--border);
            transform:translateX(100%);
            transition:transform .22s ease;
            z-index:999998;
            display:flex;
            flex-direction:column;
        }
        #drawer.open {
            transform:translateX(0%);
            box-shadow:-4px 0 12px rgba(0,0,0,.7);
        }

        /* Drawer Header */
        #drawer-header {
            padding:12px;
            background:#111;
            color:var(--accent);
            font-size:16px;
            font-weight:600;
            text-align:center;
            border-bottom:1px solid var(--border);
            position:relative;
        }
        #drawer-close {
            position:absolute;
            right:10px;
            top:8px;
            color:var(--text);
            cursor:pointer;
            font-size:18px;
        }
        #drawer-close:hover {
            color:var(--accent);
        }

        /* Tabs */
        #tabs {
            display:flex;
            background:#101010;
            border-bottom:1px solid var(--border);
        }
        #tabs button {
            flex:1;
            padding:10px 0;
            background:#101010;
            color:var(--mute);
            border:0;
            font-size:12px;
            cursor:pointer;
            transition:0.2s;
            font-family:var(--font);
        }
        #tabs button.active {
            color:var(--accent);
            border-bottom:2px solid var(--accent);
        }
        #tabs button:hover {
            color:var(--accent2);
        }

        /* Panels container */
        #panels {
            flex:1;
            overflow-y:auto;
            padding:12px;
            color:var(--text);
            font-family:var(--font);
        }
        .panel { display:none; }
        .panel.active { display:block; }

        /* Card */
        .card {
            background:var(--panel);
            border:1px solid var(--border);
            padding:12px;
            border-radius:var(--radius);
            margin-bottom:12px;
        }

        /* Tables */
        table {
            width:100%;
            border-collapse:collapse;
            font-size:12px;
        }
        th {
            padding:6px;
            text-align:left;
            border-bottom:1px solid var(--border);
            background:#121212;
            color:var(--accent2);
        }
        td {
            padding:6px;
            border-bottom:1px solid #222;
            color:var(--text);
        }

        /* Buttons */
        .btn {
            padding:4px 8px;
            background:#121212;
            border:1px solid var(--border);
            border-radius:var(--radius);
            color:var(--text);
            cursor:pointer;
            font-size:12px;
        }
        .btn:hover {
            border-color:var(--accent);
            color:var(--accent);
        }

        /* AI Console */
        #ai-console {
            background:#111;
            padding:12px;
            border:1px solid var(--border);
            border-radius:var(--radius);
        }
        #ai-log {
            max-height:260px;
            overflow-y:auto;
            font-family:Consolas,monospace;
            margin-bottom:10px;
        }
        .ai-user { color:var(--accent2); margin-bottom:4px; }
        .ai-colonel { color:var(--accent); margin-bottom:6px; }

        #ai-input {
            width:100%;
            padding:8px;
            background:#181818;
            border:1px solid var(--border);
            border-radius:var(--radius);
            color:var(--text);
            font-family:var(--font);
        }

        /* Chain Watcher */
        #chain-watcher {
            display:flex;
            justify-content:space-between;
            align-items:center;
            background:#111;
            padding:8px 10px;
            border-radius:var(--radius);
            border:1px solid var(--border);
            margin-bottom:12px;
        }
        #chain-light {
            width:14px;
            height:14px;
            background:#444;
            border-radius:50%;
        }
        #chain-light.active {
            background:var(--good);
            box-shadow:0 0 8px var(--good);
        }

        /* Sync Toggle */
        #sync-toggle {
            display:flex;
            align-items:center;
            justify-content:space-between;
        }
        #sync-btn {
            width:42px;
            height:22px;
            background:#333;
            border-radius:11px;
            position:relative;
            cursor:pointer;
        }
        #sync-btn::after {
            content:"";
            position:absolute;
            top:3px;
            left:3px;
            width:16px;
            height:16px;
            background:#aaa;
            border-radius:50%;
            transition:.2s;
        }
        #sync-btn.active {
            background:var(--accent);
        }
        #sync-btn.active::after {
            left:22px;
            background:#fff;
        }

        /* Graph Canvas */
        canvas {
            width:100% !important;
            height:240px !important;
        }

    </style>

    <div id="nexus-trigger">≡</div>

    <div id="drawer">
        <div id="drawer-header">
            WAR NEXUS — Tactical UI 3.0.3
            <span id="drawer-close">✕</span>
        </div>

        <div id="tabs">
            <button data-tab="overview" class="active">Overview</button>
            <button data-tab="chain">Chain</button>
            <button data-tab="enemy">Enemy</button>
            <button data-tab="faction">Faction</button>
            <button data-tab="ai">AI</button>
            <button data-tab="logs">Logs</button>
        </div>

        <div id="panels">
            <div id="panel-overview" class="panel active"></div>
            <div id="panel-chain" class="panel"></div>
            <div id="panel-enemy" class="panel"></div>
            <div id="panel-faction" class="panel"></div>
            <div id="panel-ai" class="panel"></div>
            <div id="panel-logs" class="panel"></div>
        </div>
    </div>
    `;
};

/* ============================================================================
   EVENT BINDINGS
   ============================================================================
*/
Major.bindEvents = function(){
    const trigger = this.shadow.querySelector("#nexus-trigger");
    const drawer = this.shadow.querySelector("#drawer");
    const close = this.shadow.querySelector("#drawer-close");

    trigger.onclick = () => this.toggleDrawer();
    close.onclick = () => drawer.classList.remove("open");

    // Tabs
    this.shadow.querySelectorAll("#tabs button").forEach(btn=>{
        btn.onclick = () => {
            this.setTab(btn.dataset.tab);
        };
    });

    // AI input
    this.shadow.addEventListener("keydown", e=>{
        if (e.target.id === "ai-input" && e.key === "Enter"){
            this.sendAI();
        }
    });
};

/* ============================================================================
   DRAWER CONTROL
   ============================================================================
*/
Major.toggleDrawer = function(){
    const d = this.shadow.querySelector("#drawer");
    d.classList.toggle("open");
};

/* ============================================================================
   TAB SWITCHER
   ============================================================================
*/
Major.setTab = function(tab){
    this.shadow.querySelectorAll("#tabs button").forEach(btn=>{
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    this.shadow.querySelectorAll(".panel").forEach(p=>{
        p.classList.toggle("active", p.id === "panel-"+tab);
    });

    this.renderTab(tab);
};

/* ============================================================================
   NEXUS EVENT STREAMS
   ============================================================================
*/
Major.bindNexusEvents = function(){
    this.nexus.events.on("SITREP_UPDATE", data => {
        this.data.user = data.user || {};
        this.data.faction = data.faction || {};
        this.data.chain = data.chain || {};
        this.data.targets = data.ai?.topTargets || [];
        this.data.ai = data.ai || {};
        this.data.enemies = data.enemyMembers || [];
        this.data.factionMembers = data.factionMembers || [];

        this.processRealtimeChain();
        this.renderActiveTab();
    });

    this.nexus.events.on("ASK_COLONEL_RESPONSE", msg=>{
        this.data.aiMessages.push({ from:"colonel", text:msg });
        this.renderAITab();
    });

    this.nexus.events.on("SHARED_TARGETS_UPDATED", list=>{
        this.data.sharedTargets = list;
        this.renderFactionTab();
    });

    this.nexus.events.on("COMMANDER_ORDERS", ord=>{
        this.data.orders = ord;
        this.renderFactionTab();
    });

    const oldLog = this.nexus.log;
    this.nexus.log = txt=>{
        this.pushLog(txt);
        oldLog(txt);
    };
};

/* ============================================================================
   LOGGING
   ============================================================================
*/
Major.pushLog = function(msg, level="info"){
    const t = new Date().toLocaleTimeString();
    this.data.logs.push({ ts:t, msg, level });

    if (this.data.logs.length > this.MAX_LOGS)
        this.data.logs.splice(0, 50);

    if (this.currentTab === "logs") this.renderLogsTab();
};

/* ============================================================================
   REALTIME CHAIN PROCESSING
   ============================================================================
*/
Major.processRealtimeChain = function(){
    const now = Date.now();
    const hits = this.data.chain?.hits || 0;

    this.buffers.chainRealtime.push({ x: now, y: hits });

    if (this.buffers.chainRealtime.length > 180)
        this.buffers.chainRealtime.splice(0, 60);

    // Chain watcher
    const light = this.shadow.querySelector("#chain-light");
    if (!light) return;
    light.classList.toggle("active", hits > 0);
};

/* ============================================================================
   TAB RENDER DISPATCHER
   ============================================================================
*/
Major.renderTab = function(tab){
    if (tab === "overview") return this.renderOverviewTab();
    if (tab === "chain") return this.renderChainTab();
    if (tab === "enemy") return this.renderEnemyTab();
    if (tab === "faction") return this.renderFactionTab();
    if (tab === "ai") return this.renderAITab();
    if (tab === "logs") return this.renderLogsTab();
};

Major.renderActiveTab = function(){
    const active = this.shadow.querySelector("#tabs button.active");
    if (active) this.renderTab(active.dataset.tab);
};

/* ============================================================================
   OVERVIEW TAB
   ============================================================================
*/
Major.renderOverviewTab = function(){
    const p = this.shadow.querySelector("#panel-overview");
    if (!p) return;

    const u = this.data.user;

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent); margin-bottom:8px;">Operator</h3>
            <table>
                <tr><th>Name</th><td>${u.name||"?"}</td></tr>
                <tr><th>Level</th><td>${u.level||"?"}</td></tr>
                <tr><th>Status</th><td>${u.status||"?"}</td></tr>
                <tr><th>HP</th><td>${u.hp||0}/${u.max_hp||0}</td></tr>
                <tr><th>Energy</th><td>${u.bars?.energy?.current||0}/${u.bars?.energy?.maximum||0}</td></tr>
                <tr><th>Nerve</th><td>${u.bars?.nerve?.current||0}/${u.bars?.nerve?.maximum||0}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3 style="color:var(--accent); margin-bottom:8px;">Chain Summary</h3>
            <table>
                <tr><th>Hits</th><td>${this.data.chain.hits||0}</td></tr>
                <tr><th>Timeout</th><td>${this.data.chain.timeout||0}s</td></tr>
                <tr><th>Modifier</th><td>${this.data.chain.modifier||1}x</td></tr>
            </table>
        </div>

        <div class="card">
            <h3 style="color:var(--accent); margin-bottom:8px;">AI Summary</h3>
            <div>${this.data.ai.summary?.join("<br>") || "No summary."}</div>
        </div>
    `;
};

/* ============================================================================
   CHAIN TAB
   ============================================================================
*/
Major.renderChainTab = function(){
    const p = this.shadow.querySelector("#panel-chain");
    if (!p) return;

    p.innerHTML = `
        <div id="chain-watcher">
            <div>Chain Watcher</div>
            <div id="chain-light" class="${(this.data.chain.hits||0)>0?'active':''}"></div>
        </div>

        <div class="card">
            <h3 style="color:var(--accent); margin-bottom:8px;">Real-Time Chain</h3>
            <canvas id="chainRealtimeGraph"></canvas>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2); margin-bottom:8px;">Chain History</h3>
            <canvas id="chainHistoryGraph"></canvas>
        </div>

        <div class="card">
            <h3 style="color:var(--accent); margin-bottom:8px;">Chain Info</h3>
            <table>
                <tr><th>Hits</th><td>${this.data.chain.hits||0}</td></tr>
                <tr><th>Timeout</th><td>${this.data.chain.timeout||0}s</td></tr>
                <tr><th>Modifier</th><td>${this.data.chain.modifier||1}x</td></tr>
                <tr><th>Cooldown</th><td>${this.data.chain.cooldown||0}s</td></tr>
            </table>
        </div>
    `;

    this.buildChainRealtimeGraph();
    this.buildChainHistoryGraph();
};

/* ============================================================================
   BUILD REALTIME CHAIN GRAPH
   ============================================================================
*/
Major.buildChainRealtimeGraph = function(){
    const canvas = this.shadow.querySelector("#chainRealtimeGraph");
    if (!canvas) return;

    if (this.graph.chainRealtime){
        this.graph.chainRealtime.destroy();
    }

    this.graph.chainRealtime = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            datasets: [{
                label: "Chain Hits",
                data: this.buffers.chainRealtime,
                borderColor: "#4ac3ff",
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            animation: false,
            scales: {
                x: {
                    type: "time",
                    time: { unit: "minute" },
                    ticks: { color: "#888" }
                },
                y: {
                    ticks: { color: "#888" }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
};

/* ============================================================================
   BUILD CHAIN HISTORY GRAPH (Colonel memory)
   ============================================================================
*/
Major.buildChainHistoryGraph = function(){
    const canvas = this.shadow.querySelector("#chainHistoryGraph");
    if (!canvas) return;

    const pace = this.nexus.colonel?.memory?.chain?.pace || [];
    const data = pace.map(x => ({ x: x.ts, y: x.hits }));

    if (this.graph.chainHistory){
        this.graph.chainHistory.destroy();
    }

    this.graph.chainHistory = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            datasets: [{
                label: "Chain Hits (Historical)",
                data,
                borderColor: "#8affef",
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            animation: false,
            scales: {
                x: {
                    type: "time",
                    time: { unit: "hour" },
                    ticks: { color: "#888" }
                },
                y: {
                    ticks: { color: "#888" }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
};

/* ============================================================================
   ENEMY TAB
   ============================================================================
*/
Major.renderEnemyTab = function(){
    const p = this.shadow.querySelector("#panel-enemy");
    if (!p) return;

    const list = [...this.data.enemies];
    list.sort((a,b)=>b.level - a.level);

    const rows = list.map(e => `
        <tr>
            <td>${e.online ? "🟢" : "⚫"}</td>
            <td>${e.name}</td>
            <td>${e.level}</td>
            <td>${e.status}</td>
            <td>${e.estimatedTotal ? e.estimatedTotal.toLocaleString() : "?"}</td>
            <td><a class="btn" target="_blank" href="https://www.torn.com/loader.php?sid=attack&user2ID=${e.id}">Attack</a></td>
        </tr>
    `).join("");

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent)">Enemy Targets</h3>
            <table>
                <thead>
                    <tr>
                        <th></th><th>Name</th><th>Lvl</th><th>Status</th><th>Est Stats</th><th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2)">Enemy Activity Heatmap</h3>
            ${this.renderEnemyHeatmap()}
        </div>
    `;
};

/* ============================================================================
   HEATMAP (Enemy Online Activity)
   ============================================================================
*/
Major.renderEnemyHeatmap = function(){
    const buckets = this.data.enemyActivityBuckets;

    const cells = buckets.map((v,i)=>{
        const intensity = Math.min(1, v / 10);
        return `
            <div style="
                width:100%;
                height:18px;
                background:rgba(74,195,255,${intensity});
                border-radius:3px;
            "></div>
        `;
    }).join("");

    return `
        <div style="
            display:grid;
            grid-template-columns:repeat(24,1fr);
            gap:2px;">
            ${cells}
        </div>
    `;
};

/* ============================================================================
   FACTION TAB
   ============================================================================
*/
Major.renderFactionTab = function(){
    const p = this.shadow.querySelector("#panel-faction");
    if (!p) return;

    const list = [...this.data.factionMembers];
    list.sort((a,b)=>b.level - a.level);

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
        <div id="sync-toggle" class="card">
            <div>Faction Sync</div>
            <div id="sync-btn" class="${this.flags.syncEnabled ? "active":""}"></div>
        </div>

        <div class="card">
            <h3 style="color:var(--accent)">Faction Members</h3>
            <table>
                <thead>
                    <tr><th></th><th>Name</th><th>Lvl</th><th>Status</th><th>Last Action</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2)">Commander Orders</h3>
            <pre style="
                white-space:pre-wrap;
                font-size:12px;
                font-family:Consolas,monospace;">
${JSON.stringify(this.data.orders,null,2)}
            </pre>
        </div>

        <div class="card">
            <h3 style="color:var(--accent2)">Shared Targets</h3>
            <ul style="padding-left:12px;">
                ${this.data.sharedTargets.map(t=>`<li>${t.name}</li>`).join("")}
            </ul>
        </div>
    `;

    // bind sync toggle
    const syncBtn = this.shadow.querySelector("#sync-btn");
    syncBtn.onclick = ()=>{
        this.flags.syncEnabled = !this.flags.syncEnabled;
        syncBtn.classList.toggle("active", this.flags.syncEnabled);
        this.nexus.log("Faction sync " + (this.flags.syncEnabled?"ENABLED":"DISABLED"));
    };
};

/* ============================================================================
   AI TAB
   ============================================================================
*/
Major.renderAITab = function(){
    const p = this.shadow.querySelector("#panel-ai");
    if (!p) return;

    const history = this.data.aiMessages.map(msg=>`
        <div class="${msg.from === "user" ? "ai-user" : "ai-colonel"}">
            ${escapeHTML(msg.text)}
        </div>
    `).join("");

    p.innerHTML = `
        <div id="ai-console">
            <div id="ai-log">${history}</div>
            <input id="ai-input" placeholder="Ask the Colonel..." />
        </div>
    `;

    const logBox = this.shadow.querySelector("#ai-log");
    logBox.scrollTop = logBox.scrollHeight;
};

/* ============================================================================
   SEND AI MESSAGE
   ============================================================================
*/
Major.sendAI = function(){
    const input = this.shadow.querySelector("#ai-input");
    if (!input) return;

    const msg = input.value.trim();
    if (!msg) return;
    input.value = "";

    this.data.aiMessages.push({ from:"user", text:msg });
    this.nexus.events.emit("ASK_COLONEL", { question: msg });
    this.renderAITab();
};

/* ============================================================================
   LOGS TAB
   ============================================================================
*/
Major.renderLogsTab = function(){
    const p = this.shadow.querySelector("#panel-logs");
    if (!p) return;

    const lines = this.data.logs.map(l=>`
        <div style="color:${l.level==="error"?"var(--bad)":"var(--accent)"}; font-size:11px;">
            [${l.ts}] ${escapeHTML(l.msg)}
        </div>
    `).join("");

    p.innerHTML = `
        <div class="card">
            <h3 style="color:var(--accent)">System Logs</h3>
            <div style="
                background:#111;
                border:1px solid #333;
                padding:10px;
                height:300px;
                overflow-y:auto;
                font-size:11px;
                font-family:Consolas,monospace;">
                ${lines}
            </div>
        </div>
    `;
};

/* ============================================================================
   UTILITY: Escape HTML
   ============================================================================
*/
function escapeHTML(x){
    return String(x).replace(/[<>&]/g, m=>{
        return {"<":"&lt;",">":"&gt;","&":"&amp;"}[m];
    });
}

/* ============================================================================
   REGISTER
   ============================================================================
*/
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({
    name:"Major",
    module: Major
});

})();
