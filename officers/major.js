WARDBG("[OFFICER RAW LOAD] Major.js");

function NEXUS_MAJOR_MODULE() {

WARDBG("[OFFICER START] Major.js");

class Major {
    constructor() {
        this.general = null;
        this.store = {
            user: null,
            chain: null,
            faction: [],
            enemies: [],
            targets: { personal: [], war: [], shared: [] },
            ai: null
        };
        this.activeTab = "overview";
        this.host = null;
        this.shadow = null;
    }

    init(G) {
        this.general = G;
        WARDBG("Major init()");

        this.createHost();
        this.renderBase();
        this.bind();
        this.renderPanel();

        this.general.signals.listen("SITREP_UPDATE", d => this.ingest(d));
    }

    ingest(d) {
        if (d.user) this.store.user = d.user;
        if (d.chain) this.store.chain = d.chain;
        if (d.factionMembers) this.store.faction = d.factionMembers;
        if (d.enemyFactionMembers) this.store.enemies = d.enemyFactionMembers;
        if (d.targets) this.store.targets = d.targets;
        if (d.ai) this.store.ai = d.ai;

        this.renderPanel();
    }

    createHost() {
        const host = document.createElement("div");
        host.id = "nexus-major-root";
        host.style.position = "fixed";
        host.style.top = "0";
        host.style.left = "0";
        host.style.zIndex = "2147483647";
        this.shadow = host.attachShadow({ mode: "open" });
        document.body.appendChild(host);
    }

    renderBase() {
        this.shadow.innerHTML = `
            <style>
                #btn { position:fixed; bottom:20px; left:20px;
                       width:55px;height:55px;border-radius:50%;
                       background:#000;border:2px solid #0ff;
                       color:#0ff;display:flex;align-items:center;
                       justify-content:center;font-family:monospace;
                       cursor:pointer; }
                #drawer { position:fixed;top:0;left:0;width:350px;height:100vh;
                          background:#000;color:#0ff;transform:translateX(-100%);
                          border-right:2px solid #0ff;transition:.25s; }
                #drawer.on { transform:translateX(0); }
                #tabs { display:flex;border-bottom:1px solid #0ff; }
                #tabs button { flex:1;background:#000;color:#0ff;border:none;padding:8px;
                               cursor:pointer;font-family:monospace; }
                #tabs .on { background:#0ff;color:#000; }
                .panel { display:none;padding:10px;font-family:monospace; }
                .panel.on { display:block; }
                table { width:100%;color:#0ff;border-collapse:collapse; }
                td { padding:4px;border-bottom:1px solid #111; }
            </style>

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

                <div id="p-overview" class="panel on"></div>
                <div id="p-faction" class="panel"></div>
                <div id="p-enemy" class="panel"></div>
                <div id="p-chain" class="panel"></div>
                <div id="p-targets" class="panel"></div>
                <div id="p-ai" class="panel"></div>
            </div>
        `;
    }

    bind() {
        const drawer = this.shadow.querySelector("#drawer");
        this.shadow.querySelector("#btn").onclick =
            () => drawer.classList.toggle("on");

        this.shadow.querySelectorAll("#tabs button").forEach(b => {
            b.onclick = () => {
                this.shadow.querySelectorAll("#tabs button")
                    .forEach(x => x.classList.remove("on"));
                b.classList.add("on");
                this.activeTab = b.dataset.t;
                this.renderPanel();
            };
        });
    }

    renderPanel() {
        const panels = this.shadow.querySelectorAll(".panel");
        panels.forEach(p => p.classList.remove("on"));

        const p = this.shadow.querySelector(`#p-${this.activeTab}`);
        if (p) p.classList.add("on");

        if (this.activeTab === "overview") this.renderOverview();
        else if (this.activeTab === "chain") this.renderChain();
        else if (this.activeTab === "faction") this.renderFaction();
        else if (this.activeTab === "enemy") this.renderEnemies();
    }

    renderOverview() {
        const p = this.shadow.querySelector("#p-overview");
        const u = this.store.user;
        const a = this.store.ai;

        if (!u) {
            p.innerHTML = "Awaiting intel...";
            return;
        }

        const threat = a ? Math.round(a.threat * 100) : 0;
        const risk = a ? Math.round(a.risk * 100) : 0;

        p.innerHTML = `
            <div><b>Name:</b> ${u.name}</div>
            <div><b>Level:</b> ${u.level}</div>
            <div><b>HP:</b> ${u.hp}/${u.max_hp}</div>
            <br>
            <div><b>Threat:</b> ${threat}%</div>
            <div><b>Risk:</b> ${risk}%</div>
        `;
    }

    renderChain() {
        const p = this.shadow.querySelector("#p-chain");
        const c = this.store.chain;

        if (!c) {
            p.innerHTML = "Awaiting chain intel...";
            return;
        }

        p.innerHTML = `
            <div><b>Hits:</b> ${c.hits || 0}</div>
            <div><b>Timeout:</b> ${c.timeLeft || 0}s</div>
        `;
    }

    renderFaction() {
        const p = this.shadow.querySelector("#p-faction");
        const list = this.store.faction;

        p.innerHTML = `
            <table>
                ${list.map(m => `
                    <tr><td>${m.name}</td><td>${m.level}</td><td>${m.status}</td></tr>
                `).join("")}
            </table>
        `;
    }

    renderEnemies() {
        const p = this.shadow.querySelector("#p-enemy");
        const list = this.store.enemies;

        p.innerHTML = `
            <table>
                ${list.map(e => `
                    <tr><td>${e.name}</td><td>${e.level}</td><td>${e.status}</td></tr>
                `).join("")}
            </table>
        `;
    }
}

WARDBG("[OFFICER END] Major.js");

if (window.WAR_GENERAL)
    window.WAR_GENERAL.register("Major", new Major());

}

NEXUS_MAJOR_MODULE();
