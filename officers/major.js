// major.js — Full Command Console UI for Torn War Nexus

////////////////////////////////////////////////////////////
// MAJOR — FULL COMMAND CONSOLE UI
// Receives SITREP from Colonel via WAR_GENERAL.signals.
////////////////////////////////////////////////////////////

(function() {
    "use strict";

    class Major {
        constructor() {
            this.general = null;

            this.host = null;
            this.shadow = null;
            this.drawerEl = null;
            this.drawerOpen = false;
            this.activeTab = "overview";

            this.store = {
                user: null,
                chain: null,
                faction: [],
                enemies: [],
                targets: { personal: [], war: [], shared: [] },
                ai: null
            };

            this.targetSubTab = "personal";
        }

        // ----------------------------------------------------------
        // INIT
        // ----------------------------------------------------------
        init(G) {
            this.general = G;

            this.createHost();
            this.renderBase();
            this.renderStyles();
            this.bindTabs();
            this.bindDrawer();
            this.bindSignals();

            this.renderPanel();
        }

        // ----------------------------------------------------------
        // SIGNAL HANDLERS
        // ----------------------------------------------------------
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
                const w = this.shadow.getElementById("ai-log");
                if (w && d.answer) {
                    const msg = document.createElement("div");
                    msg.className = "ai-msg";
                    msg.textContent = d.answer;
                    w.appendChild(msg);
                    w.scrollTop = w.scrollHeight;
                }
            });
        }

        // ----------------------------------------------------------
        // UI CONSTRUCTION
        // ----------------------------------------------------------
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
                <div id="btn">N</div>
                <div id="drawer">
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

                #btn {
                    position: fixed;
                    bottom:20px; left:20px;
                    width:50px; height:50px;
                    background:#000;
                    border:2px solid #00f3ff;
                    border-radius:50%;
                    color:#00f3ff;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    cursor:pointer;
                    z-index:9999;
                    font-size:20px;
                    font-family:Arial, sans-serif;
                }

                #drawer {
                    position: fixed;
                    top:0; left:0;
                    width:380px; height:100vh;
                    background:#050505;
                    color:#00f3ff;
                    transform: translateX(-100%);
                    transition:0.3s;
                    border-right:2px solid #00f3ff;
                    z-index:9998;
                    overflow-y:auto;
                    font-family:Arial, sans-serif;
                }

                #drawer.on {
                    transform: translateX(0);
                }

                #tabs {
                    display:flex;
                    border-bottom:1px solid #00f3ff;
                }
                #tabs button {
                    flex:1;
                    background:#000;
                    color:#00f3ff;
                    padding:10px;
                    border:none;
                    cursor:pointer;
                }
                #tabs button.on {
                    background:#00f3ff;
                    color:#000;
                }

                .panel {
                    display:none; padding:10px;
                }
                .panel.on { display:block; }

                table {
                    width:100%;
                    border-collapse: collapse;
                    font-size:13px;
                    color:#fff;
                }
                td, th {
                    padding:4px;
                    border-bottom:1px solid #222;
                }

                #ai-log {
                    background:#111;
                    color:#0ff;
                    height:260px;
                    overflow-y:auto;
                    padding:10px;
                    margin-bottom:8px;
                    border:1px solid #00f3ff;
                    font-family: monospace;
                    font-size: 12px;
                }
                .ai-msg { margin-bottom:6px; }

                input.ai-cmd {
                    width:100%; padding:8px;
                    background:#000;
                    border:1px solid #00f3ff;
                    color:#00f3ff;
                    font-size:14px;
                }
            `;
            this.shadow.appendChild(s);
        }

        bindTabs() {
            this.shadow.querySelectorAll("#tabs button").forEach(btn => {
                btn.addEventListener("click", () => {
                    this.shadow.querySelectorAll("#tabs button")
                        .forEach(b => b.classList.remove("on"));

                    this.shadow.querySelectorAll(".panel")
                        .forEach(p => p.classList.remove("on"));

                    btn.classList.add("on");
                    this.activeTab = btn.dataset.t;

                    this.shadow.querySelector(`#p-${this.activeTab}`).classList.add("on");
                    this.renderPanel();
                });
            });
        }

        bindDrawer() {
            const btn = this.shadow.getElementById("btn");
            const drawer = this.shadow.getElementById("drawer");

            btn.addEventListener("click", () => {
                drawer.classList.toggle("on");
            });
        }

        // ----------------------------------------------------------
        // PANEL RENDERING
        // ----------------------------------------------------------
        renderPanel() {
            if (this.activeTab === "overview") this.renderOverview();
            else if (this.activeTab === "faction") this.renderFaction();
            else if (this.activeTab === "enemy") this.renderEnemies();
            else if (this.activeTab === "chain") this.renderChain();
            else if (this.activeTab === "targets") this.renderTargets();
            else if (this.activeTab === "ai") this.renderAI();
        }

        // ------------------------
        // OVERVIEW TAB
        // ------------------------
        renderOverview() {
            const p = this.shadow.getElementById("p-overview");
            const u = this.store.user;
            const a = this.store.ai;

            if (!u || !a) {
                p.textContent = "Awaiting data...";
                return;
            }

            p.innerHTML = `
                <div><b>Operator:</b> ${u.name}</div>
                <div><b>Level:</b> ${u.level}</div>
                <div><b>Health:</b> ${u.hp}/${u.max_hp}</div>
                <div><b>Status:</b> ${u.status}</div>
                <br>
                <div><b>Threat:</b> ${Math.round(a.threat * 100)}%</div>
                <div><b>Risk:</b> ${Math.round(a.risk * 100)}%</div>
                <div><b>Aggression:</b> ${Math.round(a.aggression * 100)}%</div>
                <div><b>Instability:</b> ${Math.round(a.instability * 100)}%</div>
                <br>
                <div><b>Next Hit Estimate:</b> ${a.prediction.nextHit}</div>
                <div><b>Potential Chain Drop:</b> ${a.prediction.drop}s</div>
                <br>
                <div><b>Notes:</b><br>${a.notes.map(n => `• ${n}`).join("<br>")}</div>
            `;
        }

        // ------------------------
        // FACTION TAB
        // ------------------------
        renderFaction() {
            const p = this.shadow.getElementById("p-faction");
            const list = this.store.faction;

            if (!list.length) {
                p.textContent = "No faction data";
                return;
            }

            p.innerHTML = `
                <table>
                    <tr><th>Name</th><th>Lv</th><th>Status</th><th>Last Action</th></tr>
                    ${list.map(m => `
                        <tr>
                            <td>${m.name}</td>
                            <td>${m.level}</td>
                            <td>${m.status}</td>
                            <td>${m.last_action}</td>
                        </tr>
                    `).join("")}
                </table>
            `;
        }

        // ------------------------
        // ENEMIES TAB
        // ------------------------
        renderEnemies() {
            const p = this.shadow.getElementById("p-enemy");
            const list = this.store.enemies;

            if (!list.length) {
                p.textContent = "No enemy data";
                return;
            }

            p.innerHTML = `
                <table>
                    <tr><th>Name</th><th>Lv</th><th>Status</th><th>Score</th></tr>
                    ${list.map(m => `
                        <tr>
                            <td>${m.name}</td>
                            <td>${m.level}</td>
                            <td>${m.status}</td>
                            <td>${m.score}</td>
                        </tr>
                    `).join("")}
                </table>
            `;
        }

        // ------------------------
        // CHAIN TAB
        // ------------------------
        renderChain() {
            const p = this.shadow.getElementById("p-chain");
            const c = this.store.chain;

            if (!c) {
                p.textContent = "No chain data";
                return;
            }

            p.innerHTML = `
                <div><b>Hits:</b> ${c.hits}</div>
                <div><b>Timeout:</b> ${c.timeLeft}s</div>
            `;
        }

        // ------------------------
        // TARGETS TAB
        // ------------------------
        renderTargets() {
            const p = this.shadow.getElementById("p-targets");
            const list = this.store.targets[this.targetSubTab] || [];

            if (!list.length) {
                p.textContent = "No targets in this category.";
                return;
            }

            p.innerHTML = `
                <table>
                    <tr><th>Name</th><th>Lv</th><th>Status</th></tr>
                    ${list.map(t => `
                        <tr>
                            <td>${t.name}</td>
                            <td>${t.level}</td>
                            <td>${t.status}</td>
                        </tr>
                    `).join("")}
                </table>
            `;
        }

        // ------------------------
        // AI TAB
        // ------------------------
        renderAI() {
            const p = this.shadow.getElementById("p-ai");
            p.innerHTML = `
                <div id="ai-log"></div>
                <input class="ai-cmd" id="ai-input" placeholder="Ask the Colonel...">
            `;

            const input = p.querySelector("#ai-input");
            const log = p.querySelector("#ai-log");

            input.addEventListener("keydown", e => {
                if (e.key === "Enter" && input.value.trim()) {
                    const q = input.value.trim();

                    const msg = document.createElement("div");
                    msg.className = "ai-msg";
                    msg.textContent = "> " + q;
                    log.appendChild(msg);

                    this.general.signals.dispatch("ASK_COLONEL", { question: q });

                    input.value = "";
                }
            });
        }
    }

    // ----------------------------------------------------------
    // REGISTRATION — RELIABLE ON MOBILE
    // ----------------------------------------------------------
    function registerMajor() {
        if (typeof window.WAR_GENERAL !== "undefined" &&
            typeof window.WAR_GENERAL.register === "function") {
            window.WAR_GENERAL.register("Major", new Major());
            return true;
        }
        return false;
    }

    // Try immediately, then retry a few times if needed
    if (!registerMajor()) {
        let tries = 0;
        const timer = setInterval(() => {
            if (registerMajor() || ++tries > 20) clearInterval(timer);
        }, 200);
    }

})();
