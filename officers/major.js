// ============================================================================
//  WAR NEXUS — MAJOR v3.2
//  EXPANDED TACTICAL DASHBOARD + COLONEL v5.0 INTEGRATION
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

    // === data fed by SITREP ===
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

    charts: {} // Chart.js instances
};

/* ============================================================================
   INIT
   ============================================================================ */
Major.init = function(nexus){
    this.nexus = nexus;

    this.createUI();
    this.applyStyles();
    this.bindEvents();

    nexus.log("Major v3.2 loaded (Tactical Dashboard)");
};

/* ============================================================================
   UI CREATION
   ============================================================================ */
Major.createUI = function(){
    // Create container
    this.container = document.createElement("div");
    this.container.id = "wn-major-container";
    document.body.appendChild(this.container);

    // Shadow DOM
    this.shadow = this.container.attachShadow({mode:"open"});

    // Base layout
    this.shadow.innerHTML = `
        <div id="major-root">
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
        </div>
    `;
};

/* ============================================================================
   STYLES
   ============================================================================ */
Major.applyStyles = function(){
    const css = `
        :host {
            all: initial;
        }

        #major-root {
            position: fixed;
            top: 70px;
            right: 10px;
            bottom: 10px;
            width: 920px;
            max-width: 95vw;
            background: #0c0c0c;
            border: 1px solid #111;
            border-radius: 6px;
            box-shadow: 0 0 20px rgba(0,0,0,0.7);
            display: flex;
            overflow: hidden;
            z-index: 2147483640;
            font-family: Segoe UI, Arial, sans-serif;
            color: #ddd;
        }

        #sidebar {
            width: 140px;
            background: #050505;
            border-right: 1px solid #111;
            display: flex;
            flex-direction: column;
            padding-top: 10px;
        }

        .tab-btn {
            padding: 14px 10px;
            cursor: pointer;
            font-size: 14px;
            color: #bbb;
            user-select: none;
            border-bottom: 1px solid #111;
        }
        .tab-btn:hover {
            background: #111;
            color: #4ac3ff;
        }
        .tab-btn.active {
            background: #1a1a1a;
            color: #4ac3ff;
            font-weight: bold;
        }

        #content {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
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

        .card {
            background: #121212;
            border: 1px solid #1e1e1e;
            border-radius: 5px;
            padding: 14px;
            margin-bottom: 16px;
            box-shadow: 0 0 8px rgba(0,0,0,0.5);
        }

        .card h3 {
            margin: 0 0 10px;
            color: #4ac3ff;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 6px;
        }
        table th, table td {
            padding: 4px 6px;
            border-bottom: 1px solid #1a1a1a;
            text-align: left;
        }
        table th {
            color: #4ac3ff;
            width: 140px;
        }

        /* Colonel terminal */
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
        }

        #colonel-input {
            width: 100%;
            padding: 8px;
            background: #111;
            border: 1px solid #333;
            color: #eee;
            border-radius: 3px;
        }

        /* Predictions panel */
        .pred-block {
            margin-bottom: 14px;
            padding: 10px;
            background: #111;
            border-left: 3px solid #4ac3ff;
        }

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
        }

        .subtabview {
            display: none;
        }
        .subtabview.active {
            display: block;
        }
    `;

    const style = document.createElement("style");
    style.textContent = css;
    this.shadow.appendChild(style);
};

/* ============================================================================
   EVENT BINDINGS
   ============================================================================ */
Major.bindEvents = function(){

    // TAB SWITCH
    this.shadow.querySelectorAll(".tab-btn").forEach(btn=>{
        btn.onclick = ()=>{
            this.activeTab = btn.dataset.tab;
            this.renderActiveTab();
        };
    });

    // SITREP (from Colonel)
    this.nexus.events.on("SITREP_UPDATE", data => {
        this.data.user        = data.user   || {};
        this.data.stats       = data.stats  || {};
        this.data.bars        = data.bars   || {};
        this.data.chain       = data.chain  || {};
        this.data.faction     = data.faction || {};
        this.data.factionMembers = data.factionMembers || [];
        this.data.enemies     = data.enemies || [];
        this.data.wars        = data.wars   || [];
        this.data.predictions = data.predictions || {};

        this.renderActiveTab();
    });

    // COLONEL RESPONSES
    this.nexus.events.on("ASK_COLONEL_RESPONSE", payload => {
        const term = this.shadow.querySelector("#colonel-terminal");
        if (!term) return;

        const div = document.createElement("div");
        div.style.color = "#4acd7a";
        div.textContent = payload.answer;
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
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
    const hist = this.nexus.officers?.Colonel?.memory?.chainHistory || [];
    if (!hist.length) return;

    const labels = hist.map(h => new Date(h.ts).toLocaleTimeString());
    const hits   = hist.map(h => h.hits);

    // CHAIN PROGRESS
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

    // CHAIN PACE
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

    let rows = enemies.map(e=>{
        const mem = colMem[e.id] || {};
        const est = mem.est || this.nexus.officers.Colonel.estimateByLevel(e.level);
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

    // Add event listeners for info buttons
    p.querySelectorAll(".enemy-info-btn").forEach(btn=>{
        btn.onclick = ()=>{
            const id = btn.dataset.id;
            this.showEnemyInfo(id);
        };
    });
};

/* ============================================================================
   ENEMY INFO PANEL
   ============================================================================ */
Major.showEnemyInfo = function(id){
    const p = this.shadow.querySelector("#enemy-info-panel");
    const enemies = this.data.enemies || [];
    const target = enemies.find(e=>e.id == id);
    if (!target){
        p.innerHTML = "<div class='card'>No data for enemy.</div>";
        return;
    }

    const mem = this.nexus.officers.Colonel.memory.enemies[id] || {};
    const est = mem.est || this.nexus.officers.Colonel.estimateByLevel(target.level);

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
    const f = this.data.faction;
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

/* ============================================================================
   WAR CHARTS
   ============================================================================ */
Major.renderWarCharts = function(){
    const hist = this.nexus.officers.Colonel.memory.warHistory || [];
    if (!hist.length) return;

    const labels = hist.map(h => new Date(h.ts).toLocaleTimeString());
    const respect = hist.map(h => h.respect);
    const score = hist.map(h => h.score);

    // Respect Chart
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

    // Score Chart
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
            <div class="pred-block">${pred.enemies?.summary || "No enemy prediction."}</div>
        </div>

        <div class="card">
            <h3>Projected Faction Activity</h3>
            <div class="pred-block">${pred.members?.summary || "No member projection."}</div>
        </div>
    `;
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
            this.renderTargetSubtab(tab);

            btns.forEach(b=>b.classList.remove("active"));
            btn.classList.add("active");
        };
    });

    // default
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
    if (name === "war")      return this.renderWarTargets(pane);
    if (name === "shared")   return this.renderSharedTargets(pane);
};

/* ============================================================================
   PERSONAL TARGETS (direct from Colonel.evaluateTargets())
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
            <td><button class="target-info-btn" data-id="${e.id}">Info</button></td>
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

    p.querySelectorAll(".target-info-btn").forEach(btn=>{
        btn.onclick = ()=>{
            this.showPersonalTargetInfo(btn.dataset.id);
        };
    });
};

/* ============================================================================
   PERSONAL TARGET INFO
   ============================================================================ */
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
   WAR TARGETS
   ============================================================================ */
Major.renderWarTargets = function(p){
    const enemies = this.data.enemies || [];
    const w = this.data.wars[0];

    if (!w){
        p.innerHTML = "<div class='card'>No active war.</div>";
        return;
    }

    // Filter to enemies with hits in war history if possible
    const warHits = this.nexus.officers.Colonel.memory.warHistory || [];
    const recent = warHits.slice(-100);
    const warEnemyIds = new Set(recent.map(h => h.attackerId).filter(Boolean));

    const wEnemies = enemies.filter(e => warEnemyIds.has(e.id));

    if (!wEnemies.length){
        p.innerHTML = "<div class='card'>No known war participants.</div>";
        return;
    }

    const Colonel = this.nexus.officers.Colonel;

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
        </tr>`;
    }).join("");

    p.innerHTML = `
        <div class="card">
            <h3>War Targets (Active Participants)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th><th>Level</th><th>Status</th>
                        <th>Est Stats</th><th>Threat</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

/* ============================================================================
   SHARED TARGETS (stored locally)
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
            <td><button class="shared-del" data-i="${i}">Remove</button></td>
        </tr>`;
    }).join("");

    p.innerHTML = `
        <div class="card">
            <h3>Shared Target List</h3>
            <table>
                <thead>
                    <tr><th>Name</th><th>ID</th><th></th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <h3 style="margin-top:15px;">Add Target</h3>
            <input id="new-target-name" placeholder="Name" style="width:45%;padding:6px;margin-right:5px;">
            <input id="new-target-id" placeholder="ID" style="width:30%;padding:6px;margin-right:5px;">
            <button id="add-target-btn">Add</button>
        </div>
    `;

    this.bindSharedTargetActions(p);
};

/* ============================================================================
   BIND SHARED TARGET EVENTS
   ============================================================================ */
Major.bindSharedTargetActions = function(p){
    // Remove
    p.querySelectorAll(".shared-del").forEach(btn=>{
        btn.onclick = ()=>{
            const stored = GM_getValue("WN_SHARED_TARGETS", "[]");
            let targets = [];
            try { targets = JSON.parse(stored); } catch {}
            targets.splice(btn.dataset.i, 1);
            GM_setValue("WN_SHARED_TARGETS", JSON.stringify(targets));
            this.renderTargetSubtab("shared");
        };
    });

    // Add
    p.querySelector("#add-target-btn").onclick = ()=>{
        const name = p.querySelector("#new-target-name").value.trim();
        const id = p.querySelector("#new-target-id").value.trim();
        if (!name || !id) return;

        const stored = GM_getValue("WN_SHARED_TARGETS", "[]");
        let targets = [];
        try { targets = JSON.parse(stored); } catch {}

        targets.push({name, id});
        GM_setValue("WN_SHARED_TARGETS", JSON.stringify(targets));

        this.renderTargetSubtab("shared");
    };
};

/* ============================================================================
   COLONEL AI TAB
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

    // Initialize terminal
    term.innerHTML = `<div style="color:#4ac3ff;">Colonel online. Awaiting command.</div>`;

    input.addEventListener("keydown", e=>{
        if (e.key === "Enter"){
            const val = input.value.trim();
            if (!val) return;
            input.value = "";

            const div = document.createElement("div");
            div.style.color = "#fff";
            div.textContent = "> " + val;
            term.appendChild(div);

            this.nexus.events.emit("ASK_COLONEL", { question: val });
        }
    });
};

/* ============================================================================
   REGISTER
   ============================================================================ */
if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name:"Major",
    module:Major
});

})();
