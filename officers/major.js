// major.js — Full Command Console UI for Torn War Nexus

////////////////////////////////////////////////////////////
// MAJOR — FULL COMMAND CONSOLE UI
// Runs in PAGE DOM, not iframe.
// Receives SITREP from Colonel via WAR_GENERAL.signals.
////////////////////////////////////////////////////////////

(function(){

//////////////////////////
// SAFE DEBUG WRAPPER   //
//////////////////////////

function dbg(msg){
    if (typeof window.WARDBG === "function") {
        window.WARDBG(msg);
    }
}

//////////////////////////
// STATE & DATA MODELS //
//////////////////////////

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
    }
}

/////////////////////////////////
// MAJOR UI ROOT + SHADOW DOM //
/////////////////////////////////

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

        // Hook into SITREP updates from Colonel (via WAR_GENERAL.signals)
        this.general.signals.listen("SITREP_UPDATE", d => {
            dbg("MajorUI: SITREP_UPDATE received");
            this.state.updateFromSitrep(d);
            this.renderAll();
        });
    }

    ///////////////////////////
    // FRAME + SHADOW SETUP  //
    ///////////////////////////

    initFrame(){
        const host = document.createElement("div");
        host.id = "nexus-major-root";
        host.style.position = "fixed";
        host.style.top = "0";
        host.style.left = "0";
        host.style.zIndex = "2147483647";
        host.style.pointerEvents = "none";

        this.shadow = host.attachShadow({ mode: "open" });
        document.body.appendChild(host);
    }

    /////////////////////////////////
    // BASE STRUCTURE + CSS THEMES //
    /////////////////////////////////

    renderBase(){
        this.shadow.innerHTML = `
            <style>
                :host {
                    all: initial;
                }

                #toggleBtn {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: #000;
                    color: #0ff;
                    border: 2px solid #0ff;
                    font-size: 14px;
                    font-family: monospace;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    pointer-events: auto;
                    box-shadow: 0 0 10px #0ff;
                }

                #panel {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 360px;
                    height: 100vh;
                    background: #000;
                    border-right: 2px solid #0ff;
                    transform: translateX(-100%);
                    transition: all 0.30s ease;
                    color: #0ff;
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
                    border-bottom: 1px solid #0ff;
                }

                .tabBtn {
                    flex: 1;
                    padding: 6px;
                    text-align: center;
                    cursor: pointer;
                    background: #000;
                    border-right: 1px solid #044;
                    color: #0ff;
                    font-size: 12px;
                }

                .tabBtn.active {
                    background: #033;
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
                    border: 1px solid #0ff;
                    padding: 6px;
                }

                canvas {
                    width: 100%;
                    height: 120px;
                    background: #111;
                    border: 1px solid #0ff;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    color: #0ff;
                }

                th, td {
                    border-bottom: 1px solid #044;
                    padding: 4px;
                    text-align: left;
                }

                .danger {
                    color: #f33;
                }

                .ok {
                    color: #3f3;
                }

                .warn {
                    color: #ff0;
                }

                .targetRow {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px;
                    border-bottom: 1px solid #044;
                }

                #addTargetBtn {
                    width: 100%;
                    padding: 6px;
                    margin-top: 8px;
                    background: #022;
                    border: 1px solid #0ff;
                    color: #0ff;
                    cursor: pointer;
                }
            </style>

            <div id="toggleBtn">WAR</div>

            <div id="panel">
                <div id="tabs">
                    <div class="tabBtn active" data-tab="overviewTab">Overview</div>
                    <div class="tabBtn" data-tab="enemyTab">Enemies</div>
                    <div class="tabBtn" data-tab="targetsTab">Targets</div>
                    <div class="tabBtn" data-tab="activityTab">Activity</div>
                </div>

                <div id="overviewTab" class="tabContent active"></div>
                <div id="enemyTab" class="tabContent"></div>
                <div id="targetsTab" class="tabContent"></div>
                <div id="activityTab" class="tabContent"></div>
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
        };
    }

    //////////////////////////
    // PANEL + TAB HANDLING //
    //////////////////////////

    attachEvents(){
        this.root.toggleBtn.addEventListener("click", () => {
            this.visible = !this.visible;
            this.root.panel.classList.toggle("visible", this.visible);
        });

        this.root.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                this.root.tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");

                const target = tab.dataset.tab;
                this.shadow.querySelectorAll(".tabContent").forEach(c => {
                    c.classList.remove("active");
                });
                this.shadow.querySelector("#" + target).classList.add("active");
            });
        });
    }

    ////////////////////////////////
    // RENDER ALL TAB CONTENTS    //
    ////////////////////////////////

    renderAll(){
        this.renderOverview();
        this.renderEnemy();
        this.renderTargets();
        this.renderActivity();
    }

    /////////////////////
    // OVERVIEW PANEL  //
    /////////////////////

    renderOverview(){
        const S = this.state;
        const div = this.root.overviewTab;

        if (!S.user) {
            div.innerHTML = "Awaiting intel…";
            return;
        }

        const th = Math.round((S.ai?.threat || 0) * 100);
        const rk = Math.round((S.ai?.risk || 0) * 100);
        const tm = Math.round((S.ai?.tempo || 0) * 100);
        const st = Math.round((S.ai?.instability || 0) * 100);

        const classThreat = th > 70 ? "danger" : th > 40 ? "warn" : "ok";
        const classRisk = rk > 60 ? "danger" : rk > 30 ? "warn" : "ok";

        div.innerHTML = `
            <div class="section">
                <b>Operator:</b> ${S.user.name} (Lv${S.user.level})<br>
                HP: ${S.user.hp}/${S.user.max_hp}<br>
            </div>

            <div class="section">
                <b>Chain:</b> ${S.chain.hits} hits<br>
                Time left: ${S.chain.timeLeft}s<br>
                Momentum: ${S.chain.momentum || 0}<br>
                Collapse Risk: ${S.chain.collapseRisk || 0}%<br>
            </div>

            <div class="section">
                <b>AI Threat:</b> <span class="${classThreat}">${th}%</span><br>
                <b>AI Risk:</b> <span class="${classRisk}">${rk}%</span><br>
                <b>Tempo:</b> ${tm}%<br>
                <b>Instability:</b> ${st}%<br>
            </div>
        `;
    }

    /////////////////////
    // ENEMY PANEL     //
    /////////////////////

    renderEnemy(){
        const S = this.state;
        const div = this.root.enemyTab;

        if (!S.enemyMembers || S.enemyMembers.length === 0){
            div.innerHTML = "No enemy intel yet.";
            return;
        }

        let rows = "";
        S.enemyMembers.forEach(m => {
            const idleMs = Date.now() - ((m.last_action || 0) * 1000);
            const online = idleMs < 600000;
            const cls = online ? "ok" : "danger";

            rows += `
                <tr>
                    <td>${m.name}</td>
                    <td>${m.level}</td>
                    <td class="${cls}">${online ? "ONLINE" : "OFFLINE"}</td>
                    <td>${m.status}</td>
                    <td>${Math.round((m.threat || 0)*100)}%</td>
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

    /////////////////////////////
    // SHARED TARGETS MANAGER  //
    /////////////////////////////

    renderTargets(){
        const S = this.state;
        const div = this.root.targetsTab;

        let targetsHTML = "";
        S.sharedTargets.forEach((t, idx) => {
            targetsHTML += `
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

            ${targetsHTML}

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
            const name = prompt("Target name:");
            if (!name) return;

            this.state.sharedTargets.push({ name });
            this.general.signals.dispatch("UPDATE_TARGETS", this.state.sharedTargets);
            this.renderTargets();
        });
    }

    /////////////////////////////
    // ACTIVITY GRAPH TAB      //
    /////////////////////////////

    renderActivity(){
        const S = this.state;
        const div = this.root.activityTab;

        if (!S.activityFriendly || S.activityFriendly.length === 0){
            div.innerHTML = "Collecting faction activity data…";
            return;
        }

        div.innerHTML = `
            <div class="section">
                <b>Faction Activity (Last 30 mins)</b><br>
                <canvas id="activityCanvas" width="320" height="120"></canvas>
            </div>
        `;

        const canvas = this.shadow.querySelector("#activityCanvas");
        this.drawActivityGraph(canvas, S.activityFriendly, S.activityEnemy);
    }

    ////////////////////////////////
    // CANVAS ACTIVITY GRAPH      //
    ////////////////////////////////

    drawActivityGraph(canvas, friendly, enemy){
        if (!canvas || !canvas.getContext) return;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#111";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        const maxVal = Math.max(
            1,
            ...friendly,
            ...enemy
        );

        const stepX = canvas.width / 30;

        // Friendly (Blue)
        ctx.strokeStyle = "#0af";
        ctx.beginPath();
        friendly.forEach((v,i)=>{
            const x = i * stepX;
            const y = canvas.height - (v/maxVal)*canvas.height;
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();

        // Enemy (Red)
        ctx.strokeStyle = "#f33";
        ctx.beginPath();
        enemy.forEach((v,i)=>{
            const x = i * stepX;
            const y = canvas.height - (v/maxVal)*canvas.height;
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();
    }
}

//////////////////////////
// BOOTSTRAP MAJOR UI  //
//////////////////////////

function bootWhenReady(){
    if (typeof window.WAR_GENERAL === "undefined" || !window.WAR_GENERAL.signals) {
        // WAR_GENERAL not ready yet — try again in 300ms
        setTimeout(bootWhenReady, 300);
        return;
    }

    dbg("MAJOR.JS INITIATED (WAR_GENERAL detected)");

    try {
        new MajorUI(window.WAR_GENERAL);
        dbg("MajorUI constructed successfully.");
    } catch (e){
        dbg("MajorUI construction error: " + e);
    }
}

// Kick off the wait loop
bootWhenReady();

})();
