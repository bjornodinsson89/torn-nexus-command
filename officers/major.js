WARDBG("[OFFICER RAW LOAD] Major.js");

function NEXUS_MAJOR_MODULE() {

WARDBG("[OFFICER START] Major.js");

class Major {
    constructor() {
        this.general = null;
        this.host = null;
        this.shadow = null;

        this.activeTab = "overview";
        this.targetSubTab = "personal";

        this.store = {
            user: null,
            chain: null,
            faction: [],
            enemies: [],
            targets: { personal: [], war: [], shared: [] },
            ai: null
        };
    }

    init(G) {
        this.general = G;
        WARDBG("Major init()");

        this.createHost();
        this.renderBase();
        this.renderStyles();
        this.bindTabs();
        this.bindDrawer();
        this.bindSignals();

        this.renderPanel();
    }

    bindSignals() {
        // SITREP feed from the Colonel
        this.general.signals.listen("SITREP_UPDATE", d => {
            if (d.user) this.store.user = d.user;
            if (d.chain) this.store.chain = d.chain;
            if (d.factionMembers) this.store.faction = d.factionMembers;
            if (d.enemyFactionMembers) this.store.enemies = d.enemyFactionMembers;
            if (d.targets) this.store.targets = d.targets;
            if (d.ai) this.store.ai = d.ai;

            this.renderPanel();
        });

        // Shared target updates from Sergeant
        this.general.signals.listen("SHARED_TARGETS_UPDATED", t => {
            this.store.targets.shared = t;
            if (this.activeTab === "targets") this.renderTargets();
        });

        // AI query bridge to Colonel
        this.general.signals.listen("ASK_COLONEL", q => {
            this.answerAI(q.question);
        });
    }

    createHost() {
        if (document.getElementById("nexus-major-host")) return;

        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.top = "0";
        this.host.style.left = "0";
        this.host.style.zIndex = "2147483647";

        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    renderBase() {
        this.shadow.innerHTML = `
            <div id="nexus-btn">N</div>

            <div id="nexus-drawer">
                <div id="tabs">
                    <button data-t="overview" class="on">OVERVIEW</button>
                    <button data-t="faction">FACTION</button>
                    <button data-t="enemy">ENEMIES</button>
                    <button data-t="chain">CHAIN</button>
                    <button data-t="targets">TARGETS</button>
                    <button data-t="ai">AI</button>
                </div>

                <div id="panels">
                    <div id="p-overview" class="panel on"></div>
                    <div id="p-faction" class="panel"></div>
                    <div id="p-enemy" class="panel"></div>
                    <div id="p-chain" class="panel"></div>
                    <div id="p-targets" class="panel"></div>
                    <div id="p-ai" class="panel"></div>
                </div>
            </div>
        `;
    }

    renderStyles() {
        const s = document.createElement("style");
        s.textContent = `
            :host { all: initial; }

            #nexus-btn {
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 55px;
                height: 55px;
                border-radius: 50%;
                background: #000;
                border: 2px solid #00f3ff;
                color: #00f3ff;
                font-size: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 99999;
                font-family: monospace;
            }

            #nexus-drawer {
                position: fixed;
                top: 0;
                left: 0;
                width: 380px;
                height: 100vh;
                background: #050505;
                color: #00f3ff;
                transform: translateX(-100%);
                transition: 0.25s ease;
                overflow-y: auto;
                border-right: 2px solid #00f3ff;
                font-family: monospace;
                z-index: 99998;
            }

            #nexus-drawer.on {
                transform: translateX(0);
            }

            #tabs {
                display: flex;
                border-bottom: 1px solid #00f3ff;
            }

            #tabs button {
                flex: 1;
                padding: 10px;
                background: #000;
                color: #00f3ff;
                border: none;
                cursor: pointer;
                font-size: 12px;
            }

            #tabs button.on {
                background: #00f3ff;
                color: #000;
            }

            .panel {
                display: none;
                padding: 10px;
                font-size: 12px;
            }

            .panel.on {
                display: block;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                color: #00f3ff;
                font-size: 12px;
            }

            td, th {
                padding: 4px;
                border-bottom: 1px solid #0a0a0a;
            }

            #ai-log {
                background: #111;
                height: 250px;
                overflow-y: auto;
                padding: 10px;
                margin-bottom: 10px;
                color: #0ff;
            }

            .ai-msg {
                margin-bottom: 8px;
            }

            .target-tabs {
                display: flex;
                margin-bottom: 8px;
            }

            .target-tabs button {
                flex: 1;
                background: #000;
                color: #00f3ff;
                border: 1px solid #00f3ff;
                padding: 6px;
                cursor: pointer;
            }

            .target-tabs button.on {
                background: #00f3ff;
                color: #000;
            }
        `;
        this.shadow.appendChild(s);
    }

    bindTabs() {
        this.shadow.querySelectorAll("#tabs button").forEach(b => {
            b.addEventListener("click", () => {
                this.shadow.querySelectorAll("#tabs button").forEach(x => x.classList.remove("on"));
                this.shadow.querySelectorAll(".panel").forEach(x => x.classList.remove("on"));

                b.classList.add("on");
                this.activeTab = b.dataset.t;

                this.shadow.querySelector(`#p-${this.activeTab}`).classList.add("on");

                this.renderPanel();
            });
        });
    }

    bindDrawer() {
        const btn = this.shadow.querySelector("#nexus-btn");
        const dr = this.shadow.querySelector("#nexus-drawer");

        btn.addEventListener("click", () => {
            dr.classList.toggle("on");
        });
    }

    renderPanel() {
        if (this.activeTab === "overview") this.renderOverview();
        else if (this.activeTab === "faction") this.renderFaction();
        else if (this.activeTab === "enemy") this.renderEnemies();
        else if (this.activeTab === "chain") this.renderChain();
        else if (this.activeTab === "targets") this.renderTargets();
        else if (this.activeTab === "ai") this.renderAI();
    }

    renderOverview() {
        const p = this.shadow.querySelector("#p-overview");
        const u = this.store.user;
        const a = this.store.ai;

        if (!u || !a) {
            p.textContent = "Awaiting intel...";
            return;
        }

        p.innerHTML = `
            <div><b>Operator:</b> ${u.name}</div>
            <div><b>Level:</b> ${u.level}</div>
            <div><b>HP:</b> ${u.hp}/${u.max_hp}</div>
            <br>
            <div><b>Threat:</b> ${Math.round(a.threat * 100)}%</div>
            <div><b>Risk:</b> ${Math.round(a.risk * 100)}%</div>
            <div><b>Instability:</b> ${Math.round(a.instability * 100)}%</div>
        `;
    }

    renderFaction() {
        const p = this.shadow.querySelector("#p-faction");
        const list = this.store.faction;

        if (!list.length) {
            p.textContent = "No faction intel.";
            return;
        }

        p.innerHTML = `
            <table>
                ${list.map(m => `
                    <tr>
                        <td>${m.name}</td>
                        <td>${m.level}</td>
                        <td>${m.status}</td>
                        <td>${m.onlineState}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderEnemies() {
        const p = this.shadow.querySelector("#p-enemy");
        const list = this.store.enemies;

        if (!list.length) {
            p.textContent = "No enemy intel.";
            return;
        }

        p.innerHTML = `
            <table>
                ${list.map(e => `
                    <tr>
                        <td>${e.name}</td>
                        <td>${e.level}</td>
                        <td>${e.status}</td>
                        <td>${e.onlineState}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderChain() {
        const p = this.shadow.querySelector("#p-chain");
        const c = this.store.chain;

        if (!c) {
            p.textContent = "No chain intel.";
            return;
        }

        p.innerHTML = `
            <div><b>Hits:</b> ${c.hits}</div>
            <div><b>Timeout:</b> ${c.timeLeft}s</div>
        `;
    }

    renderTargets() {
        const p = this.shadow.querySelector("#p-targets");

        p.innerHTML = `
            <div class="target-tabs">
                <button data-t="personal">Personal</button>
                <button data-t="war">War</button>
                <button data-t="shared">Shared</button>
            </div>
            <div id="target-list"></div>
        `;

        this.shadow.querySelectorAll(".target-tabs button").forEach(b => {
            b.addEventListener("click", () => {
                this.shadow.querySelectorAll(".target-tabs button").forEach(x => x.classList.remove("on"));

                b.classList.add("on");
                this.targetSubTab = b.dataset.t;

                this.renderTargetList();
            });
        });

        this.shadow.querySelector(`.target-tabs button[data-t="${this.targetSubTab}"]`)
            ?.classList.add("on");

        this.renderTargetList();
    }

    renderTargetList() {
        const list = this.store.targets[this.targetSubTab] || [];
        const wrap = this.shadow.querySelector("#target-list");

        if (!list.length) {
            wrap.textContent = "No targets.";
            return;
        }

        wrap.innerHTML = `
            <table>
                ${list.map(t => `
                    <tr>
                        <td>${t.name}</td>
                        <td>${t.level || "-"}</td>
                        <td>${t.status || "-"}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderAI() {
        const p = this.shadow.querySelector("#p-ai");

        p.innerHTML = `
            <div id="ai-log"></div>
            <input id="ai-input" placeholder="Command..." />
        `;

        const log = p.querySelector("#ai-log");
        const input = p.querySelector("#ai-input");

        input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                const q = input.value.trim();
                if (!q) return;

                log.innerHTML += `<div class="ai-msg">&gt; ${q}</div>`;
                this.general.signals.dispatch("ASK_COLONEL", { question: q });

                input.value = "";
                log.scrollTop = log.scrollHeight;
            }
        });

        if (this.store.ai?.notes?.length) {
            log.innerHTML = this.store.ai.notes
                .map(n => `<div class="ai-msg">${n}</div>`)
                .join("");
        }
    }

    answerAI(question) {
        const log = this.shadow.querySelector("#ai-log");
        if (!log) return;

        const a = this.store.ai;
        if (!a) {
            log.innerHTML += `<div class="ai-msg">AI unavailable.</div>`;
            return;
        }

        const q = question.toLowerCase();

        if (q.includes("threat")) {
            log.innerHTML += `<div class="ai-msg">Threat level: ${Math.round(a.threat * 100)}%</div>`;
        } else if (q.includes("risk")) {
            log.innerHTML += `<div class="ai-msg">Risk level: ${Math.round(a.risk * 100)}%</div>`;
        } else if (q.includes("next")) {
            log.innerHTML += `<div class="ai-msg">Next hit predicted in ${a.prediction.nextHit}s</div>`;
        } else if (q.includes("drop")) {
            log.innerHTML += `<div class="ai-msg">Chain drop forecast: ${a.prediction.drop}</div>`;
        } else {
            log.innerHTML += `<div class="ai-msg">Unrecognized query.</div>`;
        }

        log.scrollTop = log.scrollHeight;
    }
}

WARDBG("[OFFICER END] Major.js");

if (window.WAR_GENERAL) {
    WARDBG("Major registering with WAR_GENERAL");
    window.WAR_GENERAL.register("Major", new Major());
} else {
    WARDBG("ERROR: window.WAR_GENERAL missing during Major registration.");
}

}

NEXUS_MAJOR_MODULE();
