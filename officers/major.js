// major.js — Full Command Console UI for Torn War Nexus

////////////////////////////////////////////////////////////
// MAJOR — FULL COMMAND CONSOLE UI
// Receives SITREP from Colonel via WAR_GENERAL.signals.
////////////////////////////////////////////////////////////

(function(){
"use strict";

const Major = {
    nexus: null,
    host: null,
    shadow: null,
    uiState: {
        attached: true,
        side: "left",
        detached: false,
        activeTab: "overview",
        position: { x: 80, y: 120 },
        size: { w: 420, h: 560 },
        dragging: false,
        offset: { x: 0, y: 0 }
    },
    store: {
        overview: {},
        faction: [],
        enemies: [],
        war: {},
        chain: {},
        targets: { personal: [], shared: [], war: [] },
        ai: {}
    },
    init(nexus) {
        this.nexus = nexus;
        this.store.targets.personal = [];
        this.createHost();
        this.buildUI();
        this.applyPosition();
        this.attachEvents();
        this.subscribe();
        this.render();
    },
    createHost() {
        this.host = document.createElement("div");
        this.host.id = "twn-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "2147483646";
        document.body.appendChild(this.host);
        this.shadow = this.host.attachShadow({ mode: "closed" });
    },
    buildUI() {
        const base = document.createElement("div");
        base.id = "panel";
        base.innerHTML = `
            <div id="toggle">NEXUS</div>
            <div id="window" class="hidden">
                <div id="header">
                    <div id="drag"></div>
                    <span id="title">WAR ROOM</span>
                </div>
                <div id="tabs">
                    <button data-tab="overview">Overview</button>
                    <button data-tab="faction">Faction</button>
                    <button data-tab="enemies">Enemies</button>
                    <button data-tab="war">War</button>
                    <button data-tab="chain">Chain</button>
                    <button data-tab="targets">Targets</button>
                    <button data-tab="ai">AI</button>
                    <button data-tab="settings">Settings</button>
                </div>
                <div id="content">
                    <div class="tab" id="tab-overview"></div>
                    <div class="tab" id="tab-faction"></div>
                    <div class="tab" id="tab-enemies"></div>
                    <div class="tab" id="tab-war"></div>
                    <div class="tab" id="tab-chain"></div>
                    <div class="tab" id="tab-targets"></div>
                    <div class="tab" id="tab-ai"></div>
                    <div class="tab" id="tab-settings"></div>
                </div>
            </div>
        `;
        const style = document.createElement("style");
        style.textContent = `
            #panel {
                position: relative;
                font-family: Verdana, Arial, sans-serif;
            }
            #toggle {
                position: fixed;
                bottom: 24px;
                left: 24px;
                background: #1e1e1e;
                border: 1px solid #2a2a2a;
                padding: 10px 16px;
                color: #dedede;
                font-size: 13px;
                cursor: pointer;
                border-radius: 3px;
                box-shadow: 0 0 6px rgba(0,0,0,0.5);
                user-select: none;
            }
            #window {
                position: fixed;
                background: #1e1e1e;
                border: 1px solid #2a2a2a;
                color: #dedede;
                border-radius: 3px;
                box-shadow: 0 0 14px rgba(0,0,0,0.55);
                overflow: hidden;
            }
            #window.hidden {
                display: none;
            }
            #header {
                height: 36px;
                background: #262626;
                border-bottom: 1px solid #2a2a2a;
                display: flex;
                align-items: center;
                padding: 0 10px;
                cursor: move;
            }
            #drag {
                width: 12px;
                height: 12px;
                background: #48a9ff;
                border-radius: 50%;
                margin-right: 10px;
            }
            #title {
                font-size: 14px;
                font-weight: bold;
                color: #f0f0f0;
            }
            #tabs {
                display: flex;
                border-bottom: 1px solid #2a2a2a;
                background: #1c1c1c;
            }
            #tabs button {
                flex: 1;
                background: none;
                border: none;
                color: #dedede;
                padding: 8px 4px;
                cursor: pointer;
                font-size: 12px;
                outline: none;
            }
            #tabs button.active {
                border-bottom: 2px solid #48a9ff;
                color: #48a9ff;
            }
            #content {
                padding: 10px;
                height: calc(100% - 80px);
                overflow-y: auto;
                font-size: 12px;
            }
            .tab {
                display: none;
                color: #dedede;
            }
            .tab.active {
                display: block;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
            }
            th, td {
                border: 1px solid #2a2a2a;
                padding: 6px;
                text-align: left;
                font-size: 12px;
            }
            th {
                background: #262626;
                color: #f0f0f0;
            }
        `;
        this.shadow.appendChild(style);
        this.shadow.appendChild(base);
    },
    attachEvents() {
        const win = this.shadow.querySelector("#window");
        const toggle = this.shadow.querySelector("#toggle");
        const tabs = this.shadow.querySelectorAll("#tabs button");
        const header = this.shadow.querySelector("#header");

        toggle.addEventListener("click", () => {
            win.classList.toggle("hidden");
        });

        tabs.forEach(btn => {
            btn.addEventListener("click", () => {
                this.uiState.activeTab = btn.dataset.tab;
                this.renderTabs();
            });
        });

        header.addEventListener("mousedown", e => {
            if (!this.uiState.detached) return;
            this.uiState.dragging = true;
            this.uiState.offset.x = e.clientX - this.uiState.position.x;
            this.uiState.offset.y = e.clientY - this.uiState.position.y;
        });

        window.addEventListener("mousemove", e => {
            if (!this.uiState.dragging) return;
            this.uiState.position.x = e.clientX - this.uiState.offset.x;
            this.uiState.position.y = e.clientY - this.uiState.offset.y;
            this.applyPosition();
        });

        window.addEventListener("mouseup", () => {
            this.uiState.dragging = false;
        });
    },
    subscribe() {
        this.nexus.events.on("RAW_INTEL", intel => {
            if (intel.user) this.store.overview = intel.user;
            if (intel.faction?.members) this.store.faction = Object.values(intel.faction.members);
            if (intel.enemies && intel.enemies.length > 0) {
                this.store.enemies = intel.enemies[0].members ? Object.values(intel.enemies[0].members) : [];
                this.store.war = intel.enemies[0];
            }
            if (intel.chain) this.store.chain = intel.chain;
            if (intel.targets) this.store.targets = intel.targets;
            if (intel.ai) this.store.ai = intel.ai;
            this.render();
        });
        this.nexus.events.on("SHARED_TARGETS_UPDATED", list => {
            this.store.targets.shared = list || [];
            if (this.uiState.activeTab === "targets") this.renderTargets();
        });
        this.nexus.events.on("COLONEL_RESPONSE", data => {
            const el = this.shadow.querySelector("#tab-ai");
            if (!el) return;
            const div = document.createElement("div");
            div.textContent = data.response;
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
        });
    },
    applyPosition() {
        const win = this.shadow.querySelector("#window");
        win.style.width = this.uiState.size.w + "px";
        win.style.height = this.uiState.size.h + "px";
        if (this.uiState.detached) {
            win.style.left = this.uiState.position.x + "px";
            win.style.top = this.uiState.position.y + "px";
        } else {
            win.style.left = this.uiState.side === "left" ? "12px" : "";
            win.style.right = this.uiState.side === "right" ? "12px" : "";
            win.style.top = "80px";
        }
    },
    renderTabs() {
        const tabs = this.shadow.querySelectorAll("#tabs button");
        const panels = this.shadow.querySelectorAll(".tab");
        tabs.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === this.uiState.activeTab);
        });
        panels.forEach(panel => {
            panel.classList.toggle("active", panel.id === "tab-" + this.uiState.activeTab);
        });
    },
    render() {
        this.renderTabs();
        this.renderOverview();
        this.renderFaction();
        this.renderEnemies();
        this.renderWar();
        this.renderChain();
        this.renderTargets();
        this.renderAI();
        this.renderSettings();
    },
    renderOverview() {
        const el = this.shadow.querySelector("#tab-overview");
        const u = this.store.overview;
        if (!u || !u.name) {
            el.innerHTML = "Waiting for intel...";
            return;
        }
        el.innerHTML = `
            <h3>Operator</h3>
            <p>Name: ${u.name}</p>
            <p>Level: ${u.level}</p>
            <p>Status: ${u.status}</p>
            <p>Life: ${u.hp}/${u.max_hp}</p>
        `;
    },
    renderFaction() {
        const el = this.shadow.querySelector("#tab-faction");
        const list = this.store.faction;
        if (!list || list.length === 0) {
            el.innerHTML = "No faction data.";
            return;
        }
        let rows = "";
        for (const m of list) {
            rows += `
                <tr>
                    <td>${m.name}</td>
                    <td>${m.level}</td>
                    <td>${m.status}</td>
                    <td>${m.last_action?.relative || "-"}</td>
                </tr>
            `;
        }
        el.innerHTML = `
            <table>
                <tr><th>Name</th><th>Lvl</th><th>Status</th><th>Last Action</th></tr>
                ${rows}
            </table>
        `;
    },
    renderEnemies() {
        const el = this.shadow.querySelector("#tab-enemies");
        const list = this.store.enemies;
        if (!list || list.length === 0) {
            el.innerHTML = "No enemy roster available.";
            return;
        }
        let rows = "";
        for (const m of list) {
            rows += `
                <tr>
                    <td>${m.name}</td>
                    <td>${m.level}</td>
                    <td>${m.status}</td>
                    <td>${m.score || "-"}</td>
                </tr>
            `;
        }
        el.innerHTML = `
            <table>
                <tr><th>Name</th><th>Lvl</th><th>Status</th><th>Score</th></tr>
                ${rows}
            </table>
        `;
    },
    renderWar() {
        const el = this.shadow.querySelector("#tab-war");
        const w = this.store.war;
        if (!w || !w.members) {
            el.innerHTML = "No war data.";
            return;
        }
        el.innerHTML = `
            <h3>Enemy Faction</h3>
            <p>ID: ${w.id}</p>
            <p>Name: ${w.name || "Unknown"}</p>
        `;
    },
    renderChain() {
        const el = this.shadow.querySelector("#tab-chain");
        const c = this.store.chain;
        if (!c || typeof c.hits === "undefined") {
            el.innerHTML = "No chain data.";
            return;
        }
        el.innerHTML = `
            <p>Hits: ${c.hits}</p>
            <p>Timeout: ${c.timeout}</p>
            <p>Cooldown: ${c.cooldown}</p>
        `;
    },
    renderTargets() {
        const el = this.shadow.querySelector("#tab-targets");
        const t = this.store.targets.shared || [];
        if (t.length === 0) {
            el.innerHTML = "No shared targets.";
            return;
        }
        let rows = "";
        for (const target of t) {
            rows += `
                <tr>
                    <td>${target.name}</td>
                    <td>${target.level || "-"}</td>
                    <td>${target.status || "-"}</td>
                </tr>
            `;
        }
        el.innerHTML = `
            <table>
                <tr><th>Name</th><th>Lvl</th><th>Status</th></tr>
                ${rows}
            </table>
        `;
    },
    renderAI() {
        const el = this.shadow.querySelector("#tab-ai");
        el.innerHTML = `
            <div id="ai-log" style="max-height:220px; overflow-y:auto; margin-bottom:8px;"></div>
            <input id="ai-input" type="text" placeholder="Ask the Colonel..." style="width:100%; padding:6px; box-sizing:border-box; background:#141414; border:1px solid #3a3a3a; color:#eee;">
        `;
        const input = el.querySelector("#ai-input");
        input.addEventListener("keydown", e => {
            if (e.key === "Enter" && input.value.trim().length > 0) {
                const question = input.value.trim();
                this.nexus.events.emit("ASK_COLONEL", { question });
                const log = el.querySelector("#ai-log");
                const div = document.createElement("div");
                div.textContent = "> " + question;
                log.appendChild(div);
                log.scrollTop = log.scrollHeight;
                input.value = "";
            }
        });
    },
    renderSettings() {
        const el = this.shadow.querySelector("#tab-settings");
        el.innerHTML = `
            <h3>UI Settings</h3>
            <p>Detach Panel: ${this.uiState.detached ? "Enabled" : "Disabled"}</p>
            <button id="set-detach">Toggle Detach</button>
            <p>Panel Side: ${this.uiState.side}</p>
            <button id="set-side-left">Left</button>
            <button id="set-side-right">Right</button>
        `;
        el.querySelector("#set-detach").addEventListener("click", () => {
            this.uiState.detached = !this.uiState.detached;
            this.applyPosition();
            this.render();
        });
        el.querySelector("#set-side-left").addEventListener("click", () => {
            this.uiState.side = "left";
            this.uiState.detached = false;
            this.applyPosition();
            this.render();
        });
        el.querySelector("#set-side-right").addEventListener("click", () => {
            this.uiState.side = "right";
            this.uiState.detached = false;
            this.applyPosition();
            this.render();
        });
    }
};

/* BLOCK: SELF REGISTRATION */

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Major", module: Major });

})();
