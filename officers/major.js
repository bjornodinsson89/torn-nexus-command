// major.js — Full Command Console UI for Torn War Nexus

////////////////////////////////////////////////////////////
// MAJOR — FULL COMMAND CONSOLE UI
// Receives SITREP from Colonel via WAR_GENERAL.signals.
////////////////////////////////////////////////////////////

(function(){
"use strict";

class MajorUI {
    constructor() {
        this.general = null;
        this.host = null;
        this.shadow = null;

        this.activeTab = "overview";
        this.docked = true;
        this.dockSide = "left";
        this.detached = false;
        this.dragging = false;
        this.offsetX = 0;
        this.offsetY = 0;

        this.floatWidth = 380;
        this.floatHeight = 520;
        this.floatX = 40;
        this.floatY = 60;

        this.targetSubTab = "war"; // default to AI war targets

        this.store = {
            user: null,
            chain: null,
            faction: [],
            enemies: [],
            targets: { personal: [], war: [], shared: [] },
            ai: null
        };
    }

    // -------------------------------------------------------
    // INIT (called by General)
    // -------------------------------------------------------
    init(G) {
        this.general = G;
        this.createHost();
        this.renderBase();
        this.renderStyles();
        this.initEvents();
        this.bindSignals();
        this.setTab("overview");

        if (typeof WARDBG === "function") WARDBG("Major v8.1 online");
    }

    // -------------------------------------------------------
    // HOST + SHADOW
    // -------------------------------------------------------
    createHost() {
        if (document.getElementById("nexus-major-host")) return;

        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "2147483647";

        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    // -------------------------------------------------------
    // BASE MARKUP
    // -------------------------------------------------------
    renderBase() {
        this.shadow.innerHTML = `
            <div id="btn">N</div>

            <div id="panel">
                <div id="header">
                    <div id="drag-handle"></div>
                    <div id="title">WAR ROOM v8</div>
                </div>

                <div id="tabs">
                    <button data-tab="overview" class="on">OVERVIEW</button>
                    <button data-tab="faction">FACTION</button>
                    <button data-tab="enemy">ENEMY</button>
                    <button data-tab="war">WAR</button>
                    <button data-tab="chain">CHAIN</button>
                    <button data-tab="targets">TARGETS</button>
                    <button data-tab="ai">AI</button>
                    <button data-tab="settings">SETTINGS</button>
                </div>

                <div id="content">
                    <div class="tab-panel" id="t-overview"></div>
                    <div class="tab-panel" id="t-faction"></div>
                    <div class="tab-panel" id="t-enemy"></div>
                    <div class="tab-panel" id="t-war"></div>
                    <div class="tab-panel" id="t-chain"></div>
                    <div class="tab-panel" id="t-targets">
                        <div id="target-tabs">
                            <button data-ttab="personal">PERSONAL</button>
                            <button data-ttab="war" class="on">WAR</button>
                            <button data-ttab="shared">SHARED</button>
                        </div>
                        <div id="target-table"></div>
                    </div>
                    <div class="tab-panel" id="t-ai"></div>
                    <div class="tab-panel" id="t-settings">
                        <div class="section-title">Panel Position</div>
                        <button class="cfg" id="opt-dock-left">Dock Left</button>
                        <button class="cfg" id="opt-dock-right">Dock Right</button>
                        <button class="cfg" id="opt-detach">Detach / Float</button>
                        <button class="cfg" id="opt-attach">Attach</button>
                    </div>
                </div>
            </div>
        `;

        this.applyDockPosition();
    }

    // -------------------------------------------------------
    // STYLES
    // -------------------------------------------------------
    renderStyles() {
        const css = `
            :host { all: initial; }

            #btn {
                position: fixed;
                width: 48px;
                height: 48px;
                border: 2px solid #00f3ff;
                border-radius: 50%;
                background: rgba(0,0,0,0.8);
                bottom: 20px;
                left: 20px;
                color: #00f3ff;
                font-family: sans-serif;
                font-size: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
            }

            #panel {
                position: fixed;
                width: 380px;
                height: 60vh;
                background: #050505;
                border: 2px solid #00f3ff;
                border-radius: 12px;
                box-shadow: 0 0 12px #00f3ff;
                overflow: hidden;
                display: none;
            }

            #panel.on {
                display: block;
            }

            #header {
                height: 38px;
                background: #000;
                border-bottom: 1px solid #00f3ff;
                display: flex;
                align-items: center;
                padding: 0 10px;
                cursor: move;
            }

            #drag-handle {
                width: 16px;
                height: 16px;
                background: #00f3ff;
                border-radius: 50%;
                margin-right: 10px;
            }

            #title {
                color: #00f3ff;
                font-family: sans-serif;
                font-size: 15px;
            }

            #tabs {
                display: flex;
                border-bottom: 1px solid #00f3ff;
            }

            #tabs button {
                flex: 1;
                background: #000;
                color: #00f3ff;
                padding: 8px;
                border: none;
                cursor: pointer;
                font-size: 12px;
            }

            #tabs button.on {
                background: #00f3ff;
                color: #000;
            }

            #content {
                height: calc(60vh - 78px);
                overflow-y: auto;
                padding: 10px;
                color: #fff;
                font-family: sans-serif;
                font-size: 13px;
            }

            .tab-panel { display: none; }
            .tab-panel.on { display: block; }

            .metric-row { margin-bottom: 4px; }
            .metric-label { color:#00f3ff; }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            th, td {
                border-bottom: 1px solid #222;
                padding: 3px 4px;
            }
            th {
                background: #000;
                color: #00f3ff;
                position: sticky;
                top: 0;
                z-index: 1;
            }

            #target-tabs {
                display:flex;
                margin-bottom:6px;
            }
            #target-tabs button {
                flex:1;
                background:#000;
                color:#00f3ff;
                border:1px solid #00f3ff;
                margin-right:2px;
                padding:4px;
                cursor:pointer;
                font-size:11px;
            }
            #target-tabs button.on {
                background:#00f3ff;
                color:#000;
            }

            #ai-log {
                background:#000;
                border:1px solid #00f3ff;
                height:220px;
                overflow-y:auto;
                padding:6px;
                margin-bottom:6px;
                font-family:monospace;
                font-size:12px;
                color:#0ff;
            }
            .ai-msg { margin-bottom:4px; }
            .ai-msg.me { color:#fff; }

            #ai-input {
                width:100%;
                padding:6px;
                background:#000;
                border:1px solid #00f3ff;
                color:#00f3ff;
                font-size:13px;
            }

            .section-title {
                margin-bottom:4px;
                color:#00f3ff;
                font-weight:bold;
                font-size:13px;
            }
            .cfg {
                display:block;
                margin-bottom:6px;
                background:#000;
                color:#00f3ff;
                border:1px solid #00f3ff;
                padding:4px;
                width:100%;
                cursor:pointer;
            }
        `;

        const style = document.createElement("style");
        style.textContent = css;
        this.shadow.appendChild(style);
    }

    // -------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------
    initEvents() {
        const btn = this.shadow.getElementById("btn");
        const panel = this.shadow.getElementById("panel");

        btn.addEventListener("click", () => {
            panel.classList.toggle("on");
        });

        // Tab switching
        this.shadow.querySelectorAll("#tabs button").forEach(b => {
            b.addEventListener("click", () => {
                this.setTab(b.dataset.tab);
            });
        });

        // Target subtabs
        this.shadow.querySelectorAll("#target-tabs button").forEach(b => {
            b.addEventListener("click", () => {
                this.targetSubTab = b.dataset.ttab;
                this.shadow.querySelectorAll("#target-tabs button")
                    .forEach(x => x.classList.remove("on"));
                b.classList.add("on");
                this.renderTargets();
            });
        });

        // Draggable floating mode
        const header = this.shadow.getElementById("header");
        header.addEventListener("mousedown", e => this.startDrag(e));
        window.addEventListener("mousemove", e => this.onDrag(e));
        window.addEventListener("mouseup", () => this.endDrag());

        // Settings
        this.shadow.getElementById("opt-dock-left").onclick = () => {
            this.detached = false;
            this.docked = true;
            this.dockSide = "left";
            this.applyDockPosition();
        };
        this.shadow.getElementById("opt-dock-right").onclick = () => {
            this.detached = false;
            this.docked = true;
            this.dockSide = "right";
            this.applyDockPosition();
        };
        this.shadow.getElementById("opt-detach").onclick = () => {
            this.detached = true;
            this.docked = false;
            this.applyFloating();
        };
        this.shadow.getElementById("opt-attach").onclick = () => {
            this.detached = false;
            this.docked = true;
            this.applyDockPosition();
        };
    }

    // -------------------------------------------------------
    // SIGNALS (DATA)
    // -------------------------------------------------------
    bindSignals() {
        this.general.signals.listen("SITREP_UPDATE", data => {
            if (data.user) this.store.user = data.user;
            if (data.chain) this.store.chain = data.chain;
            if (data.factionMembers) this.store.faction = data.factionMembers;
            if (data.enemyFactionMembers) this.store.enemies = data.enemyFactionMembers;
            if (data.targets) this.store.targets = data.targets;
            if (data.ai) this.store.ai = data.ai;
            this.renderPanel();
        });

        this.general.signals.listen("SHARED_TARGETS_UPDATED", list => {
            this.store.targets.shared = list || [];
            if (this.activeTab === "targets") this.renderTargets();
        });

        this.general.signals.listen("ASK_COLONEL_RESPONSE", d => {
            const log = this.shadow.getElementById("ai-log");
            if (log && d.answer) {
                const div = document.createElement("div");
                div.className = "ai-msg";
                div.textContent = d.answer;
                log.appendChild(div);
                log.scrollTop = log.scrollHeight;
            }
        });
    }

    // -------------------------------------------------------
    // TAB SWITCHING
    // -------------------------------------------------------
    setTab(name) {
        this.activeTab = name;

        this.shadow.querySelectorAll("#tabs button")
            .forEach(b => b.classList.remove("on"));
        this.shadow.querySelector(`[data-tab="${name}"]`).classList.add("on");

        this.shadow.querySelectorAll(".tab-panel")
            .forEach(p => p.classList.remove("on"));
        const panel = this.shadow.getElementById(`t-${name}`);
        if (panel) panel.classList.add("on");

        this.renderPanel();
    }

    renderPanel() {
        if (this.activeTab === "overview") this.renderOverview();
        else if (this.activeTab === "faction") this.renderFaction();
        else if (this.activeTab === "enemy") this.renderEnemies();
        else if (this.activeTab === "war") this.renderWar();
        else if (this.activeTab === "chain") this.renderChain();
        else if (this.activeTab === "targets") this.renderTargets();
        else if (this.activeTab === "ai") this.renderAI();
    }

    // -------------------------------------------------------
    // POSITIONING
    // -------------------------------------------------------
    applyDockPosition() {
        const panel = this.shadow.getElementById("panel");
        if (!panel) return;

        panel.style.width = "380px";
        panel.style.height = "60vh";

        if (this.dockSide === "left") {
            panel.style.left = "0";
            panel.style.right = "";
        } else {
            panel.style.left = "";
            panel.style.right = "0";
        }

        panel.style.top = "20vh";
    }

    applyFloating() {
        const panel = this.shadow.getElementById("panel");
        if (!panel) return;

        panel.style.left = this.floatX + "px";
        panel.style.top = this.floatY + "px";
        panel.style.width = this.floatWidth + "px";
        panel.style.height = this.floatHeight + "px";
    }

    // -------------------------------------------------------
    // DRAG HANDLING (FLOAT MODE ONLY)
    // -------------------------------------------------------
    startDrag(e) {
        if (!this.detached) return;
        this.dragging = true;
        this.offsetX = e.clientX - this.floatX;
        this.offsetY = e.clientY - this.floatY;
    }

    onDrag(e) {
        if (!this.dragging) return;
        this.floatX = e.clientX - this.offsetX;
        this.floatY = e.clientY - this.offsetY;
        this.applyFloating();
    }

    endDrag() {
        this.dragging = false;
    }

    // -------------------------------------------------------
    // RENDERING HELPERS
    // -------------------------------------------------------
    renderOverview() {
        const p = this.shadow.getElementById("t-overview");
        const u = this.store.user;
        const c = this.store.chain;
        const a = this.store.ai;
        const f = this.store.faction;
        const e = this.store.enemies;

        if (!u || !c || !a) {
            p.textContent = "Waiting for intel...";
            return;
        }

        const onlineFaction = f.filter(m => m.online).length;
        const onlineEnemies = e.filter(m => m.online).length;

        p.innerHTML = `
            <div class="section-title">Operator</div>
            <div class="metric-row"><span class="metric-label">Name:</span> ${u.name} (Lv ${u.level})</div>
            <div class="metric-row"><span class="metric-label">Life:</span> ${u.hp}/${u.max_hp}</div>
            <div class="metric-row"><span class="metric-label">Status:</span> ${u.status}</div>

            <br>
            <div class="section-title">Chain</div>
            <div class="metric-row"><span class="metric-label">Hits:</span> ${c.hits}</div>
            <div class="metric-row"><span class="metric-label">Timeout:</span> ${c.timeLeft}s</div>

            <br>
            <div class="section-title">Factions</div>
            <div class="metric-row"><span class="metric-label">Allies Online:</span> ${onlineFaction}</div>
            <div class="metric-row"><span class="metric-label">Enemies Online:</span> ${onlineEnemies}</div>

            <br>
            <div class="section-title">AI Threat Model</div>
            <div class="metric-row"><span class="metric-label">Threat:</span> ${Math.round(a.threat*100)}%</div>
            <div class="metric-row"><span class="metric-label">Risk:</span> ${Math.round(a.risk*100)}%</div>
            <div class="metric-row"><span class="metric-label">Aggression:</span> ${Math.round(a.aggression*100)}%</div>
            <div class="metric-row"><span class="metric-label">Instability:</span> ${Math.round(a.instability*100)}%</div>
            <div class="metric-row"><span class="metric-label">Next Hit ETA:</span> ${a.prediction.nextHit}</div>
            <div class="metric-row"><span class="metric-label">Potential Drop:</span> ${a.prediction.drop}s</div>
            <br>
            <div class="metric-row"><span class="metric-label">Notes:</span><br>${a.notes.map(n => "• "+n).join("<br>")}</div>
        `;
    }

    renderFaction() {
        const p = this.shadow.getElementById("t-faction");
        const list = this.store.faction;

        if (!Array.isArray(list) || list.length === 0) {
            p.textContent = "No faction intel yet.";
            return;
        }

        p.innerHTML = `
            <table>
                <tr><th>Name</th><th>Lv</th><th>Status</th><th>Online</th><th>Last Action</th></tr>
                ${list.map(m => `
                    <tr>
                        <td>${m.name}</td>
                        <td>${m.level}</td>
                        <td>${m.status}</td>
                        <td>${m.online ? "🟢" : "⚫"}</td>
                        <td>${m.last_action || ""}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderEnemies() {
        const p = this.shadow.getElementById("t-enemy");
        const list = this.store.enemies;

        if (!Array.isArray(list) || list.length === 0) {
            p.textContent = "No enemy intel yet.";
            return;
        }

        p.innerHTML = `
            <table>
                <tr><th>Name</th><th>Lv</th><th>Status</th><th>Online</th><th>Score</th></tr>
                ${list.map(m => `
                    <tr>
                        <td>${m.name}</td>
                        <td>${m.level}</td>
                        <td>${m.status}</td>
                        <td>${m.online ? "🟢" : "⚫"}</td>
                        <td>${m.score}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderWar() {
        const p = this.shadow.getElementById("t-war");
        const e = this.store.enemies;
        const targets = this.store.targets.war || [];

        if (!this.store.ai) {
            p.textContent = "No war intel yet.";
            return;
        }

        p.innerHTML = `
            <div class="section-title">War Snapshot</div>
            <div class="metric-row"><span class="metric-label">Known enemy combatants:</span> ${e.length}</div>
            <div class="metric-row"><span class="metric-label">AI Threat:</span> ${Math.round(this.store.ai.threat*100)}%</div>
            <div class="metric-row"><span class="metric-label">Chain Hits:</span> ${(this.store.chain && this.store.chain.hits) || 0}</div>
            <br>
            <div class="section-title">AI Priority Targets</div>
        `;

        const best = (targets.length ? targets : e).slice(0, 15);

        p.innerHTML += `
            <table>
                <tr><th>Name</th><th>Lv</th><th>Status</th><th>Online</th><th>Score</th></tr>
                ${best.map(t => `
                    <tr>
                        <td><a href="https://www.torn.com/profiles.php?XID=${t.id}" target="_blank">${t.name}</a></td>
                        <td>${t.level}</td>
                        <td>${t.status}</td>
                        <td>${t.online ? "🟢" : "⚫"}</td>
                        <td>${t.score || 0}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderChain() {
        const p = this.shadow.getElementById("t-chain");
        const c = this.store.chain;

        if (!c) {
            p.textContent = "No chain intel yet.";
            return;
        }

        p.innerHTML = `
            <div class="section-title">Chain Status</div>
            <div class="metric-row"><span class="metric-label">Hits:</span> ${c.hits}</div>
            <div class="metric-row"><span class="metric-label">Timeout:</span> ${c.timeLeft}s</div>
        `;
    }

    renderTargets() {
        const container = this.shadow.getElementById("target-table");
        const tstore = this.store.targets || {};
        let list = [];

        if (this.targetSubTab === "personal") list = tstore.personal || [];
        else if (this.targetSubTab === "war") list = tstore.war && tstore.war.length ? tstore.war : this.store.enemies;
        else if (this.targetSubTab === "shared") list = tstore.shared || [];

        if (!list || list.length === 0) {
            container.textContent = "No targets available in this category.";
            return;
        }

        container.innerHTML = `
            <table>
                <tr><th>Name</th><th>Lv</th><th>Status</th><th>Online</th>${this.targetSubTab === "war" ? "<th>Score</th>" : ""}</tr>
                ${list.map(t => `
                    <tr>
                        <td><a href="https://www.torn.com/profiles.php?XID=${t.id}" target="_blank">${t.name}</a></td>
                        <td>${t.level || ""}</td>
                        <td>${t.status || ""}</td>
                        <td>${t.online ? "🟢" : "⚫"}</td>
                        ${this.targetSubTab === "war" ? `<td>${t.score || 0}</td>` : ""}
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderAI() {
        const p = this.shadow.getElementById("t-ai");
        p.innerHTML = `
            <div id="ai-log"></div>
            <input id="ai-input" placeholder="Ask the Colonel...">
        `;

        const input = this.shadow.getElementById("ai-input");
        const log = this.shadow.getElementById("ai-log");

        input.addEventListener("keydown", e => {
            if (e.key === "Enter" && input.value.trim()) {
                const q = input.value.trim();

                const div = document.createElement("div");
                div.className = "ai-msg me";
                div.textContent = "> " + q;
                log.appendChild(div);
                log.scrollTop = log.scrollHeight;

                this.general.signals.dispatch("ASK_COLONEL", { question: q });
                input.value = "";
            }
        });
    }
}

// -----------------------------------------------------------
// REGISTRATION
// -----------------------------------------------------------
function register() {
    if (window.WAR_GENERAL && WAR_GENERAL.register) {
        WAR_GENERAL.register("Major", new MajorUI());
        return true;
    }
    return false;
}

if (!register()) {
    let tries = 0;
    const timer = setInterval(() => {
        if (register() || ++tries > 20) clearInterval(timer);
    }, 200);
}

})();
