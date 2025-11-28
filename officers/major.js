(function() {
"use strict";

class Major {
    constructor() {
        this.general = null;
        this.host = null;
        this.shadow = null;
        this.drawerOpen = false;
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
        this.general.signals.listen("SITREP_UPDATE", d => {
            if (d.user) this.store.user = d.user;
            if (d.chain) this.store.chain = d.chain;
            if (d.factionMembers) this.store.faction = d.factionMembers;
            if (d.enemyFactionMembers) this.store.enemies = d.enemyFactionMembers;
            if (d.targets) this.store.targets = d.targets;
            if (d.ai) this.store.ai = d.ai;

            this.renderPanel();
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
            #btn { position:fixed; bottom:20px; left:20px; width:50px; height:50px; background:#000; border:2px solid #00f3ff; border-radius:50%; color:#00f3ff; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:9999; }
            #drawer { position:fixed; top:0; left:0; width:380px; height:100vh; background:#050505; color:#00f3ff; transform:translateX(-100%); transition:0.3s; overflow-y:auto; z-index:9998; border-right:2px solid #00f3ff; }
            #drawer.on { transform:translateX(0); }
            #tabs { display:flex; border-bottom:1px solid #00f3ff; }
            #tabs button { flex:1; padding:10px; background:#000; color:#00f3ff; border:none; cursor:pointer; }
            #tabs button.on { background:#00f3ff; color:#000; }
            .panel { display:none; padding:10px; }
            .panel.on { display:block; }
            table { width:100%; color:#fff; font-size:12px; border-collapse:collapse; }
            td,th { padding:4px; border-bottom:1px solid #222; }
            #ai-log { background:#111; height:200px; overflow-y:auto; padding:10px; }
            .ai-msg { margin-bottom:6px; color:#0ff; }
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
        const btn = this.shadow.querySelector("#btn");
        const dr = this.shadow.querySelector("#drawer");
        btn.addEventListener("click", () => {
            dr.classList.toggle("on");
        });
    }

    renderPanel() {
        if (this.activeTab === "overview") this.renderOverview();
        if (this.activeTab === "faction") this.renderFaction();
        if (this.activeTab === "enemy") this.renderEnemies();
        if (this.activeTab === "chain") this.renderChain();
        if (this.activeTab === "targets") this.renderTargets();
        if (this.activeTab === "ai") this.renderAI();
    }

    renderOverview() {
        const p = this.shadow.querySelector("#p-overview");
        if (!this.store.user || !this.store.ai) {
            p.textContent = "Awaiting data...";
            return;
        }

        const u = this.store.user;
        const a = this.store.ai;

        p.innerHTML = `
            <div>Operator: ${u.name}</div>
            <div>Level: ${u.level}</div>
            <div>Health: ${u.hp}/${u.max_hp}</div>
            <div>Threat: ${Math.round(a.threat * 100)}%</div>
            <div>Risk: ${Math.round(a.risk * 100)}%</div>
        `;
    }

    renderFaction() {
        const p = this.shadow.querySelector("#p-faction");
        const list = this.store.faction;

        if (!list.length) {
            p.textContent = "No faction data";
            return;
        }

        p.innerHTML = `
            <table>
                ${list.map(m => `
                    <tr>
                        <td>${m.name}</td>
                        <td>${m.level}</td>
                        <td>${m.status}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderEnemies() {
        const p = this.shadow.querySelector("#p-enemy");
        const list = this.store.enemies;

        if (!list.length) {
            p.textContent = "No hostiles";
            return;
        }

        p.innerHTML = `
            <table>
                ${list.map(m => `
                    <tr>
                        <td>${m.name}</td>
                        <td>${m.level}</td>
                        <td>${m.status}</td>
                    </tr>
                `).join("")}
            </table>
        `;
    }

    renderChain() {
        const p = this.shadow.querySelector("#p-chain");
        const c = this.store.chain;

        if (!c) {
            p.textContent = "No chain information";
            return;
        }

        p.innerHTML = `
            <div>Hits: ${c.hits}</div>
            <div>Timeout: ${c.timeLeft}s</div>
        `;
    }

    renderTargets() {
        const p = this.shadow.querySelector("#p-targets");
        const list = this.store.targets[this.targetSubTab] || [];

        if (!list.length) {
            p.textContent = "No targets";
            return;
        }

        p.innerHTML = `
            <table>
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

    renderAI() {
        const p = this.shadow.querySelector("#p-ai");

        p.innerHTML = `
            <div id="ai-log"></div>
            <input id="ai-input" placeholder="Command..." style="width:100%; padding:5px; background:#111; color:#0ff; border:1px solid #00f3ff;">
        `;

        const input = p.querySelector("#ai-input");
        const log = p.querySelector("#ai-log");

        input.addEventListener("keydown", e => {
            if (e.key === "Enter" && input.value.trim()) {
                const txt = input.value.trim();

                const msg = document.createElement("div");
                msg.className = "ai-msg";
                msg.textContent = "> " + txt;
                log.appendChild(msg);

                this.general.signals.dispatch("ASK_COLONEL", { question: txt });
                input.value = "";
            }
        });
    }
}

if (window.WAR_GENERAL) WAR_GENERAL.register("Major", new Major());

})();
