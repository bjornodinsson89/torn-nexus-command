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

    data: {
        user: {},
        faction: [],
        enemy: [],
        chain: {},
        targets: {
            personal: [],
            war: [],
            shared: []
        },
        ai: {},
        aiMemory: {}
    }
};

/* BLOCK: INIT */

Major.init = function(nexus){
    this.nexus = nexus;

    this.createHost();
    this.createUI();
    this.applyBaseStyles();
    this.bindDrawerButton();
    this.bindTabs();
    this.bindNexusEvents();
};

/* BLOCK: HOST + SHADOW DOM */

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

/* BLOCK: UI STRUCTURE */

Major.createUI = function(){
    this.shadow.innerHTML = `
        <div id="wnx-btn">NEX</div>

        <div id="wnx-drawer" class="closed">
            <div id="wnx-tabs">
                <button data-t="overview" class="on">OVERVIEW</button>
                <button data-t="faction">FACTION</button>
                <button data-t="enemy">ENEMY</button>
                <button data-t="chain">CHAIN</button>
                <button data-t="targets">TARGETS</button>
                <button data-t="ai">AI CONSOLE</button>
                <button data-t="strategy">STRATEGY</button>
                <button data-t="settings">SETTINGS</button>
            </div>

            <div id="wnx-panels">
                <div id="p-overview" class="panel on"></div>
                <div id="p-faction" class="panel"></div>
                <div id="p-enemy" class="panel"></div>
                <div id="p-chain" class="panel"></div>
                <div id="p-targets" class="panel"></div>
                <div id="p-ai" class="panel"></div>
                <div id="p-strategy" class="panel"></div>
                <div id="p-settings" class="panel"></div>
            </div>
        </div>
    `;

    this.drawer = this.shadow.querySelector("#wnx-drawer");
    this.btn = this.shadow.querySelector("#wnx-btn");
};

/* BLOCK: BASE STYLES (FUNCTIONAL GRITTY THEME) */

Major.applyBaseStyles = function(){
    const s = document.createElement("style");
    s.textContent = `
        :host { all: initial; }

        #wnx-btn {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 60px;
            height: 60px;
            background: #2D2D2D;
            border: 2px solid #3E4042;
            border-radius: 50%;
            color: #F2F2F2;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-family: Arial, sans-serif;
            font-weight: bold;
            font-size: 15px;
            box-shadow: 0 0 12px rgba(0,0,0,0.4);
        }

        #wnx-drawer {
            position: fixed;
            top: 0;
            left: 0;
            width: 420px;
            height: 100vh;
            background: #222222;
            border-right: 2px solid #3E4042;
            transform: translateX(-100%);
            transition: 0.32s ease;
            color: #F2F2F2;
            font-family: Arial, sans-serif;
            overflow-y: auto;
        }

        #wnx-drawer.open {
            transform: translateX(0);
        }

        #wnx-tabs {
            display: flex;
            flex-wrap: wrap;
            border-bottom: 1px solid #3E4042;
            background: #2D2D2D;
        }

        #wnx-tabs button {
            flex: 1;
            border: none;
            padding: 8px;
            background: #2D2D2D;
            color: #F2F2F2;
            cursor: pointer;
            border-right: 1px solid #3E4042;
            font-size: 12px;
        }

        #wnx-tabs button.on {
            background: #36393E;
        }

        .panel {
            display: none;
            padding: 12px;
            font-size: 13px;
        }

        .panel.on {
            display: block;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            color: #F2F2F2;
        }

        th, td {
            padding: 6px;
            border-bottom: 1px solid #3E4042;
        }

        .indicator {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            margin-right: 6px;
            display: inline-block;
        }

        .green  { background: #3CCB5A; }
        .yellow { background: #E5D543; }
        .orange { background: #E59F3B; }
        .red    { background: #E55454; }
    `;
    this.shadow.appendChild(s);
};

/* BLOCK: DRAWER BUTTON */

Major.bindDrawerButton = function(){
    this.btn.addEventListener("click", () => {
        const open = this.drawer.classList.contains("open");

        if (!open){
            this.drawer.classList.add("open");
            this.nexus.events.emit("UI_DRAWER_OPENED");
        } else {
            this.drawer.classList.remove("open");
        }
    });
};

/* BLOCK: TAB SWITCHING */

Major.bindTabs = function(){
    this.shadow.querySelectorAll("#wnx-tabs button").forEach(btn => {
        btn.addEventListener("click", () => {
            this.shadow.querySelectorAll("#wnx-tabs button")
                .forEach(b => b.classList.remove("on"));
            this.shadow.querySelectorAll(".panel")
                .forEach(p => p.classList.remove("on"));

            btn.classList.add("on");
            this.activeTab = btn.dataset.t;
            this.shadow.querySelector(`#p-${this.activeTab}`).classList.add("on");

            this.renderActiveTab();
        });
    });
};

/* BLOCK: EVENT LISTENERS (NEXUS DATA>UI) */

Major.bindNexusEvents = function(){
    this.nexus.events.on("SITREP_UPDATE", d => {
        this.data.user = d.user;
        this.data.faction = d.factionMembers;
        this.data.enemy = d.enemyMembers;
        this.data.chain = d.chain;
        this.data.targets = d.targets;
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

/* BLOCK: TAB DISPATCH */

Major.renderActiveTab = function(){
    if (this.activeTab === "overview") this.renderOverview();
    else if (this.activeTab === "faction") this.renderFaction();
    else if (this.activeTab === "enemy") this.renderEnemy();
    else if (this.activeTab === "chain") this.renderChain();
    else if (this.activeTab === "targets") this.renderTargets();
    else if (this.activeTab === "ai") this.renderAIConsole();
    else if (this.activeTab === "strategy") this.renderStrategy();
    else if (this.activeTab === "settings") this.renderSettings();
};

/* BLOCK: ADDITIONAL STYLES */

(() => {
    const s = document.createElement("style");
    s.textContent = `
        .wnx-section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #3E4042;
            color: #F2F2F2;
        }

        .wnx-flex {
            display: flex;
            align-items: center;
        }

        .wnx-metric {
            background: #2D2D2D;
            border: 1px solid #3E4042;
            padding: 10px;
            border-radius: 4px;
            margin-right: 10px;
            flex: 1;
            text-align: center;
            color: #F2F2F2;
        }

        .wnx-metric-value {
            font-size: 18px;
            font-weight: bold;
            margin-top: 4px;
            color: #F2F2F2;
        }

        .wnx-traffic {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-left: 6px;
        }

        .wnx-green  { background: #3CCB5A; }
        .wnx-yellow { background: #E5D543; }
        .wnx-orange { background: #E59F3B; }
        .wnx-red    { background: #E55454; }

        #p-overview table th {
            background: #2D2D2D;
            color: #F2F2F2;
            font-weight: bold;
        }

        .wnx-small {
            font-size: 11px;
            color: #BEBEBE;
        }

        .wnx-stats-row {
            display: flex;
            margin-bottom: 10px;
        }

        .wnx-pill {
            padding: 4px 8px;
            background: #36393E;
            border: 1px solid #
            3E4042;
            border-radius: 3px;
            font-size: 11px;
            color: #F2F2F2;
            margin-right: 6px;
        }
    `;
    Major.shadow.appendChild(s);
})();

/* BLOCK: UTILITIES */

Major.indicator = function(value){
    if (value < 0.25) return `<span class="wnx-traffic wnx-green"></span>`;
    if (value < 0.5)  return `<span class="wnx-traffic wnx-yellow"></span>`;
    if (value < 0.75) return `<span class="wnx-traffic wnx-orange"></span>`;
    return `<span class="wnx-traffic wnx-red"></span>`;
};

Major.simpleGauge = function(label, value){
    const pct = Math.round(value * 100);
    return `
        <div class="wnx-metric">
            <div>${label}</div>
            <div class="wnx-metric-value">${pct}% ${this.indicator(value)}</div>
        </div>
    `;
};

Major.smallStat = function(label, value){
    return `
        <div class="wnx-pill">
            ${label}: <b>${value}</b>
        </div>
    `;
};

Major.buildTable = function(headers, rows){
    let h = `<tr>${headers.map(x => `<th>${x}</th>`).join("")}</tr>`;
    let r = rows.map(row =>
        `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`
    ).join("");
    return `<table>${h}${r}</table>`;
};

/* BLOCK: OVERVIEW RENDER */

Major.renderOverview = function(){
    const p = this.shadow.querySelector("#p-overview");
    const u = this.data.user;
    const a = this.data.ai;
    const c = this.data.chain;

    if (!u || !a){
        p.textContent = "Awaiting data…";
        return;
    }

    p.innerHTML = `
        <div class="wnx-section-title">Operator</div>
        <div class="wnx-stats-row">
            ${this.smallStat("Name", u.name || "")}
            ${this.smallStat("Level", u.level || "")}
            ${this.smallStat("HP", `${u.hp}/${u.max_hp}`)}
            ${this.smallStat("Status", u.status || "")}
        </div>

        <div class="wnx-section-title">AI Indicators</div>
        <div class="wnx-stats-row">
            ${this.simpleGauge("Threat", a.threat)}
            ${this.simpleGauge("Risk", a.risk)}
        </div>
        <div class="wnx-stats-row">
            ${this.simpleGauge("Aggression", a.aggression)}
            ${this.simpleGauge("Instability", a.instability)}
        </div>

        <div class="wnx-section-title">Chain</div>
        <div class="wnx-stats-row">
            ${this.smallStat("Hits", c.hits || 0)}
            ${this.smallStat("Timeout", c.timeLeft ? c.timeLeft + "s" : "N/A")}
            ${this.smallStat("Next Hit", a.prediction?.nextHit || 0)}
            ${this.smallStat("Drop Risk", a.prediction?.drop || 0)}
        </div>

        <div class="wnx-section-title">Summary</div>
        <div>${a.summary.map(x => `<div>• ${x}</div>`).join("")}</div>
    `;
};

/* BLOCK: FACTION RENDER */

Major.renderFaction = function(){
    const p = this.shadow.querySelector("#p-faction");
    const list = this.data.faction;

    if (!list || !list.length){
        p.textContent = "No faction data available.";
        return;
    }

    const rows = list.map(m => {
        const online = m.online ? "Online" : "Offline";
        const ind = m.online ? this.indicator(0.1) : this.indicator(0.9);
        return [
            m.name,
            m.level,
            m.status || "",
            m.last_action || "",
            `${online} ${ind}`
        ];
    });

    p.innerHTML = `
        <div class="wnx-section-title">Faction Roster</div>
        ${this.buildTable(["Name","Lv","Status","Last Action","Online"], rows)}
    `;
};

/* BLOCK: ENEMY RENDER */

Major.renderEnemy = function(){
    const p = this.shadow.querySelector("#p-enemy");
    const list = this.data.enemy;

    if (!list || !list.length){
        p.textContent = "No enemy data.";
        return;
    }

    const rows = list.map(m => {
        const online = m.online ? "Online" : "Offline";
        const ind = m.online ? this.indicator(0.1) : this.indicator(0.9);
        return [
            m.name,
            m.level,
            m.status || "",
            m.score || 0,
            `${online} ${ind}`
        ];
    });

    p.innerHTML = `
        <div class="wnx-section-title">Enemy Faction Members</div>
        ${this.buildTable(["Name","Lv","Status","Score","Online"], rows)}
    `;
};

/* BLOCK: CHAIN RENDER */

Major.renderChain = function(){
    const p = this.shadow.querySelector("#p-chain");
    const c = this.data.chain;

    if (!c){
        p.textContent = "No chain data.";
        return;
    }

    p.innerHTML = `
        <div class="wnx-section-title">Chain Status</div>
        <div class="wnx-stats-row">
            ${this.smallStat("Hits", c.hits || 0)}
            ${this.smallStat("Timeout", c.timeLeft ? c.timeLeft + "s" : "N/A")}
            ${this.smallStat("Active", c.hits > 0 ? "YES" : "NO")}
        </div>

        <div id="wnx-chain-graph" style="height:180px;margin-top:12px;"></div>
    `;
};

/* BLOCK: TARGETS RENDER */

Major.renderTargets = function(){
    const p = this.shadow.querySelector("#p-targets");
    const sub = this.targetSubTab;
    const tgt = this.data.targets[sub] || [];

    const rows = tgt.map(t => [
        t.name || "",
        t.level || "",
        t.status || "",
        t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ""
    ]);

    const btnPersonal = sub === "personal" ? "on" : "";
    const btnWar = sub === "war" ? "on" : "";
    const btnShared = sub === "shared" ? "on" : "";

    p.innerHTML = `
        <div class="wnx-section-title">Targets</div>

        <div style="display:flex;margin-bottom:10px;">
            <button id="wnx-tgt-personal" class="${btnPersonal}" style="flex:1;">Personal</button>
            <button id="wnx-tgt-war" class="${btnWar}" style="flex:1;">War</button>
            <button id="wnx-tgt-shared" class="${btnShared}" style="flex:1;">Shared</button>
        </div>

        ${this.buildTable(["Name","Lv","Status","Last Seen"], rows)}
    `;

    this.shadow.querySelector("#wnx-tgt-personal").onclick = () => {
        this.targetSubTab = "personal";
        this.renderTargets();
    };

    this.shadow.querySelector("#wnx-tgt-war").onclick = () => {
        this.targetSubTab = "war";
        this.renderTargets();
    };

    this.shadow.querySelector("#wnx-tgt-shared").onclick = () => {
        this.targetSubTab = "shared";
        this.renderTargets();
    };
};

/* BLOCK: AI CONSOLE */

Major.renderAIConsole = function(){
    const p = this.shadow.querySelector("#p-ai");

    p.innerHTML = `
        <div class="wnx-section-title">AI Console</div>

        <div id="wnx-ai-log"
             style="background:#2D2D2D;border:1px solid #3E4042;height:280px;overflow-y:auto;
                    padding:10px;font-family:monospace;font-size:12px;margin-bottom:10px;">
        </div>

        <input id="wnx-ai-input"
               placeholder="Ask the Colonel…"
               style="width:100%;padding:8px;background:#222222;border:1px solid #3E4042;
                      color:#F2F2F2;font-size:13px;">
    `;

    const input = p.querySelector("#wnx-ai-input");
    const log = p.querySelector("#wnx-ai-log");

    input.addEventListener("keydown", e => {
        if (e.key === "Enter" && input.value.trim()){
            const msg = input.value.trim();
            const d = document.createElement("div");
            d.style.marginBottom = "6px";
            d.textContent = "> " + msg;
            log.appendChild(d);
            log.scrollTop = log.scrollHeight;

            this.nexus.events.emit("ASK_COLONEL", { question: msg });
            input.value = "";
        }
    });
};

Major.appendAIChatResponse = function(answer){
    const log = this.shadow.querySelector("#wnx-ai-log");
    if (!log) return;
    const d = document.createElement("div");
    d.style.marginBottom = "6px";
    d.style.color = "#BEBEBE";
    d.textContent = answer;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
};

/* BLOCK: STRATEGY RENDER */

Major.renderStrategy = function(){
    const p = this.shadow.querySelector("#p-strategy");
    const a = this.data.ai || {};
    const mem = this.data.aiMemory || {};

    const mode = this.strategyMode;

    p.innerHTML = `
        <div class="wnx-section-title">Combat Mode</div>
        <div style="display:flex;margin-bottom:14px;">
            <button id="wnx-mode-off" class="${mode==="OFFENSIVE"?"on":""}" style="flex:1;">Offensive</button>
            <button id="wnx-mode-def" class="${mode==="DEFENSIVE"?"on":""}" style="flex:1;">Defensive</button>
            <button id="wnx-mode-hyb" class="${mode==="HYBRID"?"on":""}" style="flex:1;">Hybrid</button>
        </div>

        <div class="wnx-section-title">AI Tactical Indicators</div>
        <div class="wnx-stats-row">
            ${this.simpleGauge("Threat", a.threat || 0)}
            ${this.simpleGauge("Risk", a.risk || 0)}
        </div>
        <div class="wnx-stats-row">
            ${this.simpleGauge("Aggression", a.aggression || 0)}
            ${this.simpleGauge("Instability", a.instability || 0)}
        </div>

        <div class="wnx-section-title">Predictions</div>
        <div class="wnx-stats-row">
            ${this.smallStat("Next Hit", a.prediction?.nextHit || 0)}
            ${this.smallStat("Drop Risk", a.prediction?.drop || 0)}
        </div>

        <div class="wnx-section-title">AI Memory Status</div>
        <div>${Object.keys(mem.enemy||{}).length} enemies tracked</div>
        <div>${(mem.chain?.pace||[]).length} chain data points</div>
        <div>${(mem.war?.aggression||[]).length} war aggression samples</div>

        <div class="wnx-section-title" style="margin-top:14px;">Visual Intelligence</div>

        <div id="wnx-heatmap" style="height:
        <div id="wnx-heatmap" style="height:180px;margin-bottom:16px;background:#2D2D2D;
                                     border:1px solid #3E4042;"></div>

        <div id="wnx-strategy-chain-graph" style="height:180px;margin-bottom:16px;"></div>
        <div id="wnx-strategy-war-graph" style="height:180px;"></div>
    `;

    this.shadow.querySelector("#wnx-mode-off").onclick = () => {
        this.strategyMode = "OFFENSIVE";
        this.nexus.events.emit("SET_AI_MODE", "OFFENSIVE");
        this.renderStrategy();
    };

    this.shadow.querySelector("#wnx-mode-def").onclick = () => {
        this.strategyMode = "DEFENSIVE";
        this.nexus.events.emit("SET_AI_MODE", "DEFENSIVE");
        this.renderStrategy();
    };

    this.shadow.querySelector("#wnx-mode-hyb").onclick = () => {
        this.strategyMode = "HYBRID";
        this.nexus.events.emit("SET_AI_MODE", "HYBRID");
        this.renderStrategy();
    };
};

/* BLOCK: SETTINGS RENDER */

Major.renderSettings = function(){
    const p = this.shadow.querySelector("#p-settings");

    const det = this.detached ? "Yes" : "No";
    const pos = this.attachedSide;
    const scale = this.dataScale || 1;

    p.innerHTML = `
        <div class="wnx-section-title">Interface Settings</div>

        <div class="wnx-stats-row">
            ${this.smallStat("Detached", det)}
            ${this.smallStat("Side", pos)}
            ${this.smallStat("Scale", scale)}
        </div>

        <button id="wnx-set-detach" style="width:100%;margin-bottom:8px;">Toggle Detach</button>
        <button id="wnx-set-side" style="width:100%;margin-bottom:8px;">Toggle Left/Right</button>
        <button id="wnx-set-scale" style="width:100%;margin-bottom:8px;">Adjust Scale</button>
        <button id="wnx-reset-ai" style="width:100%;margin-bottom:8px;">Reset AI Memory (Local only)</button>
    `;

    this.shadow.querySelector("#wnx-set-detach").onclick = () => {
        this.toggleDetach();
        this.renderSettings();
    };

    this.shadow.querySelector("#wnx-set-side").onclick = () => {
        this.toggleSide();
        this.renderSettings();
    };

    this.shadow.querySelector("#wnx-set-scale").onclick = () => {
        this.adjustScale();
        this.renderSettings();
    };

    this.shadow.querySelector("#wnx-reset-ai").onclick = () => {
        localStorage.removeItem("WN_AI_HISTORY");
        this.nexus.log("AI memory cleared.");
        this.renderSettings();
    };
};

/* BLOCK: DETACH / SIDE / SCALE */

Major.toggleDetach = function(){
    this.detached = !this.detached;
    if (this.detached){
        this.drawer.style.position = "absolute";
        this.drawer.style.height = "600px";
        this.drawer.style.top = "80px";
        this.drawer.style.left = "60px";
    } else {
        this.drawer.style.position = "fixed";
        this.drawer.style.height = "100vh";
        this.drawer.style.top = "0";
        this.drawer.style.left = this.attachedSide === "left" ? "0" : "unset";
        this.drawer.style.right = this.attachedSide === "right" ? "0" : "unset";
    }
};

Major.toggleSide = function(){
    const side = this.attachedSide === "left" ? "right" : "left";
    this.attachedSide = side;

    if (!this.detached){
        if (side === "left"){
            this.drawer.style.left = "0";
            this.drawer.style.right = "unset";
        } else {
            this.drawer.style.left = "unset";
            this.drawer.style.right = "0";
        }
    }
};

Major.adjustScale = function(){
    if (!this.dataScale) this.dataScale = 1;
    this.dataScale += 0.1;
    if (this.dataScale > 1.5) this.dataScale = 1;

    this.drawer.style.transform = `scale(${this.dataScale})`;
    this.drawer.style.transformOrigin = "top left";
};

/* BLOCK: CHART.JS LOADER */

Major.ensureChart = function(cb){
    if (window.WNX_CHART_READY){
        cb();
        return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.onload = () => {
        window.WNX_CHART_READY = true;
        cb();
    };
    this.shadow.appendChild(script);
};

/* BLOCK: HEATMAP GENERATOR */

Major.renderHeatmap = function(){
    const container = this.shadow.querySelector("#wnx-heatmap");
    if (!container) return;

    const mem = this.data.aiMemory.enemy || {};
    const canvas = document.createElement("canvas");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.innerHTML = "";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    const enemies = Object.values(mem);
    if (!enemies.length){
        ctx.fillStyle = "#BEBEBE";
        ctx.fillText("No enemy activity data.", 10, 20);
        return;
    }

    const bins = new Array(24).fill(0);

    enemies.forEach(e => {
        if (!e.onlineTrend) return;
        e.onlineTrend.forEach(ts => {
            const d = new Date(ts);
            const h = d.getHours();
            bins[h] += 1;
        });
    });

    const max = Math.max(...bins, 1);
    const w = canvas.width / 24;

    bins.forEach((v, i) => {
        const intensity = v / max;
        let color;
        if (intensity < 0.25) color = "#3CCB5A";
        else if (intensity < 0.5) color = "#E5D543";
        else if (intensity < 0.75) color = "#E59F3B";
        else color = "#E55454";

        ctx.fillStyle = color;
        ctx.fillRect(i * w, 0, w - 2, canvas.height);

        ctx.fillStyle = "#222222";
        ctx.font = "10px Arial";
        ctx.fillText(i + ":00", i * w + 2, canvas.height - 4);
    });
};

/* BLOCK: CHAIN GRAPH */

Major.renderChainGraph = function(){
    this.ensureChart(() => {
        const container = this.shadow.querySelector("#wnx-strategy-chain-graph");
        if (!container) return;

        container.innerHTML = `<canvas></canvas>`;
        const canvas = container.querySelector("canvas");
        const ctx = canvas.getContext("2d");

        const mem = this.data.aiMemory.chain || {};
        const pace = mem.pace || [];

        if (!pace.length){
            ctx.fillStyle = "#BEBEBE";
            ctx.fillText("No chain pace data.", 10, 20);
            return;
        }

        const labels = pace.map(p => new Date(p.ts).toLocaleTimeString());
        const values = pace.map(p => p.hits);

        new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Chain Momentum",
                    data: values,
                    borderColor: "#48A9FF",
                    backgroundColor: "rgba(72,169,255,0.2)",
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { ticks: { color: "#F2F2F2" } },
                    y: { ticks: { color: "#F2F2F2" } }
                },
                plugins: {
                    legend: { labels: { color: "#F2F2F2" } }
                }
            }
        });
    });
};

/* BLOCK: WAR AGGRESSION GRAPH */

Major.renderWarGraph = function(){
    this.ensureChart(() => {
        const container = this.shadow.querySelector("#wnx-strategy-war-graph");
        if (!container) return;

        container.innerHTML = `<canvas></canvas>`;
        const canvas = container.querySelector("canvas");
        const ctx = canvas.getContext("2d");

        const mem = this.data.aiMemory.war || {};
        const ag = mem.aggression || [];

        if (!ag.length){
            ctx.fillStyle = "#BEBEBE";
            ctx.fillText("No war aggression data.", 10, 20);
            return;
        }

        const labels = ag.map(x => new Date(x.ts).toLocaleTimeString());
        const values = ag.map(x => {
            const st = (x.status || "").toLowerCase();
            if (st.includes("active")) return 3;
            if (st.includes("tense")) return 2;
            if (st.includes("alert")) return 1;
            return 0;
        });

        new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "War Aggression",
                    data: values,
                    backgroundColor: [
                        "#3CCB5A",
                        "#E5D543",
                        "#E59F3B",
                        "#E55454"
                    ]
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { ticks: { color: "#F2F2F2" } },
                    y: { ticks: { color: "#F2F2F2", stepSize: 1, max: 3 } }
                },
                plugins: {
                    legend: { labels: { color: "#F2F2F2" } }
                }
            }
        });
    });
};

/* BLOCK: STRATEGY TAB FINALIZATION */

Major.finalizeStrategy = function(){
    this.renderHeatmap();
    this.renderChainGraph();
    this.renderWarGraph();
};

/* BLOCK: RENDER HOOK OVERRIDE */

const oldRender = Major.renderActiveTab;
Major.renderActiveTab = function(){
    oldRender.call(this);
    if (this.activeTab === "strategy"){
        this.finalizeStrategy();
    }
};

/* BLOCK: REGISTRATION */

if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name: "Major",
    module: Major
});

})();
