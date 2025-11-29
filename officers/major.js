// major.js — Full Command Console UI for Torn War Nexus

////////////////////////////////////////////////////////////
// MAJOR — FULL COMMAND CONSOLE UI
// Receives SITREP from Colonel via WAR_GENERAL.signals.
////////////////////////////////////////////////////////////

(function(){

function dbg(msg){
    if (typeof window.WARDBG === "function"){
        window.WARDBG(msg);
    }
}

class MajorState {
    constructor(){
        this.user = null;
        this.chain = { hits:0, timeLeft:0, momentum:0, collapseRisk:0 };
        this.friendlyFaction = null;
        this.enemyFaction = null;
        this.enemyMembers = [];
       	this.friendlyMembers = [];
        this.ai = { threat:0, risk:0, tempo:0, instability:0 };
        this.sharedTargets = [];
        this.activityFriendly = Array(30).fill(0);
        this.activityEnemy = Array(30).fill(0);
        this.intelLog = [];
        this.strategy = "";
        this.forecast = {
            enemySurge: 0,
            collapseProb: 0,
            peakWindow: "Unknown",
            enemyShift: [],
        };
        this.matrix = {
            enemies: [],
            statsReady: false
        };
    }

    updateFromSitrep(s){
        if (s.user) this.user = s.user;
        if (s.chain) this.chain = s.chain;
        if (s.friendlyFaction) this.friendlyFaction = s.friendlyFaction;
        if (s.enemyFaction) this.enemyFaction = s.enemyFaction;
        if (Array.isArray(s.enemyMembers)) this.enemyMembers = s.enemyMembers;
        if (Array.isArray(s.friendlyMembers)) this.friendlyMembers = s.friendlyMembers;
        if (s.ai) this.ai = s.ai;
        if (Array.isArray(s.sharedTargets)) this.sharedTargets = s.sharedTargets;
        if (Array.isArray(s.activityFriendly)) this.activityFriendly = s.activityFriendly;
        if (Array.isArray(s.activityEnemy)) this.activityEnemy = s.activityEnemy;

        const ts = Date.now();
        this.intelLog.push({
            timestamp: ts,
            chain: this.chain.hits,
            threat: this.ai.threat || 0,
            risk: this.ai.risk || 0,
            onlineEnemy: this.enemyMembers.filter(m=>m.online).length
        });
        if (this.intelLog.length > 200) this.intelLog.shift();

        this.computeStrategySummary();
        this.computeForecast();
        this.computeThreatMatrix();
    }

    computeStrategySummary(){
        const t = this.ai.threat || 0;
        const r = this.ai.risk || 0;
        const c = this.chain.collapseRisk || 0;
        let summary = "";

        if (t > 0.75 && r > 0.75){
            summary = "ENEMY DOMINANT — Defensive posture advised.";
        } else if (t > 0.7 && c > 60){
            summary = "CHAIN AT RISK — Consider controlled resets.";
        } else if (t < 0.4 && r < 0.4){
            summary = "FAVORABLE CONDITIONS — Optimal attack window.";
        } else if (t < 0.3 && c < 30){
            summary = "ENEMY WEAK — Exploit vulnerability.";
        } else {
            summary = "NEUTRAL CONDITIONS — Maintain tempo.";
        }

        this.strategy = summary;
    }

    computeForecast(){
        const online30 = this.activityEnemy.slice(-30);
        const recent = this.activityEnemy.slice(-5);
        const old = this.activityEnemy.slice(-15, -10);

        let surge = 0;
        if (recent.length >= 3 && old.length >= 3){
            const rAvg = recent.reduce((a,b)=>a+b,0)/recent.length;
            const oAvg = old.reduce((a,b)=>a+b,0)/old.length;
            surge = Math.max(0, Math.min(1, (rAvg - oAvg) / 10));
        }

        const collapseProb = Math.min(1, (this.chain.collapseRisk || 0) / 100);

        const windows = [];
        for (let i=0; i<online30.length; i++){
            windows.push({ idx:i, val:online30[i] });
        }
        windows.sort((a,b)=>a.val - b.val);
        const peakIdx = windows.length > 0 ? windows[windows.length-1].idx : 0;

        const onlineDiff = [];
        for (let i=1; i<online30.length; i++){
            onlineDiff.push(online30[i] - online30[i-1]);
        }

        this.forecast = {
            enemySurge: surge,
            collapseProb,
            peakWindow: `T-${30 - peakIdx}m`,
            enemyShift: onlineDiff
        };
    }

    computeThreatMatrix(){
        if (!this.enemyMembers || this.enemyMembers.length === 0){
            this.matrix = { enemies:[], statsReady:false };
            return;
        }

        const list = this.enemyMembers.map(m=>{
            const last = m.last_action || 0;
            const idle = Date.now() - last;
            const online = idle < 600000 ? 1 : 0;
            const threat = m.threat || 0;
            const level = m.level || 0;
            const combined = Math.min(1, (0.5*threat) + (0.3*(level/100)) + (0.2*online));

            return {
                id: m.id,
                name: m.name,
                level: level,
                threat: threat,
                combined: combined,
                online: online === 1
            };
        });

        list.sort((a,b)=>b.combined - a.combined);

        this.matrix = {
            enemies: list,
            statsReady: true
        };
    }
}

class MajorUI {
    constructor(general){
        this.general = general;
        this.state = new MajorState();
        this.visible = false;
        this.shadow = null;
        this.root = null;

        this.initFrame();
        this.renderBase();
        this.cacheRoots();
        this.attachEvents();
        this.registerSitrepListener();

        dbg("MajorUI constructed (War Dashboard Style C)");
    }

    initFrame(){
        const host = document.createElement("div");
        host.id = "nexus-major-root";
        host.style.position = "fixed";
        host.style.top = "0";
        host.style.left = "0";
        host.style.zIndex = "2147483647";
        host.style.pointerEvents = "none";

        this.shadow = host.attachShadow({ mode:"open" });
        document.body.appendChild(host);
    }

    renderBase(){
        this.shadow.innerHTML = `
            <style>
                :host { all: initial; }

                #toggleBtn {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 65px;
                    height: 65px;
                    border-radius: 50%;
                    background: #001017;
                    color: #00ffff;
                    border: 2px solid #00cccc;
                    font-size: 14px;
                    font-family: monospace;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    pointer-events: auto;
                    box-shadow: 0 0 12px #00ffff;
                    transition: transform 0.2s ease;
                }

                #toggleBtn:hover {
                    transform: scale(1.08);
                }

                #panel {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 420px;
                    height: 100vh;
                    background: #000000;
                    border-right: 2px solid #00ffff;
                    transform: translateX(-100%);
                    transition: all 0.30s ease;
                    color: #00ffff;
                    font-family: monospace;
                    pointer-events: auto;
                    overflow-y: auto;
                    padding-bottom: 40px;
                }

                #panel.visible {
                    transform: translateX(0);
                }

                #tabs {
                    display: flex;
                    border-bottom: 1px solid #00cccc;
                }

                .tabBtn {
                    flex: 1;
                    padding: 8px;
                    text-align: center;
                    cursor: pointer;
                    background: #000;
                    border-right: 1px solid #003344;
                    color: #00ffff;
                    font-size: 12px;
                }

                .tabBtn.active {
                    background: #002833;
                    font-weight: bold;
                }

                .tabContent {
                    display: none;
                    padding: 10px;
                }

                .tabContent.active {
                    display: block;
                }

                .section {
                    margin-bottom: 12px;
                    border: 1px solid #00cccc;
                    padding: 6px;
                    background: #000910;
                }

                canvas {
                    width: 100%;
                    height: 140px;
                    background: #000;
                    border: 1px solid #00cccc;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    color: #00ffff;
                }

                th, td {
                    border-bottom: 1px solid #003344;
                    padding: 4px;
                    text-align: left;
                }

                .ok { color: #00ff66; }
                .danger { color: #ff0033; }
                .warn { color: #ffcc00; }

                .matrix-row {
                    display:flex;
                    justify-content:space-between;
                    border-bottom:1px solid #003344;
                    padding:4px;
                }

                .intelLogEntry {
                    border-bottom: 1px dashed #003344;
                    padding: 4px;
                    font-size: 11px;
                }

                .targetRow {
                    display:flex;
                    justify-content:space-between;
                    padding:4px;
                    border-bottom:1px solid #003344;
                }

                #addTargetBtn {
                    width:100%;
                    padding:6px;
                    margin-top:8px;
                    background:#001822;
                    border:1px solid #00cccc;
                    color:#00ffff;
                    cursor:pointer;
                }

                #intelTerminal {
                    width:100%;
                    height:200px;
                    background:#000;
                    border:1px solid #00cccc;
                    color:#00ff99;
                    font-size:11px;
                    overflow-y:auto;
                    padding:6px;
                    font-family:monospace;
                }
            </style>

            <div id="toggleBtn">WAR</div>

            <div id="panel">
                <div id="tabs">
                    <div class="tabBtn active" data-tab="overviewTab">Overview</div>
                    <div class="tabBtn" data-tab="enemyTab">Enemies</div>
                    <div class="tabBtn" data-tab="targetsTab">Targets</div>
                    <div class="tabBtn" data-tab="activityTab">Activity</div>
                    <div class="tabBtn" data-tab="matrixTab">Matrix</div>
                    <div class="tabBtn" data-tab="terminalTab">Terminal</div>
                </div>

                <div id="overviewTab" class="tabContent active"></div>
                <div id="enemyTab" class="tabContent"></div>
                <div id="targetsTab" class="tabContent"></div>
                <div id="activityTab" class="tabContent"></div>
                <div id="matrixTab" class="tabContent"></div>
                <div id="terminalTab" class="tabContent"></div>
            </div>
        `;
    }

    cacheRoots(){
        this.root = {
            toggleBtn: this.shadow.querySelector("#toggleBtn"),
            panel: this.shadow.querySelector("#panel"),
            tabs: this.shadow.querySelectorAll(".tabBtn"),
            overviewTab: this.shadow.querySelector("#overviewTab"),
            enemyTab: this.shadow.querySelector("#enemyTab"),
            targetsTab: this.shadow.querySelector("#targetsTab"),
            activityTab: this.shadow.querySelector("#activityTab"),
            matrixTab: this.shadow.querySelector("#matrixTab"),
            terminalTab: this.shadow.querySelector("#terminalTab")
        };
    }

    attachEvents(){
        this.root.toggleBtn.addEventListener("click", () => {
            this.visible = !this.visible;
            this.root.panel.classList.toggle("visible", this.visible);
        });

        this.root.tabs.forEach(tab=>{
            tab.addEventListener("click",()=>{
                this.root.tabs.forEach(t=>t.classList.remove("active"));
                tab.classList.add("active");

                const target = tab.dataset.tab;
                this.shadow.querySelectorAll(".tabContent").forEach(c=>{
                    c.classList.remove("active");
                });
                this.shadow.querySelector("#" + target).classList.add("active");
            });
        });
    }

    registerSitrepListener(){
        this.general.signals.listen("SITREP_UPDATE", d => {
            dbg("MajorUI received SITREP_UPDATE");
            this.state.updateFromSitrep(d);
            this.renderAll();
        });
    }

    renderAll(){
        this.renderOverview();
        this.renderEnemy();
        this.renderTargets();
        this.renderActivity();
        this.renderMatrix();
        this.renderTerminal();
    }

    renderOverview(){
        const S = this.state;
        const div = this.root.overviewTab;

        if (!S.user){
            div.innerHTML = `
                <div class="section">
                    Awaiting intel…
                </div>
            `;
            return;
        }

        const t = Math.round((S.ai.threat||0)*100);
        const r = Math.round((S.ai.risk||0)*100);
        const tm = Math.round((S.ai.tempo||0)*100);
        const inst = Math.round((S.ai.instability||0)*100);

        const classT = t>70?"danger":t>40?"warn":"ok";
        const classR = r>60?"danger":r>30?"warn":"ok";

        div.innerHTML = `
            <div class="section">
                <b>Operator:</b> ${S.user.name} (Lv${S.user.level})<br>
                HP: ${S.user.hp}/${S.user.max_hp}<br>
            </div>

            <div class="section">
                <b>Chain:</b><br>
                Hits: ${S.chain.hits}<br>
                Time left: ${S.chain.timeLeft}s<br>
                Momentum: ${S.chain.momentum}<br>
                Collapse Risk: ${S.chain.collapseRisk}%<br>
            </div>

            <div class="section">
                <b>AI Threat:</b> <span class="${classT}">${t}%</span><br>
                <b>AI Risk:</b> <span class="${classR}">${r}%</span><br>
                Tempo: ${tm}%<br>
                Instability: ${inst}%<br>
            </div>

            <div class="section">
                <b>Strategy:</b><br>
                ${S.strategy}
            </div>

            <div class="section">
                <b>Forecast:</b><br>
                Enemy Surge: ${Math.round(S.forecast.enemySurge*100)}%<br>
                Collapse Prob: ${Math.round(S.forecast.collapseProb*100)}%<br>
                Peak Activity Window: ${S.forecast.peakWindow}<br>
            </div>
        `;
    }

    renderEnemy(){
        const S = this.state;
        const div = this.root.enemyTab;

        if (!S.enemyMembers || S.enemyMembers.length === 0){
            div.innerHTML = "<div class='section'>No enemy intel.</div>";
            return;
        }

        let rows = "";

        S.enemyMembers.forEach(m=>{
            const idleMs = Date.now() - (m.last_action || 0);
            const online = idleMs < 600000;
            const cls = online ? "ok" : "danger";

            rows += `
                <tr>
                    <td>${m.name}</td>
                    <td>${m.level}</td>
                    <td class="${cls}">${online ? "ONLINE" : "OFFLINE"}</td>
                    <td>${m.status}</td>
                    <td>${Math.round((m.threat||0)*100)}%</td>
                </tr>
            `;
        });

        div.innerHTML = `
            <div class="section">
                <b>Enemy Faction:</b> ${S.enemyFaction?.name || "Unknown"}<br>
                Members: ${S.enemyMembers.length}
            </div>

            <table>
                <tr>
                    <th>Name</th>
                    <th>Lvl</th>
                    <th>Status</th>
                    <th>State</th>
                    <th>Threat</th>
                </tr>
                ${rows}
            </table>
        `;
    }

    renderTargets(){
        const S = this.state;
        const div = this.root.targetsTab;

        let targets = "";
        S.sharedTargets.forEach((t,idx)=>{
            targets += `
                <div class="targetRow">
                    <span>${t.name}</span>
                    <button data-idx="${idx}" class="delTargetBtn">X</button>
                </div>
            `;
        });

        div.innerHTML = `
            <div class="section">
                <b>Shared Targets (${S.sharedTargets.length})</b>
            </div>

            ${targets}

            <button id="addTargetBtn">Add Target</button>
        `;

        div.querySelectorAll(".delTargetBtn").forEach(btn=>{
            btn.addEventListener("click",()=>{
                const idx = parseInt(btn.dataset.idx,10);
                this.state.sharedTargets.splice(idx,1);
                this.general.signals.dispatch("UPDATE_TARGETS", this.state.sharedTargets);
                this.renderTargets();
            });
        });

        div.querySelector("#addTargetBtn").addEventListener("click",()=>{
            const name = prompt("Enter target name:");
            if (!name) return;

            this.state.sharedTargets.push({name});
            this.general.signals.dispatch("UPDATE_TARGETS", this.state.sharedTargets);
            this.renderTargets();
        });
    }

    renderActivity(){
        const S = this.state;
        const div = this.root.activityTab;

        div.innerHTML = `
            <div class="section">
                <b>Faction Activity (30m)</b><br>
                <canvas id="activityCanvas" width="360" height="140"></canvas>
            </div>

            <div class="section">
                <b>Enemy Surge Pattern</b><br>
                <canvas id="surgeCanvas" width="360" height="100"></canvas>
            </div>
        `;

        const c1 = this.shadow.querySelector("#activityCanvas");
        const c2 = this.shadow.querySelector("#surgeCanvas");

        this.drawActivityGraph(c1, S.activityFriendly, S.activityEnemy);
        this.drawSurgeGraph(c2, S.forecast.enemyShift);
    }

    drawActivityGraph(canvas, friendly, enemy){
        if (!canvas || !canvas.getContext) return;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#000";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        const maxVal = Math.max(1, ...friendly, ...enemy);
        const step = canvas.width / 30;

        ctx.strokeStyle = "#00aaff";
        ctx.beginPath();
        friendly.forEach((v,i)=>{
            const x = i * step;
            const y = canvas.height - (v/maxVal)*canvas.height;
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();

        ctx.strokeStyle = "#ff3355";
        ctx.beginPath();
        enemy.forEach((v,i)=>{
            const x = i * step;
            const y = canvas.height - (v/maxVal)*canvas.height;
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();
    }

    drawSurgeGraph(canvas, shift){
        if (!canvas || !canvas.getContext) return;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#000";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        if (!shift || shift.length === 0) return;

        const maxVal = Math.max(1, ...shift.map(x=>Math.abs(x)));
        const step = canvas.width / shift.length;

        ctx.strokeStyle = "#ffaa00";
        ctx.beginPath();
        shift.forEach((v,i)=>{
            const x = i * step;
            const y = canvas.height/2 - (v/maxVal)*(canvas.height/2);
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();

        ctx.strokeStyle = "#003344";
        ctx.beginPath();
        ctx.moveTo(0,canvas.height/2);
        ctx.lineTo(canvas.width,canvas.height/2);
        ctx.stroke();
    }

    renderMatrix(){
        const S = this.state;
        const div = this.root.matrixTab;

        if (!S.matrix.statsReady){
            div.innerHTML = "<div class='section'>No enemy threat data yet.</div>";
            return;
        }

        let rows = "";
        S.matrix.enemies.forEach(m=>{
            const cls = m.online ? "ok" : "danger";
            rows += `
                <div class="matrix-row">
                    <span>${m.name} (Lv${m.level})</span>
                    <span class="${cls}">${Math.round(m.combined*100)}%</span>
                </div>
            `;
        });

        div.innerHTML = `
            <div class="section">
                <b>Threat Matrix</b><br>
                Combined threat based on level, AI threat score, and online activity.
            </div>

            <div class="section">
                ${rows}
            </div>
        `;
    }

    renderTerminal(){
        const S = this.state;
        const div = this.root.terminalTab;

        let logHTML = "";
        S.intelLog.forEach(entry=>{
            const t = new Date(entry.timestamp).toLocaleTimeString();
            logHTML += `
                <div class="intelLogEntry">
                    [${t}] Chain: ${entry.chain} | Threat: ${Math.round(entry.threat*100)}% | Risk: ${Math.round(entry.risk*100)}% | Enemy Online: ${entry.onlineEnemy}
                </div>
            `;
        });

        div.innerHTML = `
            <div class="section">
                <b>Intel Terminal</b><br>
                Real-time logs from the Army Intelligence Network.
            </div>

            <div id="intelTerminal">${logHTML}</div>
        `;
    }
}

function bootWhenReady(){
    if (typeof window.WAR_GENERAL === "undefined" || !window.WAR_GENERAL.signals){
        setTimeout(bootWhenReady, 200);
        return;
    }

    dbg("Major.js initializing…");

    try {
        new MajorUI(window.WAR_GENERAL);
        dbg("MajorUI launched.");
    } catch(e){
        dbg("Major init error: " + e);
    }
}

bootWhenReady();

})();
