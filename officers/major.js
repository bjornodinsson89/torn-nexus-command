// === MAJOR v8.1 — NEXUS BLACK OPS (FIXED) ===

(function() {
"use strict";

class Major {
    constructor() {
        this.general = null;
        this.host = null;
        this.shadow = null;
        this.drawerEl = null;
        this.drawerOpen = false;
        this.drawerSide = "left";
        this.buttonEl = null;
        this.dragging = false;
        this._isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.activeTab = "overview";
        this.targetSubTab = "personal";
        this.factionSort = { key: 'level', dir: 'desc' };
        this.mutationObserver = null;
        this.intervals = [];
        this.store = {
            user: null,
            chain: null,
            faction: [],
            enemies: [],
            ai: null,
            targets: { personal:[], war:[], shared:[] },
            heatmap: []
        };
    }

    init(General) {
        this.general = General;
        this.createHost();
        this.renderBaseHTML();
        this.applyStyles();
        this.attachButtonLogic();
        this.attachDragLogic();
        this.attachResizeObserver();
        this.startInlineScanner();
        this.bindSignals();

        const savedSide = localStorage.getItem("nexus_drawer_side");
        if(savedSide) this.drawerSide = savedSide;

        this.updateDrawerSide();
        this.buildColonelPanel();
        this.renderActivePanel();
    }

    bindSignals() {
        this.general.signals.listen("SITREP_UPDATE", d => {
            if(d.user) this.store.user = d.user;
            if(d.chain) this.store.chain = d.chain;
            if(d.factionMembers) this.store.faction = d.factionMembers;
            if(d.enemyFactionMembers) this.store.enemies = d.enemyFactionMembers;
            if(d.ai) this.store.ai = d.ai;
            if(d.targets) this.store.targets = d.targets;

            if(this.activeTab === "overview") this.renderOverview();
            if(this.activeTab === "chain") this.renderChain();
            if(this.activeTab === "faction") this.renderFaction();
            if(this.activeTab === "enemy") this.renderEnemies();
            if(this.activeTab === "targets") this.renderTargets();
        });

        this.general.signals.listen("MAJOR_SHARED_TARGETS", d => {
            this.store.targets.shared = d.shared || [];
            if(this.activeTab === "targets") this.renderTargets();
        });

        this.general.signals.listen("ASK_COLONEL_RESPONSE", d => {
            const win = this.shadow.querySelector("#col-msgs");
            if(win && d.answer) {
                const div = document.createElement("div");
                div.className = "msg msg-ai";
                div.textContent = "[AI] " + d.answer;
                win.appendChild(div);
                win.scrollTop = win.scrollHeight;
            }
        });
    }

    createHost() {
        if (document.getElementById("nexus-major-host")) return;
        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "2147483647";
        this.host.style.top = "0";
        this.host.style.left = "0";
        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    renderBaseHTML() {
        this.shadow.innerHTML = `
            <div id="nexus-container">
                <button id="nexus-toggle" class="nexus-btn">
                    <div class="scanner-line"></div>
                    <span class="btn-icon">N</span>
                </button>
                <div id="nexus-drawer">
                    <div class="drawer-header">
                        <div class="header-glitch">WAR NEXUS // V8.1</div>
                        <span id="close-drawer" class="control-btn">×</span>
                    </div>
                    <div id="nexus-tabs">
                        <button class="nexus-tab active" data-tab="overview">OVERVIEW</button>
                        <button class="nexus-tab" data-tab="faction">FACTION</button>
                        <button class="nexus-tab" data-tab="enemy">ENEMIES</button>
                        <button class="nexus-tab" data-tab="chain">CHAIN</button>
                        <button class="nexus-tab" data-tab="targets">TARGETS</button>
                        <button class="nexus-tab" data-tab="colonel">AI UPLINK</button>
                        <button class="nexus-tab" data-tab="settings">CONFIG</button>
                    </div>
                    <div id="nexus-panels">
                        <div id="panel-overview" class="panel active"><div class="loader-text">AWAITING DATALINK...</div></div>
                        <div id="panel-faction" class="panel"></div>
                        <div id="panel-enemy" class="panel"></div>
                        <div id="panel-chain" class="panel"></div>
                        <div id="panel-targets" class="panel"></div>
                        <div id="panel-colonel" class="panel"></div>
                        <div id="panel-settings" class="panel"></div>
                    </div>
                </div>
            </div>
        `;

        this.drawerEl = this.shadow.querySelector("#nexus-drawer");
        this.buttonEl = this.shadow.querySelector("#nexus-toggle");

        this.shadow.querySelectorAll(".nexus-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                this.shadow.querySelectorAll(".nexus-tab").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.activeTab = btn.dataset.tab;
                this.renderActivePanel();
            });
        });

        this.shadow.querySelector("#close-drawer").addEventListener("click", () => this.toggleDrawer());
        this.buildSettingsPanel();
    }

    applyStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; font-family: 'Segoe UI', Roboto, sans-serif; --c-neon: #00f3ff; --c-alert: #ff003c; --c-bg: #050505; }
            * { box-sizing: border-box; }
            #nexus-drawer { position: fixed; top: 0; width: 420px; height: 100vh; background: var(--c-bg); border-right: 2px solid var(--c-neon); transform: translateX(-100%); transition: transform 0.25s ease; display: flex; flex-direction: column; z-index: 10000; }
            #nexus-drawer.right { border-right: none; border-left: 2px solid var(--c-neon); transform: translateX(100%); }
            .drawer-open-left { transform: translateX(0) !important; }
            .drawer-open-right { transform: translateX(0) !important; }
            .drawer-header { padding: 15px; color: var(--c-neon); font-family: 'Courier New'; font-size: 18px; font-weight: bold; }
            .nexus-tab { flex: 1; padding: 10px; cursor: pointer; color: #666; border-bottom: 2px solid transparent; }
            .nexus-tab.active { color: var(--c-neon); border-bottom: 2px solid var(--c-neon); }
            .panel { display: none; padding: 10px; }
            .panel.active { display: block; }
            .nexus-btn { position: fixed; bottom:20px; left:20px; width:50px; height:50px; background:#000; border:2px solid var(--c-neon); border-radius:50%; color:var(--c-neon); display:flex; align-items:center; justify-content:center; font-size:20px; cursor:pointer; z-index:99999; }
            .tile { background:#111; border-left:3px solid #333; margin-bottom:10px; padding:10px; }
        `;
        this.shadow.appendChild(style);
    }

    renderActivePanel() {
        this.shadow.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        const target = this.shadow.querySelector(`#panel-${this.activeTab}`);
        if(target) target.classList.add("active");
        if (this.activeTab === "overview") this.renderOverview();
        if (this.activeTab === "faction") this.renderFaction();
        if (this.activeTab === "enemy") this.renderEnemies();
        if (this.activeTab === "chain") this.renderChain();
        if (this.activeTab === "targets") this.renderTargets();
    }

    renderOverview() {
        if(!this.store.user || !this.store.ai) return;

        const p = this.shadow.querySelector("#panel-overview");
        const u = this.store.user;
        const a = this.store.ai;

        const threatValue = Math.round(a.threat * 100);
        const threatColor = a.threat > 0.5 ? 'var(--c-alert)' : 'var(--c-neon)';

        p.innerHTML = `
            <div class="tile">
                <h3>OPERATOR: <span style="color:#fff">${this.sanitize(u.name)}</span></h3>
                <div style="margin-top:10px;">LEVEL: ${u.level}</div>
                <div>HEALTH: ${u.hp}/${u.max_hp}</div>
            </div>
            <div class="tile">
                <h3>THREAT</h3>
                <div style="font-size:24px; color:${threatColor}; text-align:center;">${threatValue}%</div>
            </div>
        `;
    }

    renderFaction() {
        const p = this.shadow.querySelector("#panel-faction");
        const list = this.store.faction;
        if(!list || !list.length) { p.innerHTML = "NO FACTION DATA"; return; }

        const rows = list.map(m => `
            <tr>
                <td>${this.renderOnlineDot(m.onlineState)}</td>
                <td>${this.sanitize(m.name)}</td>
                <td>${m.level}</td>
                <td>${this.renderStatusBadge(m.status)}</td>
            </tr>
        `).join("");

        p.innerHTML = `
            <table class="nexus-table">
                <thead><tr><th>●</th><th>NAME</th><th>LVL</th><th>STS</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    renderEnemies() {
        const p = this.shadow.querySelector("#panel-enemy");
        const list = this.store.enemies || [];
        if(!list.length) { p.innerHTML = "NO HOSTILES"; return; }

        const rows = list.map(m => `
            <tr>
                <td>${this.renderOnlineDot(m.onlineState)}</td>
                <td>${this.sanitize(m.name)}</td>
                <td>${m.level}</td>
                <td>${this.renderStatusBadge(m.status)}</td>
                <td><span class="act-btn act-att" data-id="${m.id}">Attack</span></td>
            </tr>
        `).join("");

        p.innerHTML = `
            <table class="nexus-table">
                <thead><tr><th>●</th><th>NAME</th><th>LVL</th><th>STS</th><th>A</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        this.attachActionListeners(p);
    }

    renderChain() {
        const p = this.shadow.querySelector("#panel-chain");
        const c = this.store.chain;
        if(!c) { p.innerHTML = "CHAIN INACTIVE"; return; }

        p.innerHTML = `
            <div class="tile">
                <h3>CHAIN STATUS</h3>
                <div>Hits: ${c.hits}</div>
                <div>Timeout: ${c.timeLeft}s</div>
            </div>
        `;
    }

    renderTargets() {
        const p = this.shadow.querySelector("#panel-targets");
        const sub = this.targetSubTab;

        const list = this.store.targets[sub] || [];

        const rows = list.map(t => `
            <tr>
                <td>${this.renderOnlineDot(t.onlineState)}</td>
                <td>${this.sanitize(t.name)}</td>
                <td>${t.level}</td>
                <td>${this.renderStatusBadge(t.status)}</td>
                <td><span class="act-btn act-att" data-id="${t.id}">Attack</span></td>
            </tr>
        `).join("");

        p.innerHTML = `
            <table class="nexus-table">
                <thead><tr><th>●</th><th>NAME</th><th>LVL</th><th>STS</th><th>A</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        this.attachActionListeners(p);
    }

    buildColonelPanel() {
        const p = this.shadow.querySelector("#panel-colonel");
        p.innerHTML = `
            <div class="tile">
                <h3>TACTICAL AI UPLINK</h3>
                <div class="chat-win" id="col-msgs">
                    <div class="msg msg-ai">[AI] Online.</div>
                </div>
                <input id="col-input" class="chat-input" placeholder="Enter command...">
            </div>
        `;
        const input = p.querySelector("#col-input");
        const win = p.querySelector("#col-msgs");

        input.addEventListener("keydown", e => {
            if(e.key === "Enter" && input.value.trim()) {
                const txt = input.value.trim();
                const div = document.createElement("div");
                div.className = "msg msg-user";
                div.textContent = txt;
                win.appendChild(div);

                this.general.signals.dispatch("ASK_COLONEL", { question: txt });
                input.value = "";
                win.scrollTop = win.scrollHeight;
            }
        });
    }

    buildSettingsPanel() {
        const p = this.shadow.querySelector("#panel-settings");
        p.innerHTML = `
            <div class="tile">
                <h3>CONFIG</h3>
                <select id="dock-side">
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                </select>
            </div>
        `;

        const sel = p.querySelector("#dock-side");
        sel.value = this.drawerSide;
        sel.addEventListener("change", () => {
            this.drawerSide = sel.value;
            localStorage.setItem("nexus_drawer_side", sel.value);
            this.updateDrawerSide();
        });
    }

    sanitize(s) { const d=document.createElement('div'); d.textContent=s||""; return d.innerHTML; }

    renderStatusBadge(st) {
        const s = (st||"").toLowerCase();
        if(s.includes("hosp")) return `<span style="color:#f55">HOSP</span>`;
        if(s.includes("jail")) return `<span style="color:#f55">JAIL</span>`;
        if(s.includes("travel")) return `<span style="color:#aaa">FLY</span>`;
        return `<span style="color:#5f5">OK</span>`;
    }

    renderOnlineDot(st) {
        return `<span style="color:${st==='online'?'#0f0':'#444'}; font-size:14px;">●</span>`;
    }

    attachButtonLogic() {
        this.buttonEl.addEventListener("click", () => {
            if(!this._isDragging) this.toggleDrawer();
        });
    }

    toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
        this.updateDrawerSide();
    }

    updateDrawerSide() {
        if (this.drawerSide === "right")
            this.drawerEl.className = this.drawerOpen ? "drawer-open-right right" : "right";
        else
            this.drawerEl.className = this.drawerOpen ? "drawer-open-left" : "";
    }

    attachDragLogic() {
        const btn = this.buttonEl;
        const start = e => {
            if(e.type==='mousedown' && e.button!==0) return;
            e.preventDefault();
            this.dragging = true;
            this._isDragging = true;
            const t = e.touches ? e.touches[0] : e;
            const r = btn.getBoundingClientRect();
            this.dragOffsetX = t.clientX - r.left;
            this.dragOffsetY = t.clientY - r.top;

            const move = ev => {
                const p = ev.touches ? ev.touches[0] : ev;
                btn.style.left = (p.clientX - this.dragOffsetX)+"px";
                btn.style.top = (p.clientY - this.dragOffsetY)+"px";
            };

            const stop = () => {
                this.dragging = false;
                setTimeout(() => this._isDragging = false, 120);
                window.removeEventListener("mousemove",move);
                window.removeEventListener("mouseup",stop);
                window.removeEventListener("touchmove",move);
                window.removeEventListener("touchend",stop);
            };

            window.addEventListener("mousemove",move);
            window.addEventListener("mouseup",stop);
            window.addEventListener("touchmove",move,{ passive:false });
            window.addEventListener("touchend",stop);
        };

        btn.addEventListener("mousedown", start);
        btn.addEventListener("touchstart", start, { passive:false });
    }

    attachResizeObserver() {
        window.addEventListener("resize", () => this.updateDrawerSide());
    }

    drawHeatmap(canvas, data) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0,0,w,h);
        const bw = w / data.length;
        const max = Math.max(...data,1);
        data.forEach((val, i) => {
            const pct = val/max;
            ctx.fillStyle = `rgba(0,243,255,${pct})`;
            ctx.fillRect(i*bw, h-(h*pct), bw, h*pct);
        });
    }

    startInlineScanner() {
        const scan = () => {
            document.querySelectorAll("a[href*='profiles.php?XID=']").forEach(a => {
                if(a.dataset.nexus) return;
                const id = a.href.match(/XID=(\d+)/)?.[1];
                if(id) {
                    a.dataset.nexus = "1";
                    const s = document.createElement("span");
                    s.innerHTML = `<span class="act-btn act-att" data-id="${id}" style="font-size:10px; margin-left:4px;">Attack</span>`;
                    a.after(s);
                    this.attachActionListeners(s);
                }
            });
        };
        this.mutationObserver = new MutationObserver(scan);
        this.mutationObserver.observe(document.body, { childList:true, subtree:true });
        scan();
    }

    attachActionListeners(root) {
        root.querySelectorAll(".act-att").forEach(b => {
            b.addEventListener("click", () => window.location.href = `/loader.php?sid=attack&user2ID=${b.dataset.id}`);
        });
    }
}

function waitForGeneral(attempt=0) {
    if (window.WAR_GENERAL && typeof window.WAR_GENERAL.register === "function") {
        window.WAR_GENERAL.register("Major", new Major());
        return;
    }
    const delay = Math.min(1000, 100 * Math.pow(1.6, attempt));
    if (attempt < 80) setTimeout(() => waitForGeneral(attempt+1), delay);
}

waitForGeneral();

})();
