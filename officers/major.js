// ============================================================================
//  WAR NEXUS — MAJOR v3.3
//  EXPANDED TACTICAL DASHBOARD + PERSISTENCE + ANIMATED TERMINAL
//  Author: Bjorn
// ============================================================================
//
//  FEATURES:
//    • Persistent position + size (draggable + resizable)
//    • Smooth slide-in / slide-out animation
//    • Fully polished C2 Tactical UI
//    • 8-tab command dashboard
//    • Animated Colonel terminal output
//    • Import / Export full Nexus memory
//    • Deep integration w/ Colonel v5.0 SITREP + predictions
//    • All charts + tables auto-update
//
// ============================================================================

(function(){
"use strict";

const Major = {

    nexus: null,

    // === DOM roots ===
    container: null,
    shadow: null,

    // === active tab ===
    activeTab: "overview",

    // === data from SITREP ===
    data: {
        user: {},
        stats: {},
        bars: {},
        chain: {},
        faction: {},
        factionMembers: [],
        enemies: [],
        wars: [],
        predictions: {},
    },

    // === Chart.js instances ===
    charts: {},

    // === window persistence ===
    windowState: {
        x: GM_getValue("WN_MAJOR_X", null),
        y: GM_getValue("WN_MAJOR_Y", null),
        w: GM_getValue("WN_MAJOR_W", 920),
        h: GM_getValue("WN_MAJOR_H", null),
        open: GM_getValue("WN_MAJOR_OPEN", true)
    },

    dragging: false,
    resizing: false,
    resizeDir: null,
    dragOffset: {x:0, y:0}
};

/* ============================================================================
   INIT
   ============================================================================ */
Major.init = function(nexus){
    this.nexus = nexus;

    this.createUI();
    this.applyStyles();
    this.bindEvents();
    this.restoreWindowPosition();

    if (!this.windowState.open){
        this.container.style.transform = "translateY(120%)";
        this.container.style.opacity = "0";
    }

    nexus.log("Major v3.3 loaded (Tactical Dashboard + Persistence)");
};

/* ============================================================================
   UI CREATION
   ============================================================================ */
Major.createUI = function(){
    this.container = document.createElement("div");
    this.container.id = "wn-major-container";
    document.body.appendChild(this.container);

    this.shadow = this.container.attachShadow({mode:"open"});

    this.shadow.innerHTML = `
        <div id="major-root">
            <div id="drag-bar"></div>

            <div id="sidebar">
                <div class="tab-btn" data-tab="overview">Overview</div>
                <div class="tab-btn" data-tab="chain">Chain</div>
                <div class="tab-btn" data-tab="enemy">Enemy</div>
                <div class="tab-btn" data-tab="faction">Faction</div>
                <div class="tab-btn" data-tab="war">War</div>
                <div class="tab-btn" data-tab="predictions">Predictions</div>
                <div class="tab-btn" data-tab="targets">Targets</div>
                <div class="tab-btn" data-tab="colonel">Colonel</div>
            </div>

            <div id="content">
                <div class="tabview" id="tab-overview"></div>
                <div class="tabview" id="tab-chain"></div>
                <div class="tabview" id="tab-enemy"></div>
                <div class="tabview" id="tab-faction"></div>
                <div class="tabview" id="tab-war"></div>
                <div class="tabview" id="tab-predictions"></div>
                <div class="tabview" id="tab-targets"></div>
                <div class="tabview" id="tab-colonel"></div>
            </div>

            <div id="resizer-br"></div>
        </div>
    `;

    this.createToggleButton();
};

/* ============================================================================
   GLOBAL TOGGLE BUTTON (BOTTOM LEFT)
// ============================================================================ */
Major.createToggleButton = function(){
    const btn = document.createElement("div");
    btn.id = "wn-major-toggle-btn";
    btn.textContent = "NEXUS";
    document.body.appendChild(btn);

    btn.onclick = ()=>{
        const o = this.windowState.open = !this.windowState.open;
        GM_setValue("WN_MAJOR_OPEN", o);

        if (o){
            this.container.style.pointerEvents = "auto";
            this.container.style.opacity = "1";
            this.container.style.transform = "translateY(0%)";
        } else {
            this.container.style.pointerEvents = "none";
            this.container.style.opacity = "0";
            this.container.style.transform = "translateY(120%)";
        }
    };

    const style = document.createElement("style");
    style.textContent = `
        #wn-major-toggle-btn {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #121212;
            color: #4ac3ff;
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid #1e1e1e;
            font-family: Segoe UI, Arial;
            font-size: 14px;
            cursor: pointer;
            z-index: 2147483647;
            box-shadow: 0 0 10px rgba(0,0,0,0.6);
        }
        #wn-major-toggle-btn:hover {
            background: #1a1a1a;
        }
    `;
    document.body.appendChild(style);
};

/* ============================================================================
   STYLES (POLISHED C2)
   ============================================================================ */
Major.applyStyles = function(){
    const css = `
        :host {
            all: initial;
        }

        /* ROOT / WINDOW */
        #major-root {
            position: fixed;
            top: 70px;
            right: 10px;
            width: ${this.windowState.w}px;
            height: 680px;
            background: #0b0b0b;
            border: 1px solid #161616;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.7);
            display: flex;
            overflow: hidden;
            z-index: 2147483640;
            font-family: Segoe UI, Arial;
            color: #ddd;

            opacity: 1;
            transform: translateY(0%);
            transition: transform 0.35s ease, opacity 0.35s ease;
        }

        #drag-bar {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 12px;
            cursor: move;
            background: #111;
        }

        #resizer-br {
            position: absolute;
            width: 14px;
            height: 14px;
            right: 0;
            bottom: 0;
            cursor: nwse-resize;
            background: #222;
        }

        /* SIDEBAR */
        #sidebar {
            width: 150px;
            background: #050505;
            border-right: 1px solid #111;
            display: flex;
            flex-direction: column;
            padding-top: 10px;
        }

        .tab-btn {
            padding: 14px 10px;
            cursor: pointer;
            font-size: 15px;
            color: #bbb;
            user-select: none;
            border-bottom: 1px solid #111;
            text-shadow: 0 0 3px rgba(0,0,0,0.5);
        }
        .tab-btn:hover {
            background: #111;
            color: #4ac3ff;
        }
        .tab-btn.active {
            background: radial-gradient(circle at left, #1d1d1d, #111);
            color: #4ac3ff;
            font-weight: 600;
        }

        /* CONTENT AREA */
        #content {
            flex: 1;
            overflow-y: auto;
            padding: 18px;
        }

        .tabview {
            display: none;
        }
        .tabview.active {
            display: block;
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from {opacity: 0;}
            to   {opacity: 1;}
        }

        /* CARDS */
        .card {
            background: linear-gradient(180deg, #141414, #0e0e0e);
            border: 1px solid #222;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
            box-shadow: 0 0 12px rgba(0,0,0,0.5);
        }
        .card h3 {
            margin: 0 0 12px;
            color: #5ac9ff;
        }

        /* TABLES */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 6px;
        }
        table th, table td {
            padding: 6px 8px;
            border-bottom: 1px solid #1a1a1a;
            text-align: left;
        }
        table th {
            color: #5ac9ff;
            font-weight: 600;
            width: 150px;
        }

        .pred-block {
            background: #0c0c0c;
            border-left: 3px solid #5ac9ff;
            padding: 10px 12px;
            margin-bottom: 12px;
            border-radius: 4px;
            box-shadow: inset 0 0 6px rgba(0,0,0,0.5);
            font-size: 13px;
        }

        /* SUBTABS */
        .subtabs {
            margin-top: 10px;
            display: flex;
            border-bottom: 1px solid #222;
        }
        .subtab-btn {
            padding: 8px 12px;
            cursor: pointer;
            font-size: 13px;
            color: #bbb;
            margin-right: 5px;
        }
        .subtab-btn.active {
            background: #1a1a1a;
            color: #4ac3ff;
            font-weight: bold;
            border-radius: 4px 4px 0 0;
        }

        .subtabview {
            display: none;
        }
        .subtabview.active {
            display: block;
            padding-top: 10px;
        }

        /* COLONEL TERMINAL */
        #colonel-terminal {
            width: 100%;
            height: 300px;
            background: #000;
            border: 1px solid #222;
            overflow-y: auto;
            color: #4ac3ff;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            margin-bottom: 10px;
            white-space: pre-wrap;
        }
        #colonel-input {
            width: 100%;
            padding: 8px;
            background: #111;
            border: 1px solid #333;
            color: #eee;
            border-radius: 3px;
        }
    `;

    const style = document.createElement("style");
    style.textContent = css;
    this.shadow.appendChild(style);
};

/* ============================================================================
   RESTORE PERSISTENT WINDOW POSITION
   ============================================================================ */
Major.restoreWindowPosition = function(){
    const root = this.shadow.querySelector("#major-root");
    if (!root) return;

    if (this.windowState.x !== null){
        root.style.left = this.windowState.x + "px";
        root.style.top  = this.windowState.y + "px";
        root.style.position = "fixed";
    }

    if (this.windowState.w){
        root.style.width = this.windowState.w + "px";
    }
};

/* ============================================================================
   EVENT BINDINGS
   ============================================================================ */
Major.bindEvents = function(){
    // TABS
    this.shadow.querySelectorAll(".tab-btn").forEach(btn=>{
        btn.onclick = ()=>{
            this.activeTab = btn.dataset.tab;
            this.renderActiveTab();
        };
    });

    // SITREP
    this.nexus.events.on("SITREP_UPDATE", data => {
        this.data.user           = data.user   || {};
        this.data.stats          = data.stats  || {};
        this.data.bars           = data.bars   || {};
        this.data.chain          = data.chain  || {};
        this.data.faction        = data.faction || {};
        this.data.factionMembers = data.factionMembers || [];
        this.data.enemies        = data.enemies || [];
        this.data.wars           = data.wars    || [];
        this.data.predictions    = data.predictions || {};

        this.renderActiveTab();
    });

    // COLONEL RESPONSE → animated terminal text
    this.nexus.events.on("ASK_COLONEL_RESPONSE", payload => {
        this.appendAnimatedTerminalText(payload.answer);
    });

    /* ---------- DRAGGING -------------- */
    const dragBar = this.shadow.querySelector("#drag-bar");
    dragBar.addEventListener("mousedown", e=>{
        this.dragging = true;
        const rect = this.shadow.querySelector("#major-root").getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
    });

    document.addEventListener("mousemove", e=>{
        if (this.dragging){
            const root = this.shadow.querySelector("#major-root");
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            root.style.left = x+"px";
            root.style.top  = y+"px";

            GM_setValue("WN_MAJOR_X", x);
            GM_setValue("WN_MAJOR_Y", y);
        }
    });

    document.addEventListener("mouseup", ()=>{
        this.dragging = false;
    });

    /* ---------- RESIZING -------------- */
    const resizeBR = this.shadow.querySelector("#resizer-br");
    resizeBR.addEventListener("mousedown", ()=>{
        this.resizing = true;
    });

    document.addEventListener("mousemove", e=>{
        if (this.resizing){
            const root = this.shadow.querySelector("#major-root");
            const rect = root.getBoundingClientRect();
            const newW = e.clientX - rect.left;
            const newH = e.clientY - rect.top;

            if (newW > 600) root.style.width  = newW+"px";
            if (newH > 400) root.style.height = newH+"px";

            GM_setValue("WN_MAJOR_W", newW);
            GM_setValue("WN_MAJOR_H", newH);
        }
    });

    document.addEventListener("mouseup", ()=>{
        this.resizing = false;
    });
};
    /* ============================================================================
   RENDER ACTIVE TAB
   ============================================================================ */
Major.renderActiveTab = function(){
    this.shadow.querySelectorAll(".tab-btn").forEach(btn=>{
        btn.classList.toggle("active", btn.dataset.tab === this.activeTab);
    });
    this.shadow.querySelectorAll(".tabview").forEach(v=>{
        v.classList.remove("active");
    });

    const pane = this.shadow.querySelector("#tab-" + this.activeTab);
    if (!pane) return;
    pane.classList.add("active");

    switch(this.activeTab){
        case "overview":    return this.renderOverview(pane);
        case "chain":       return this.renderChain(pane);
        case "enemy":       return this.renderEnemy(pane);
        case "faction":     return this.renderFaction(pane);
        case "war":         return this.renderWar(pane);
        case "predictions": return this.renderPredictions(pane);
        case "targets":     return this.renderTargets(pane);
        case "colonel":     return this.renderColonel(pane);
    }
};

/* ============================================================================
   OVERVIEW TAB
   ============================================================================ */
Major.renderOverview = function(p){
    const u  = this.data.user;
    const ch = this.data.chain;
    const w  = this.data.wars[0] || {};
    const pred = this.data.predictions || {};

    p.innerHTML = `
        <div class="card">
            <h3>Operator</h3>
            <table>
                <tr><th>Name</th><td>${u.name||"?"}</td></tr>
                <tr><th>Level</th><td>${u.level||"?"}</td></tr>
                <tr><th>Status</th><td>${u.status?.description || "?"}</td></tr>
                <tr><th>Health</th><td>${(this.data.bars.life?.current||0)}/${(this.data.bars.life?.maximum||0)}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3>Chain Snapshot</h3>
            <table>
                <tr><th>Hits</th><td>${ch.current||0}</td></tr>
                <tr><th>Timeout</th><td>${ch.timeout||0}s</td></tr>
                <tr><th>Modifier</th><td>x${ch.modifier||1}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3>War Snapshot</h3>
            <table>
                <tr><th>Status</th><td>${w.war_id ? "Active" : "None"}</td></tr>
                <tr><th>Score</th><td>${w.score||0}</td></tr>
                <tr><th>Respect</th><td>${w.respect||0}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3>Colonel Predictions</h3>
            <div class="pred-block">
                <strong>Chain:</strong><br>${pred.chain?.summary || "No chain prediction."}
            </div>
            <div class="pred-block">
                <strong>War:</strong><br>${pred.war?.summary || "No war prediction."}
            </div>
            <div class="pred-block">
                <strong>Enemy Activity:</strong><br>${pred.enemies?.summary || "No enemy prediction."}
            </div>
        </div>
    `;
};

/* ============================================================================
   CHAIN TAB
   ============================================================================ */
Major.renderChain = function(p){
    const ch = this.data.chain;
    const pred = this.data.predictions.chain || {};

    p.innerHTML = `
        <div class="card">
            <h3>Chain Status</h3>
            <table>
                <tr><th>Current Hits</th><td>${ch.current||0}</td></tr>
                <tr><th>Max Hits</th><td>${ch.max||0}</td></tr>
                <tr><th>Timeout</th><td>${ch.timeout||0}s</td></tr>
                <tr><th>Modifier</th><td>x${ch.modifier||1}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3>Chain Predictions</h3>
            <div class="pred-block">
                ${pred.summary || "Insufficient chain history for prediction."}
            </div>
        </div>

        <div class="card">
            <h3>Chain Pace (Hits / Minute)</h3>
            <canvas id="chain-pace-chart" height="120"></canvas>
        </div>

        <div class="card">
            <h3>Chain Progress (Hits Over Time)</h3>
            <canvas id="chain-progress-chart" height="120"></canvas>
        </div>
    `;

    this.renderChainCharts();
};

/* ============================================================================
   RENDER CHAIN CHARTS
   ============================================================================ */
Major.renderChainCharts = function(){
    const colonel = this.nexus.officers?.Colonel;
    const hist = colonel?.memory?.chainHistory || [];
    if (!hist.length) return;

    const labels = hist.map(h => new Date(h.ts).toLocaleTimeString());
    const hits   = hist.map(h => h.hits);

    // Chain Progress
    const ctx1 = this.shadow.querySelector("#chain-progress-chart")?.getContext("2d");
    if (ctx1){
        if (this.charts.chainProgress) this.charts.chainProgress.destroy();
        this.charts.chainProgress = new Chart(ctx1, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Hits",
                    data: hits,
                    borderColor: "#4ac3ff",
                    backgroundColor: "rgba(74,195,255,0.1)",
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: "#ccc" } } },
                scales: {
                    x: { ticks: { color: "#aaa" } },
                    y: { ticks: { color: "#aaa" } }
                }
            }
        });
    }

    // Chain Pace
    const paceLabels = [];
    const paceValues = [];
    for (let i=1; i<hist.length; i++){
        const dt = (hist[i].ts - hist[i-1].ts) / 60000;
        const dh = hist[i].hits - hist[i-1].hits;
        paceLabels.push(new Date(hist[i].ts).toLocaleTimeString());
        paceValues.push(dt > 0 ? dh/dt : 0);
    }

    const ctx2 = this.shadow.querySelector("#chain-pace-chart")?.getContext("2d");
    if (ctx2){
        if (this.charts.chainPace) this.charts.chainPace.destroy();
        this.charts.chainPace = new Chart(ctx2,{
            type:"bar",
            data:{
                labels: paceLabels,
                datasets:[{
                    label:"Hits/Min",
                    data: paceValues,
                    backgroundColor:"#4ac3ff"
                }]
            },
            options:{
                responsive:true,
                plugins:{ legend:{ labels:{ color:"#ccc" } } },
                scales:{
                    x:{ ticks:{ color:"#aaa" } },
                    y:{ ticks:{ color:"#aaa" } }
                }
            }
        });
    }
};

/* ============================================================================
   ENEMY TAB
   ============================================================================ */
Major.renderEnemy = function(p){
    const enemies = this.data.enemies || [];
    const colMem = this.nexus.officers?.Colonel?.memory?.enemies || {};
    const Colonel = this.nexus.officers?.Colonel;

    let rows = enemies.map(e=>{
        const mem = colMem[e.id] || {};
        const est = mem.est || (Colonel ? Colonel.estimateByLevel(e.level) : 0);
        const conf = (mem.confidence || 0).toFixed(2);
        const status = e.status?.state || "Unknown";

        return `
        <tr>
            <td>${e.name}</td>
            <td>${e.level}</td>
            <td>${status}</td>
            <td>${est.toLocaleString()}</td>
            <td>${conf}</td>
            <td><button class="enemy-info-btn" data-id="${e.id}">Info</button></td>
        </tr>`;
    }).join("");

    p.innerHTML = `
        <div class="card">
            <h3>Enemy Operatives</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th><th>Lvl</th><th>Status</th><th>Est Stats</th><th>Conf</th><th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div id="enemy-info-panel"></div>
    `;

    p.querySelectorAll(".enemy-info-btn").forEach(btn=>{
        btn.onclick = ()=>{
            this.showEnemyInfo(btn.dataset.id);
        };
    });
};

Major.showEnemyInfo = function(id){
    const p = this.shadow.querySelector("#enemy-info-panel");
    const enemies = this.data.enemies || [];
    const target = enemies.find(e=>e.id == id);
    if (!target){
        p.innerHTML = "<div class='card'>No data for enemy.</div>";
        return;
    }

    const Colonel = this.nexus.officers.Colonel;
    const mem = Colonel.memory.enemies[id] || {};
    const est = mem.est || Colonel.estimateByLevel(target.level);

    p.innerHTML = `
        <div class="card">
            <h3>${target.name} — Intel</h3>
            <table>
                <tr><th>Level</th><td>${target.level}</td></tr>
                <tr><th>Status</th><td>${target.status?.state}</td></tr>
                <tr><th>Est. Stats</th><td>${est.toLocaleString()}</td></tr>
                <tr><th>Confidence</th><td>${(mem.confidence||0).toFixed(2)}</td></tr>
                <tr><th>Last Seen</th><td>${mem.lastSeen ? new Date(mem.lastSeen).toLocaleString() : "unknown"}</td></tr>
                <tr><th>Fights Logged</th><td>${mem.fights || 0}</td></tr>
            </table>
        </div>
    `;
};

/* ============================================================================
   FACTION TAB
   ============================================================================ */
Major.renderFaction = function(p){
    const f   = this.data.faction;
    const mem = this.data.factionMembers;

    const online = mem.filter(m=>m.status?.state==="Online").length;
    const hosp   = mem.filter(m=>m.status?.state==="Hospitalized").length;
    const travel = mem.filter(m=>m.status?.state==="Traveling").length;

    let rows = mem.map(m=>{
        return `
        <tr>
            <td>${m.name}</td>
            <td>${m.level}</td>
            <td>${m.status?.state}</td>
            <td>${m.last_action?.relative || ""}</td>
        </tr>`;
    }).join("");

    p.innerHTML = `
        <div class="card">
            <h3>Faction Info</h3>
            <table>
                <tr><th>Name</th><td>${f.name||"?"}</td></tr>
                <tr><th>Respect</th><td>${f.respect||0}</td></tr>
                <tr><th>Members</th><td>${mem.length}</td></tr>
                <tr><th>Online</th><td>${online}</td></tr>
                <tr><th>Hospital</th><td>${hosp}</td></tr>
                <tr><th>Travel</th><td>${travel}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3>Members</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th><th>Lvl</th><th>Status</th><th>Last Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

/* ============================================================================
   WAR TAB
   ============================================================================ */
Major.renderWar = function(p){
    const w = this.data.wars[0] || {};
    const pred = this.data.predictions.war || {};

    p.innerHTML = `
        <div class="card">
            <h3>War Status</h3>
            <table>
                <tr><th>Opponent</th><td>${w.opponent_name||"None"}</td></tr>
                <tr><th>Score</th><td>${w.score||0}</td></tr>
                <tr><th>Respect</th><td>${w.respect||0}</td></tr>
            </table>
        </div>

        <div class="card">
            <h3>War Momentum</h3>
            <div class="pred-block">${pred.summary || "No momentum data."}</div>
        </div>

        <div class="card">
            <h3>Respect Pace</h3>
            <canvas id="war-respect-chart" height="100"></canvas>
        </div>

        <div class="card">
            <h3>Score Pace</h3>
            <canvas id="war-score-chart" height="100"></canvas>
        </div>
    `;

    this.renderWarCharts();
};

Major.renderWarCharts = function(){
    const colonel = this.nexus.officers.Colonel;
    const hist = colonel.memory.warHistory || [];
    if (!hist.length) return;

    const labels  = hist.map(h => new Date(h.ts).toLocaleTimeString());
    const respect = hist.map(h => h.respect);
    const score   = hist.map(h => h.score);

    const ctx1 = this.shadow.querySelector("#war-respect-chart")?.getContext("2d");
    if (ctx1){
        if (this.charts.warRespect) this.charts.warRespect.destroy();
        this.charts.warRespect = new Chart(ctx1,{
            type:"line",
            data:{
                labels,
                datasets:[{
                    label:"Respect",
                    data:respect,
                    borderColor:"#4ac3ff",
                    tension:0.2
                }]
            },
            options:{
                responsive:true,
                plugins:{ legend:{ labels:{ color:"#ccc" } } },
                scales:{
                    x:{ ticks:{ color:"#aaa" } },
                    y:{ ticks:{ color:"#aaa" } }
                }
            }
        });
    }

    const ctx2 = this.shadow.querySelector("#war-score-chart")?.getContext("2d");
    if (ctx2){
        if (this.charts.warScore) this.charts.warScore.destroy();
        this.charts.warScore = new Chart(ctx2,{
            type:"line",
            data:{
                labels,
                datasets:[{
                    label:"Score",
                    data:score,
                    borderColor:"#4ac3ff",
                    tension:0.2
                }]
            },
            options:{
                responsive:true,
                plugins:{ legend:{ labels:{ color:"#ccc" } } },
                scales:{
                    x:{ ticks:{ color:"#aaa" } },
                    y:{ ticks:{ color:"#aaa" } }
                }
            }
        });
    }
};
    /* ============================================================================
   PREDICTIONS TAB
   ============================================================================ */
Major.renderPredictions = function(p){
    const pred = this.data.predictions || {};

    p.innerHTML = `
        <div class="card">
            <h3>Chain Predictions</h3>
            <div class="pred-block">${pred.chain?.summary || "No chain prediction."}</div>
        </div>

        <div class="card">
            <h3>War Predictions</h3>
            <div class="pred-block">${pred.war?.summary || "No war prediction."}</div>
        </div>

        <div class="card">
            <h3>Enemy Activity Forecast</h3>
            <div class="pred-block">${pred.enemies?.summary || "No enemy activity data."}</div>
        </div>

        <div class="card">
            <h3>Projected Faction Activity</h3>
            <div class="pred-block">${pred.members?.summary || "No member projection."}</div>
        </div>

        <div class="card">
            <h3>Data Management</h3>
            <button id="wn-export-data">Export Data</button>
            <button id="wn-import-data">Import Data</button>
            <input type="file" id="wn-import-file" style="display:none;">
        </div>
    `;

    this.bindDataIO();
};

/* ============================================================================
   IMPORT / EXPORT DATA
   ============================================================================ */
Major.bindDataIO = function(){
    const col = this.nexus.officers.Colonel;

    const exportBtn = this.shadow.querySelector("#wn-export-data");
    const importBtn = this.shadow.querySelector("#wn-import-data");
    const importFile = this.shadow.querySelector("#wn-import-file");

    if (exportBtn){
        exportBtn.onclick = ()=>{
            const data = {
                colonelMemory: col.memory,
                sharedTargets: JSON.parse(GM_getValue("WN_SHARED_TARGETS","[]")),
                settings: this.nexus.state.settings
            };

            const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "nexus_backup.json";
            a.click();

            URL.revokeObjectURL(url);
        };
    }

    if (importBtn){
        importBtn.onclick = ()=> importFile.click();
    }

    importFile?.addEventListener("change", ()=>{
        const file = importFile.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt)=>{
            try {
                const json = JSON.parse(evt.target.result);
                if (json.colonelMemory) col.memory = json.colonelMemory;
                if (json.sharedTargets) GM_setValue("WN_SHARED_TARGETS", JSON.stringify(json.sharedTargets));
                if (json.settings) this.nexus.state.settings = json.settings;

                alert("Data imported successfully.");
                this.renderActiveTab();

            } catch(err){
                alert("Invalid backup file.");
            }
        };
        reader.readAsText(file);
    });
};

/* ============================================================================
   TARGETS TAB
   ============================================================================ */
Major.renderTargets = function(p){
    p.innerHTML = `
        <div class="card">
            <h3>Target Selection</h3>
            <div class="subtabs">
                <div class="subtab-btn" data-sub="personal">Personal</div>
                <div class="subtab-btn" data-sub="war">War</div>
                <div class="subtab-btn" data-sub="shared">Shared</div>
            </div>

            <div id="sub-personal" class="subtabview"></div>
            <div id="sub-war" class="subtabview"></div>
            <div id="sub-shared" class="subtabview"></div>
        </div>
    `;

    this.bindTargetSubtabs();
    this.renderTargetSubtab("personal");
};

/* ============================================================================
   TARGET SUBTAB SWITCHING
   ============================================================================ */
Major.bindTargetSubtabs = function(){
    const btns = this.shadow.querySelectorAll(".subtab-btn");
    btns.forEach(btn=>{
        btn.onclick = ()=>{
            const tab = btn.dataset.sub;

            btns.forEach(b=>b.classList.remove("active"));
            btn.classList.add("active");

            this.renderTargetSubtab(tab);
        };
    });

    btns[0]?.classList.add("active");
};

/* ============================================================================
   RENDER SUBTABS
   ============================================================================ */
Major.renderTargetSubtab = function(name){
    this.shadow.querySelectorAll(".subtabview").forEach(x => x.classList.remove("active"));
    const pane = this.shadow.querySelector("#sub-"+name);
    if (!pane) return;
    pane.classList.add("active");

    if (name === "personal") return this.renderPersonalTargets(pane);
    if (name === "war")      return this.renderWarTargetsSub(pane);
    if (name === "shared")   return this.renderSharedTargets(pane);
};

/* ============================================================================
   PERSONAL TARGETS
   ============================================================================ */
Major.renderPersonalTargets = function(p){
    const Colonel = this.nexus.officers.Colonel;
    const t = Colonel.evaluateTargets();

    if (!t.length){
        p.innerHTML = "<div class='card'>No enemy targets available.</div>";
        return;
    }

    let rows = t.map(e=>{
        const ratio = (Number(this.data.stats?.total)||1) / e.est;
        return `
        <tr>
            <td>${e.name}</td>
            <td>${e.level}</td>
            <td>${e.online ? "Online" : "Offline"}</td>
            <td>${e.est.toLocaleString()}</td>
            <td>${ratio.toFixed(2)}x</td>
            <td>${e.threat.label}</td>
            <td><button class="personal-target-info-btn" data-id="${e.id}">Info</button></td>
        </tr>`;
    }).join("");

    p.innerHTML = `
        <div class="card">
            <h3>Personal Targets</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th><th>Lvl</th><th>Status</th>
                        <th>Est Stats</th><th>Ratio</th><th>Threat</th><th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <div id="personal-target-info"></div>
    `;

    p.querySelectorAll(".personal-target-info-btn").forEach(btn=>{
        btn.onclick = ()=>{
            this.showPersonalTargetInfo(btn.dataset.id);
        };
    });
};

Major.showPersonalTargetInfo = function(id){
    const pane = this.shadow.querySelector("#personal-target-info");
    const enemies = this.data.enemies;
    const target = enemies.find(e=>e.id == id);
    if (!target){
        pane.innerHTML = "<div class='card'>No data.</div>";
        return;
    }

    const Colonel = this.nexus.officers.Colonel;
    const mem = Colonel.memory.enemies[id] || {};
    const est = mem.est || Colonel.estimateByLevel(target.level);
    const ratio = (Number(this.data.stats?.total)||1) / est;

    pane.innerHTML = `
        <div class="card">
            <h3>${target.name} — Personal Target Intel</h3>
            <table>
                <tr><th>Level</th><td>${target.level}</td></tr>
                <tr><th>Status</th><td>${target.status?.state}</td></tr>
                <tr><th>Est. Stats</th><td>${est.toLocaleString()}</td></tr>
                <tr><th>Ratio</th><td>${ratio.toFixed(2)}x</td></tr>
                <tr><th>Threat</th><td>${Colonel.threatScore(target).label}</td></tr>
            </table>
        </div>
    `;
};

/* ============================================================================
   WAR TARGETS SUBTAB
   ============================================================================ */
Major.renderWarTargetsSub = function(p){
    const enemies = this.data.enemies;
    const w = this.data.wars[0];
    const Colonel = this.nexus.officers.Colonel;

    if (!w){
        p.innerHTML = "<div class='card'>No active war.</div>";
        return;
    }

    const warHits = Colonel.memory.warHistory || [];
    const recent = warHits.slice(-100);
    const warEnemyIds = new Set(recent.map(h => h.attackerId).filter(Boolean));

    const wEnemies = enemies.filter(e => warEnemyIds.has(e.id));

    if (!wEnemies.length){
        p.innerHTML = "<div class='card'>No known active war participants.</div>";
        return;
    }

    let rows = wEnemies.map(e=>{
        const mem = Colonel.memory.enemies[e.id] || {};
        const est = mem.est || Colonel.estimateByLevel(e.level);
        const threat = Colonel.threatScore(e).label;

        return `
        <tr>
            <td>${e.name}</td>
            <td>${e.level}</td>
            <td>${e.status?.state}</td>
            <td>${est.toLocaleString()}</td>
            <td>${threat}</td>
        </tr>
        `;
    }).join("");

    p.innerHTML = `
        <div class="card">
            <h3>War Participants</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th><th>Lvl</th><th>Status</th><th>Est Stats</th><th>Threat</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

/* ============================================================================
   SHARED TARGETS
   ============================================================================ */
Major.renderSharedTargets = function(p){
    const stored = GM_getValue("WN_SHARED_TARGETS", "[]");
    let targets = [];
    try { targets = JSON.parse(stored); } catch {}

    let rows = targets.map((t,i)=>{
        return `
        <tr>
            <td>${t.name}</td>
            <td>${t.id}</td>
            <td><button class="shared-del" data-i="${i}">Delete</button></td>
        </tr>`;
    }).join("");

    p.innerHTML = `
        <div class="card">
            <h3>Shared Targets</h3>
            <table>
                <thead>
                    <tr><th>Name</th><th>ID</th><th></th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <h3 style="margin-top:12px;">Add Target</h3>
            <input id="new-target-name" placeholder="Name" style="width:45%;padding:6px;margin-right:5px;">
            <input id="new-target-id" placeholder="ID" style="width:30%;padding:6px;margin-right:5px;">
            <button id="add-target-btn">Add</button>
        </div>
    `;

    this.bindSharedTargetActions(p);
};

Major.bindSharedTargetActions = function(p){
    p.querySelectorAll(".shared-del").forEach(btn=>{
        btn.onclick = ()=>{
            const stored = GM_getValue("WN_SHARED_TARGETS","[]");
            let targets = [];
            try { targets = JSON.parse(stored); } catch {}

            targets.splice(btn.dataset.i,1);
            GM_setValue("WN_SHARED_TARGETS", JSON.stringify(targets));

            this.renderTargetSubtab("shared");
        };
    });

    p.querySelector("#add-target-btn").onclick = ()=>{
        const name = p.querySelector("#new-target-name").value.trim();
        const id = p.querySelector("#new-target-id").value.trim();
        if (!name || !id) return alert("Enter name and ID.");

        let targets = [];
        try { targets = JSON.parse(GM_getValue("WN_SHARED_TARGETS","[]")); } catch {}
        targets.push({name,id});

        GM_setValue("WN_SHARED_TARGETS", JSON.stringify(targets));
        this.renderTargetSubtab("shared");
    };
};

/* ============================================================================
   COLONEL TERMINAL + ANIMATED TEXT
   ============================================================================ */
Major.renderColonel = function(p){

    p.innerHTML = `
        <div class="card">
            <h3>Colonel Command Interface</h3>
            <div id="colonel-terminal"></div>
            <input type="text" id="colonel-input" placeholder="Ask the Colonel...">
        </div>
    `;

    const input = this.shadow.querySelector("#colonel-input");
    const term  = this.shadow.querySelector("#colonel-terminal");

    // Initial message
    this.appendAnimatedTerminalText("Colonel online. Awaiting command...");

    input.addEventListener("keydown", e=>{
        if (e.key === "Enter"){
            const val = input.value.trim();
            if (!val) return;
            input.value = "";

            // echo user command
            const div = document.createElement("div");
            div.style.color = "#fff";
            div.textContent = "> " + val;
            term.appendChild(div);

            term.scrollTop = term.scrollHeight;

            this.nexus.events.emit("ASK_COLONEL", { question: val });
        }
    });
};

/* ============================================================================
   TERMINAL TEXT TYPING EFFECT
   ============================================================================ */
Major.appendAnimatedTerminalText = function(text){
    const term = this.shadow.querySelector("#colonel-terminal");
    if (!term) return;

    let i = 0;
    const div = document.createElement("div");
    div.style.color = "#4acd7a";
    term.appendChild(div);

    const typer = ()=>{
        if (i < text.length){
            div.textContent += text[i++];
            term.scrollTop = term.scrollHeight;
            requestAnimationFrame(typer);
        }
    };
    requestAnimationFrame(typer);
};

/* ============================================================================
   FINAL REGISTRATION
   ============================================================================ */
if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name:"Major",
    module:Major
});

})();
