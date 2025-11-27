/********************************************************************
 * MAJOR v7.1 – THE WARLORD GUI (Fixed & Fully Functional)
 * • Full Feature Port of warGUI.js v1.8
 * • Backend Connected: Colonel (Data) & Sergeant (Cloud)
 ********************************************************************/

(function() {
"use strict";

/* ============================================================
   SAFETY CHECK — ENSURE GENERAL EXISTS
   ============================================================ */
if (!window.WAR_GENERAL) {
    console.warn("[MAJOR] WAR_GENERAL not detected — Major aborted.");
    return;
}

/* ============================================================
   CLASS MAJOR — Main UI / Drawer / Overlay Controller
   ============================================================ */
class Major {

    constructor() {
        this.general = null;

        // Host & Shadow Root
        this.host = null;
        this.shadow = null;

        // Drawer
        this.drawerEl = null;
        this.drawerOpen = false;
        this.drawerSide = "left"; // setting

        // Toggle Button
        this.buttonEl = null;
        this.buttonPosition = { bottom: 20, left: 20 };

        // Drag Logic
        this.dragging = false;
        this._isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // Tabs & Panels
        this.activeTab = "main";
        this.targetSubTab = "personal";
        this.tabsContainer = null;
        this.panelsContainer = null;

        // Inline Scanner
        this.inlineScanner = null;

        // Officer Ready / Sync
        this.officerStatus = {
            general: "OFFLINE",
            lieutenant: "OFFLINE",
            sergeant: "OFFLINE",
            major: "OFFLINE",
            colonel: "OFFLINE"
        };
    }

    /* ============================================================
       INIT
       ============================================================ */
    init(General) {
        this.general = General;

        this.createHost();
        this.renderBaseHTML();
        this.applyBaseStyles();

        this.attachButtonLogic();
        this.attachDragLogic();
        this.attachResizeObserver();

        this.updateDrawerSide();
        this.applyAnimationPreferences();

        this.startInlineScanner();
        this.startSitrepRouter();
        this.startOfficerReadyListener();

        if (this.general && this.general.signals) {
            this.general.signals.dispatch("UI_READY", {});
        }

        // Major is online
        this.general.signals.dispatch("MAJOR_READY", {});
    }

    /* ============================================================
       HOST + SHADOW DOM
       ============================================================ */
    createHost() {
        if (this.host) return;

        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "999999";

        // Attach shadow root
        this.shadow = this.host.attachShadow({ mode: "open" });

        document.body.appendChild(this.host);
    }

    /* ============================================================
       BASE DRAWER HTML (NO PLACEHOLDERS)
       ============================================================ */
    renderBaseHTML() {
        if (!this.shadow) return;

        this.shadow.innerHTML = `
            <div id="nexus-container">
                <button id="nexus-toggle" class="nexus-btn">≡</button>
                <div id="nexus-drawer">
                    <div class="drawer-header">
                        <span class="drawer-title">WAR NEXUS</span>
                    </div>

                    <!-- TABS -->
                    <div id="nexus-tabs"></div>

                    <!-- PANELS -->
                    <div id="nexus-panels"></div>
                </div>
            </div>
        `;

        this.drawerEl = this.shadow.querySelector("#nexus-drawer");
        this.buttonEl = this.shadow.querySelector("#nexus-toggle");
        this.tabsContainer = this.shadow.querySelector("#nexus-tabs");
        this.panelsContainer = this.shadow.querySelector("#nexus-panels");

        this.buildTabs();
        this.buildPanels();
    }

    /* ============================================================
       BASE CSS + VARIABLES
       ============================================================ */
    applyBaseStyles() {
        if (!this.shadow) return;
        const style = document.createElement("style");

        style.textContent = `
            :host { all: initial; }

            #nexus-container {
                position: fixed;
                bottom: 0;
                left: 0;
                pointer-events: none;
                --drawer-transition: 0.32s;
                --button-transition: 0.15s;
            }

            .nexus-btn {
                pointer-events: auto;
                position: fixed;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                font-size: 20px;
                border: none;
                background: #0a0a0a;
                color: #00c8ff;
                box-shadow: 0 0 8px #00c8ff;
                cursor: pointer;
                transition: transform var(--button-transition) ease, box-shadow var(--button-transition) ease;
                user-select: none;
                bottom: 20px;
                left: 20px;
            }

            .nexus-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 0 12px #00e1ff;
            }

            #nexus-drawer {
                position: fixed;
                top: 0;
                width: 360px;
                height: 100vh;
                background: rgba(0,0,0,0.92);
                backdrop-filter: blur(6px);
                border-right: 2px solid #00c8ff;
                box-shadow: 0 0 20px #00c8ff55;
                overflow: hidden;
                transform: translateX(-100%);
                transition: transform var(--drawer-transition) cubic-bezier(0.19, 1, 0.22, 1);
                pointer-events: auto;
            }

            #nexus-drawer.right {
                border-right: none;
                border-left: 2px solid #00c8ff;
                transform: translateX(100%);
            }

            .drawer-open-left { transform: translateX(0) !important; }
            .drawer-closed-left { transform: translateX(-100%) !important; }

            .drawer-open-right { transform: translateX(0) !important; }
            .drawer-closed-right { transform: translateX(100%) !important; }

            .drawer-header {
                padding: 12px;
                font-size: 18px;
                font-weight: bold;
                color: #00eaff;
                border-bottom: 1px solid #003f4f;
            }

            /* BASIC GRID NORMALIZATION */
            .tile-grid,
            .user-grid,
            .settings-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                padding: 8px;
            }

            @media (max-width: 768px) {
                #nexus-drawer { width: 100vw; }
                .nexus-btn { width: 44px; height: 44px; font-size: 18px; }
                .tile-grid,
                .user-grid,
                .settings-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;

        this.shadow.appendChild(style);
    }

    /* ============================================================
       TABS SETUP
       ============================================================ */
    buildTabs() {
        if (!this.tabsContainer) return;

        this.tabsContainer.innerHTML = `
            <button class="nexus-tab" data-tab="main">Main</button>
            <button class="nexus-tab" data-tab="chain">Chain</button>
            <button class="nexus-tab" data-tab="faction">Faction</button>
            <button class="nexus-tab" data-tab="enemy">Enemies</button>
            <button class="nexus-tab" data-tab="targets">Targets</button>
            <button class="nexus-tab" data-tab="colonel">Ask Colonel</button>
            <button class="nexus-tab" data-tab="settings">Settings</button>
        `;

        const buttons = this.tabsContainer.querySelectorAll(".nexus-tab");
        buttons.forEach(btn => {
            btn.addEventListener("click", () => {
                this.activeTab = btn.dataset.tab;
                this.renderActivePanel();
            });
        });
    }

    /* ============================================================
       PANELS SETUP
       ============================================================ */
    buildPanels() {
        if (!this.panelsContainer) return;

        this.panelsContainer.innerHTML = `
            <div id="panel-main"></div>
            <div id="panel-chain"></div>
            <div id="panel-faction"></div>
            <div id="panel-enemy"></div>
            <div id="panel-targets"></div>
            <div id="panel-colonel"></div>
            <div id="panel-settings"></div>
        `;

        this.renderActivePanel();
    }

    renderActivePanel() {
        const list = [
            "main", "chain", "faction", "enemy",
            "targets", "colonel", "settings"
        ];

        list.forEach(id => {
            const el = this.shadow.querySelector(`#panel-${id}`);
            if (!el) return;
            el.style.display = (id === this.activeTab) ? "block" : "none";
        });
    }

    /* ============================================================
       DRAWER / BUTTON LOGIC
       ============================================================ */
    attachButtonLogic() {
        if (!this.buttonEl) return;

        this.buttonEl.addEventListener("click", () => {
            if (this._isDragging || this.dragging) return;
            this.toggleDrawer();
        });

        this.buttonEl.style.bottom = this.buttonPosition.bottom + "px";
        this.buttonEl.style.left = this.buttonPosition.left + "px";
        this.buttonEl.style.top = "auto";
    }

    toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
        this.applyDrawerClasses();
    }

    updateDrawerSide() {
        if (!this.drawerEl) return;

        if (this.drawerSide === "left") {
            this.drawerEl.classList.remove("right");
            this.drawerEl.style.left = "0";
            this.drawerEl.style.right = "unset";
        } else {
            this.drawerEl.classList.add("right");
            this.drawerEl.style.right = "0";
            this.drawerEl.style.left = "unset";
        }

        this.applyDrawerClasses();
    }

    applyDrawerClasses() {
        if (!this.drawerEl) return;

        if (this.drawerSide === "left") {
            this.drawerEl.className = this.drawerOpen
                ? "drawer-open-left"
                : "drawer-closed-left";
        } else {
            this.drawerEl.className = this.drawerOpen
                ? "drawer-open-right"
                : "drawer-closed-right";
        }
    }

    /* ============================================================
       DRAGGING LOGIC (POLISHED)
       ============================================================ */
    attachDragLogic() {
        if (!this.buttonEl) return;

        let isDown = false;

        const start = (e) => {
            isDown = true;
            this.dragging = false;
            this._isDragging = false;

            const pt = e.touches ? e.touches[0] : e;
            const rect = this.buttonEl.getBoundingClientRect();
            this.dragOffsetX = pt.clientX - rect.left;
            this.dragOffsetY = pt.clientY - rect.top;
        };

        const move = (e) => {
            if (!isDown) return;

            const pt = e.touches ? e.touches[0] : e;

            this.dragging = true;
            this._isDragging = true;

            let x = pt.clientX - this.dragOffsetX;
            let y = pt.clientY - this.dragOffsetY;

            const clamped = this.clampButtonPosition(x, y);
            this.buttonEl.style.left = clamped.x + "px";
            this.buttonEl.style.top = clamped.y + "px";
            this.buttonEl.style.bottom = "auto";
        };

        const end = () => {
            if (!isDown) return;
            isDown = false;

            setTimeout(() => {
                this._isDragging = false;
            }, 120);
        };

        this.buttonEl.addEventListener("mousedown", start);
        this.buttonEl.addEventListener("touchstart", start, { passive: true });

        window.addEventListener("mousemove", move);
        window.addEventListener("touchmove", move, { passive: true });

        window.addEventListener("mouseup", end);
        window.addEventListener("touchend", end);
        window.addEventListener("touchcancel", end);
    }

    clampButtonPosition(x, y) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const rect = this.buttonEl.getBoundingClientRect();

        const maxX = w - rect.width - 8;
        const maxY = h - rect.height - 8;
        const minX = 8;
        const minY = 8;

        return {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        };
    }

    /* ============================================================
       ANIMATION PREFERENCES
       ============================================================ */
    applyAnimationPreferences() {
        let drawerTime = 0.32;
        let btnTime = 0.15;

        if (this.shadow) {
            const r = this.shadow.host || this.host;
            if (r && r.style) {
                r.style.setProperty("--drawer-transition", drawerTime + "s");
                r.style.setProperty("--button-transition", btnTime + "s");
            }
        }

        if (this.drawerEl) {
            this.drawerEl.style.transitionDuration = drawerTime + "s";
        }
        if (this.buttonEl) {
            this.buttonEl.style.transitionDuration = btnTime + "s";
        }
    }

    /* ============================================================
       SIZE LISTENER
       ============================================================ */
    attachResizeObserver() {
        window.addEventListener("resize", () => {
            this.updateDrawerSide();
        });
    }

    /* ============================================================
       INLINE SCANNER START (IMPLEMENTED LATER IN MSG 2/3)
       ============================================================ */
    startInlineScanner() {
        if (this.inlineScanner) clearInterval(this.inlineScanner);
        this.inlineScanner = setInterval(() => {
            this.scanAndAttachInlineButtons();
        }, 1000);
    }

    /* ============================================================
       SITREP ROUTER START (IMPLEMENTED IN MSG 3/3)
       ============================================================ */
    startSitrepRouter() {
        if (!this.general || !this.general.signals) return;

        this.general.signals.listen("SITREP_UPDATE", data => this.routeSitrep(data));
        this.general.signals.listen("TARGET_SCORES_READY", data => this.updateTargetScores(data));
        this.general.signals.listen("PLAYER_SITREP_READY", data => this.updateAnalyzeResult(data));
        this.general.signals.listen("GLOBAL_SITREP_READY", data => this.routeGlobalSitrep(data));
        this.general.signals.listen("FACTION_SITREP_READY", data => this.routeFactionSitrep(data));
        this.general.signals.listen("ASK_COLONEL_RESPONSE", data => this.updateColonelAnswer(data));
    }

    /* ============================================================
       OFFICER READY LISTENER
       ============================================================ */
    startOfficerReadyListener() {
        if (!this.general || !this.general.signals) return;

        const map = {
            "GENERAL_READY": "general",
            "LIEUTENANT_READY": "lieutenant",
            "SERGEANT_READY": "sergeant",
            "MAJOR_READY": "major",
            "COLONEL_READY": "colonel"
        };

        Object.keys(map).forEach(signal => {
            this.general.signals.listen(signal, () => {
                this.setOfficerOnline(map[signal]);
            });
        });
    }

    setOfficerOnline(name) {
        this.officerStatus[name] = "ONLINE";
        this.checkAllOfficersReady();
    }

    setOfficerOffline(name) {
        this.officerStatus[name] = "OFFLINE";
    }

    checkAllOfficersReady() {
        const all = Object.values(this.officerStatus).every(v => v === "ONLINE");
        if (!all) return;
        this.unlockUI();
    }

    unlockUI() {
        this.startInlineScanner();
    }

    /* ============================================================
       The remaining UI logic is in Messages 2/3 and 3/3…
       ============================================================ */

}

/* ============================================================
   REGISTER WITH GENERAL
   ============================================================ */
WAR_GENERAL.register("Major", Major);

    /* ============================================================
   PANEL RENDERING ENGINE
   ============================================================ */

    /* Main dispatcher */
    routeSitrep(sitrep) {
        if (!sitrep) return;

        if (sitrep.user) this.updateUserUI(sitrep.user);
        if (sitrep.factionMembers) this.renderFactionTable(sitrep.factionMembers);
        if (sitrep.enemyFactionMembers) this.renderEnemyTable(sitrep.enemyFactionMembers);
        if (sitrep.targets) this.renderTargetTables(sitrep.targets);
        if (sitrep.chain) this.updateChainUI(sitrep.chain);
        if (sitrep.chainLog) this.renderChainLog(sitrep.chainLog);
        if (sitrep.heatmaps) this.updateHeatmaps(sitrep.heatmaps);
    }


/* ============================================================
   BADGES + ICON RENDERERS
   ============================================================ */

    renderStatusBadge(status) {
        const s = String(status || "").toLowerCase();

        if (s.includes("hospital")) return `<span class="badge badge-hos">HOSP</span>`;
        if (s.includes("jail"))     return `<span class="badge badge-jail">JAIL</span>`;
        if (s.includes("travel"))   return `<span class="badge badge-travel">TRAVEL</span>`;
        if (s.includes("okay") || s.includes("online")) return `<span class="badge badge-ok">OK</span>`;
        return `<span class="badge badge-off">OFF</span>`;
    }

    renderThreatBadge(level) {
        if (level >= 80) return `<span class="badge badge-xtr">EXTREME</span>`;
        if (level >= 50) return `<span class="badge badge-hi">HIGH</span>`;
        if (level >= 25) return `<span class="badge badge-med">MED</span>`;
        return `<span class="badge badge-lo">LOW</span>`;
    }

    renderLevelBadge(level) {
        if (!level) return `<span class="badge badge-off">--</span>`;
        return `<span class="badge badge-lv">Lv ${level}</span>`;
    }

    renderFactionRankChip(rank) {
        if (!rank) return `<span class="badge badge-off">--</span>`;
        return `<span class="badge badge-rank">${rank}</span>`;
    }

    renderOnlineIndicator(type) {
        switch (String(type)) {
            case "online": return `<span class="dot dot-on"></span>`;
            case "recent": return `<span class="dot dot-recent"></span>`;
            case "danger": return `<span class="dot dot-danger"></span>`;
            default:        return `<span class="dot dot-off"></span>`;
        }
    }


/* ============================================================
   MAIN PANEL — DASHBOARD
   ============================================================ */
    updateUserUI(user) {
        const panel = this.shadow.querySelector("#panel-main");
        if (!panel || !user) return;

        panel.innerHTML = `
            <div class="tile-grid">

                <div class="tile">
                    <h3>Your Status</h3>
                    <p><b>Name:</b> ${user.name}</p>
                    <p><b>Level:</b> ${this.renderLevelBadge(user.level)}</p>
                    <p><b>Status:</b> ${this.renderStatusBadge(user.status)}</p>
                    <p><b>Last Seen:</b> ${user.lastSeen ? new Date(user.lastSeen).toLocaleString() : "--"}</p>
                </div>

                <div class="tile">
                    <h3>Threat</h3>
                    <p>${this.renderThreatBadge(user.threat)}</p>
                    <p><b>Risk:</b> ${(user.risk*100).toFixed(0)}%</p>
                    <p><b>Behavior:</b> ${user.cluster}</p>
                    <p><b>Predicted:</b> ${user.predictedBehavior}</p>
                </div>

                <div class="tile">
                    <h3>War Overview</h3>
                    <p><b>Enemy Online:</b> ${user.enemyOnline ?? "--"}</p>
                    <p><b>Enemy Hosp:</b> ${user.enemyHospital ?? "--"}</p>
                    <p><b>Danger:</b> ${user.danger ?? "--"}</p>
                </div>

                <div class="tile">
                    <h3>Heatmap</h3>
                    <canvas id="heatmap-main" width="300" height="100"></canvas>
                </div>

            </div>
        `;
    }


/* ============================================================
   FACTION TABLE
   ============================================================ */
    renderFactionTable(members) {
        const panel = this.shadow.querySelector("#panel-faction");
        if (!panel) return;

        let rows = members.map(m => `
            <tr>
                <td>${this.renderOnlineIndicator(m.onlineState)}</td>
                <td>${m.name}</td>
                <td>${this.renderLevelBadge(m.level)}</td>
                <td>${this.renderStatusBadge(m.status)}</td>
                <td>${this.renderFactionRankChip(m.rank)}</td>
                <td>${m.chainWatch ? `<span class="badge badge-ok">WATCH</span>` : `<span class="badge badge-off">OFF</span>`}</td>
            </tr>
        `).join("");

        panel.innerHTML = `
            <div class="tile">
                <h3>Your Faction Members</h3>
                <table class="nexus-table">
                    <thead>
                        <tr>
                            <th>On</th>
                            <th>Name</th>
                            <th>Lv</th>
                            <th>Status</th>
                            <th>Rank</th>
                            <th>Watch</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }


/* ============================================================
   ENEMY FACTION TABLE
   ============================================================ */
    renderEnemyTable(members) {
        const panel = this.shadow.querySelector("#panel-enemy");
        if (!panel) return;

        let rows = members.map(m => `
            <tr>
                <td>${this.renderOnlineIndicator(m.onlineState)}</td>
                <td>${m.name}</td>
                <td>${this.renderLevelBadge(m.level)}</td>
                <td>${this.renderStatusBadge(m.status)}</td>
                <td>
                    <span class="nib-att" data-id="${m.id}">⚔</span>
                </td>
            </tr>
        `).join("");

        panel.innerHTML = `
            <div class="tile">
                <h3>Enemy Faction Members</h3>
                <table class="nexus-table">
                    <thead>
                        <tr>
                            <th>On</th>
                            <th>Name</th>
                            <th>Lv</th>
                            <th>Status</th>
                            <th>Attack</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        this.attachAttackButtons(panel);
    }


/* ============================================================
   TARGETS PANEL WITH SUBTABS
   ============================================================ */
    renderTargetTables(targets) {
        const panel = this.shadow.querySelector("#panel-targets");
        if (!panel) return;

        panel.innerHTML = `
            <div class="target-subtabs">
                <button class="target-tab" data-sub="personal">Personal</button>
                <button class="target-tab" data-sub="war">War</button>
                <button class="target-tab" data-sub="shared">Shared</button>
            </div>
            <div id="target-content"></div>
        `;

        const subtabs = panel.querySelectorAll(".target-tab");
        subtabs.forEach(btn => {
            btn.addEventListener("click", () => {
                this.targetSubTab = btn.dataset.sub;
                this.renderTargetSubpanel(targets);
            });
        });

        this.renderTargetSubpanel(targets);
    }

    renderTargetSubpanel(targets) {
        const dest = this.shadow.querySelector("#target-content");
        if (!dest) return;

        const list = this.targetSubTab === "personal"
            ? targets.personal
            : this.targetSubTab === "war"
                ? targets.war
                : targets.shared;

        let rows = list.map(t => `
            <tr>
                <td>${this.renderOnlineIndicator(t.onlineState)}</td>
                <td>${t.name}</td>
                <td>${this.renderLevelBadge(t.level)}</td>
                <td>${this.renderStatusBadge(t.status)}</td>
                <td>${(t.colonelScore ?? 0).toFixed(2)}</td>
                <td><span class="nib-att" data-id="${t.id}">⚔</span></td>
                <td><span class="nib-ana" data-id="${t.id}">🔍</span></td>
                <td><span class="nib-add" data-id="${t.id}">➕</span></td>
            </tr>
        `).join("");

        dest.innerHTML = `
            <table class="nexus-table">
                <thead>
                    <tr>
                        <th>On</th>
                        <th>Name</th>
                        <th>Lv</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>A</th>
                        <th>Z</th>
                        <th>+</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        this.attachAttackButtons(dest);
        this.attachAnalyzeButtons(dest);
        this.attachAddTargetButtons(dest);
    }


/* ============================================================
   CHAIN PANEL
   ============================================================ */
    updateChainUI(chain) {
        const panel = this.shadow.querySelector("#panel-chain");
        if (!panel || !chain) return;

        panel.innerHTML = `
            <div class="tile-grid">
                <div class="tile">
                    <h3>Chain Status</h3>
                    <p><b>Hits:</b> ${chain.hits}</p>
                    <p><b>Timeout:</b> ${chain.timeLeft}s</p>
                    <p><b>Pace:</b> ${chain.currentPace}/min</p>
                    <p><b>Drop Risk:</b> ${chain.dropRisk}</p>
                </div>

                <div class="tile">
                    <h3>Alerts</h3>
                    <p>${chain.warning}</p>
                    <p>${chain.message}</p>
                </div>
            </div>
        `;
    }


/* ============================================================
   CHAIN LOG (simple)
   ============================================================ */
    renderChainLog(log) {
        const panel = this.shadow.querySelector("#panel-chain");
        if (!panel) return;

        const content = log.map(entry => `
            <div class="chain-log-entry">
                <b>${entry.player}</b> → +${entry.respect} respect
                <span class="time">${new Date(entry.time).toLocaleTimeString()}</span>
            </div>
        `).join("");

        const logBox = document.createElement("div");
        logBox.className = "tile";
        logBox.innerHTML = `
            <h3>Chain Log</h3>
            <div class="chain-log">${content}</div>
        `;

        panel.appendChild(logBox);
    }


/* ============================================================
   ASK THE COLONEL PANEL
   ============================================================ */
    addColonelMessage(side, msg) {
        const panel = this.shadow.querySelector("#panel-colonel");
        if (!panel) return;

        const box = panel.querySelector(".col-msgs");
        if (!box) return;

        const div = document.createElement("div");
        div.className = side === "colonel" ? "col-msg col-reply" : "col-msg col-user";
        div.textContent = msg;

        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    updateColonelAnswer(data) {
        if (!data || !data.answer) return;
        this.addColonelMessage("colonel", data.answer);
    }

    /* Build the Colonel UI initially */
    buildColonelPanel() {
        const panel = this.shadow.querySelector("#panel-colonel");
        if (!panel) return;

        panel.innerHTML = `
            <div class="tile">
                <h3>Ask the Colonel</h3>
                <div class="col-msgs"></div>
                <input id="col-input" type="text" placeholder="Ask a tactical question...">
                <button id="col-send">Send</button>
            </div>
        `;

        const input = panel.querySelector("#col-input");
        const send = panel.querySelector("#col-send");

        send.addEventListener("click", () => {
            const q = input.value.trim();
            if (!q) return;
            input.value = "";
            this.addColonelMessage("user", q);
            this.general.signals.dispatch("ASK_COLONEL", { question: q });
        });
    }


/* ============================================================
   SETTINGS PANEL
   ============================================================ */
    buildSettingsPanel() {
        const panel = this.shadow.querySelector("#panel-settings");
        if (!panel) return;

        panel.innerHTML = `
            <div class="settings-grid">

                <div class="tile">
                    <h3>Drawer Settings</h3>
                    <label>Side:
                        <select id="set-drawer-side">
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </label>
                </div>

                <div class="tile">
                    <h3>Animations</h3>
                    <label>Speed:
                        <select id="set-speed">
                            <option value="normal">Normal</option>
                            <option value="fast">Fast</option>
                            <option value="slow">Slow</option>
                        </select>
                    </label>
                    <label>
                        <input type="checkbox" id="set-anim"> Enable animations
                    </label>
                </div>

                <div class="tile">
                    <h3>Chain Alerts</h3>
                    <label>Critical (sec):
                        <input type="range" id="alert-critical" min="5" max="60" value="15">
                    </label>
                    <label>High (sec):
                        <input type="range" id="alert-high" min="10" max="120" value="30">
                    </label>
                    <label>Medium (sec):
                        <input type="range" id="alert-med" min="20" max="180" value="60">
                    </label>
                </div>

            </div>
        `;
    }


/* ============================================================
   ATTACK / ANALYZE / ADD TARGET EVENT BINDING
   ============================================================ */

    attachAttackButtons(container) {
        const btns = container.querySelectorAll(".nib-att");
        btns.forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                window.location.href = `/loader.php?sid=attack&user2ID=${id}`;
            });
        });
    }

    attachAnalyzeButtons(container) {
        const btns = container.querySelectorAll(".nib-ana");
        btns.forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.general.signals.dispatch("REQUEST_PLAYER_SITREP", { id });
            });
        });
    }

    attachAddTargetButtons(container) {
        const btns = container.querySelectorAll(".nib-add");
        btns.forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.general.signals.dispatch("ADD_TARGET", { id });
            });
        });
    }


/* ============================================================
   INLINE PROFILE OVERLAYS
   ============================================================ */

    scanAndAttachInlineButtons() {
        const links = document.querySelectorAll("a[href*='profiles.php?XID=']");

        links.forEach(link => {
            if (link.dataset.nexusEnhanced) return;

            const id = this.extractInlineId(link.href);
            if (!id) return;

            const box = document.createElement("span");
            box.className = "nexus-inline-buttons";
            box.innerHTML = `
                <span class="nib nib-attack" data-id="${id}">⚔</span>
                <span class="nib nib-analyze" data-id="${id}">🔍</span>
                <span class="nib nib-add" data-id="${id}">➕</span>
                <span class="nib nib-share" data-id="${id}">⇪</span>
            `;

            link.insertAdjacentElement("afterend", box);

            link.dataset.nexusEnhanced = "1";
            this.attachInlineEvents(box);
        });
    }

    extractInlineId(url) {
        const m = url.match(/XID=(\d+)/);
        return m ? m[1] : null;
    }

    attachInlineEvents(node) {
        if (!node) return;

        node.querySelectorAll(".nib-attack").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                window.location.href = `/loader.php?sid=attack&user2ID=${btn.dataset.id}`;
            });
        });

        node.querySelectorAll(".nib-analyze").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.general.signals.dispatch("REQUEST_PLAYER_SITREP", { id: btn.dataset.id });
            });
        });

        node.querySelectorAll(".nib-add").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.general.signals.dispatch("ADD_TARGET", { id: btn.dataset.id });
            });
        });
    }


/* ============================================================
   HEATMAP ENGINE (Canvas)
   ============================================================ */

    updateHeatmaps(data) {
        if (!data) return;

        const main = this.shadow.querySelector("#heatmap-main");
        if (main && data.onlineHeatmap) {
            this.drawHeatmap(main, data.onlineHeatmap);
        }
    }

    drawHeatmap(canvas, arr) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const bw = w / arr.length;

        ctx.clearRect(0, 0, w, h);

        const max = Math.max(...arr);

        arr.forEach((v, i) => {
            const pct = max ? v / max : 0;
            const col = `rgba(0, 200, 255, ${pct})`;

            ctx.fillStyle = col;
            ctx.fillRect(i * bw, 0, bw - 2, h);
        });
    }
    /* ============================================================
   SETTINGS: LOAD & SAVE
   ============================================================ */

    loadSettings() {
        try {
            return JSON.parse(localStorage.getItem("nexusSettings") || "{}");
        } catch(e) {
            console.warn("[MAJOR] Settings load failed:", e);
            return {};
        }
    }

    saveSettings(cfg) {
        try {
            localStorage.setItem("nexusSettings", JSON.stringify(cfg));
        } catch(e) {
            console.warn("[MAJOR] Settings save failed:", e);
        }
    }

    attachSettingsLogic() {
        const cfg = this.loadSettings();

        const sideEl   = this.shadow.querySelector("#set-drawer-side");
        const speedEl  = this.shadow.querySelector("#set-speed");
        const animEl   = this.shadow.querySelector("#set-anim");

        const cCrit = this.shadow.querySelector("#alert-critical");
        const cHigh = this.shadow.querySelector("#alert-high");
        const cMed  = this.shadow.querySelector("#alert-med");

        // Restore saved settings
        if (cfg.drawerSide) sideEl.value = cfg.drawerSide;
        if (cfg.speed)      speedEl.value = cfg.speed;
        animEl.checked = cfg.anim !== "off";

        if (cfg.alerts) {
            if (cfg.alerts.critical) cCrit.value = cfg.alerts.critical;
            if (cfg.alerts.high)     cHigh.value = cfg.alerts.high;
            if (cfg.alerts.medium)   cMed.value  = cfg.alerts.medium;
        }

        // Save on change
        const save = () => {
            const newCfg = {
                drawerSide: sideEl.value,
                speed: speedEl.value,
                anim: animEl.checked ? "on" : "off",
                alerts: {
                    critical: parseInt(cCrit.value, 10),
                    high: parseInt(cHigh.value, 10),
                    medium: parseInt(cMed.value, 10)
                }
            };
            this.saveSettings(newCfg);
            this.setDrawerSide(newCfg.drawerSide);
            this.applyAnimationPreferences();
        };

        sideEl.addEventListener("change", save);
        speedEl.addEventListener("change", save);
        animEl.addEventListener("change", save);
        cCrit.addEventListener("input", save);
        cHigh.addEventListener("input", save);
        cMed.addEventListener("input", save);
    }

    setDrawerSide(side) {
        this.drawerSide = side;
        this.updateDrawerSide();
    }


/* ============================================================
   TARGET PERSISTENCE & SHARED TARGETS
   ============================================================ */

    // Add to personal targets
    addToPersonalTargets(id) {
        this.general.signals.dispatch("ADD_TARGET", { id });
    }

    // Share to faction
    addToSharedTargets(target) {
        this.general.signals.dispatch("SHARED_TARGET_ADD", target);
    }


/* ============================================================
   SITREP ROUTER HELPERS
   ============================================================ */

    updateTargetScores(data) {
        if (!data || !data.scored) return;

        const targets = {
            personal: data.scored.filter(t => t.type === "personal"),
            war:      data.scored.filter(t => t.type === "war"),
            shared:   data.scored.filter(t => t.type === "shared")
        };

        this.renderTargetTables(targets);
    }

    routeGlobalSitrep(data) {
        if (!data) return;

        this.updateHeatmaps({
            onlineHeatmap: data.heatmap,
            statusHeatmap: data.statusHeatmap,
            attackHeatmap: data.attackHeatmap,
            anomalyHeatmap: data.anomalyHeatmap
        });
    }

    routeFactionSitrep(data) {
        if (!data) return;

        if (data.members) {
            this.renderFactionTable(data.members);
        }

        if (data.heatmap) {
            // optional additional heatmap for faction panel
            const canvas = this.shadow.querySelector("#heatmap-faction");
            if (canvas) this.drawHeatmap(canvas, data.heatmap);
        }
    }


/* ============================================================
   FINAL UI CONSTRUCTION CALLS
   ============================================================ */

    finalizeUI() {
        // Build Ask Colonel tab
        this.buildColonelPanel();

        // Build Settings
        this.buildSettingsPanel();
        this.attachSettingsLogic();
    }


/* ============================================================
   EXTENDED CSS: TABLES, BADGES, BUTTONS, COLONEL PANEL, ETC.
   ============================================================ */

    applyExtendedStyles() {
        if (!this.shadow) return;

        const style = document.createElement("style");
        style.textContent = `

            /* Tables */
            .nexus-table {
                width: 100%;
                border-collapse: collapse;
                background: rgba(0,0,0,0.4);
                font-size: 13px;
            }
            .nexus-table th {
                background: #00222b;
                color: #00eaff;
                text-align: left;
                padding: 4px;
                position: sticky;
                top: 0;
                z-index: 5;
            }
            .nexus-table td {
                padding: 4px;
                border-bottom: 1px solid #00303a;
                color: #cfeeff;
            }
            .nexus-table tr:hover {
                background: rgba(0,255,255,0.06);
            }

            /* Badges */
            .badge {
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
                color: #ffffff;
                display: inline-block;
                letter-spacing: 0.5px;
                text-shadow: 0 0 4px currentColor;
            }
            .badge-ok { background: #005f73; color: #00eaff; }
            .badge-off { background: #222; color: #888; }
            .badge-hos { background: #7a0019; color: #ff1744; }
            .badge-jail { background: #5f3b00; color: #ff9100; }
            .badge-travel { background: #704800; color: #ffca28; }
            .badge-lo { background: #003f5c; color: #a8dadc; }
            .badge-med { background: #665191; color: #ffca28; }
            .badge-hi { background: #bc5090; color: #ff6b6b; }
            .badge-xtr { background: #ff0000; }
            .badge-lv { background: #002b36; color: #00eaff; }
            .badge-rank { background: #1a0033; color: #c77dff; }

            /* Online dots */
            .dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                display: inline-block;
                box-shadow: 0 0 6px currentColor;
            }
            .dot-on { background: #00ff44; color: #00ff44; }
            .dot-recent { background: #ffd54f; color: #ffd54f; }
            .dot-danger { background: #ff0033; color: #ff0033; }
            .dot-off { background: #555; color: #555; }

            /* Inline overlay controls */
            .nexus-inline-buttons {
                display: inline-flex;
                gap: 4px;
                margin-left: 6px;
            }
            .nib {
                cursor: pointer;
                font-size: 12px;
                padding: 1px 4px;
                background: #001f28;
                border: 1px solid #00eaff;
                border-radius: 4px;
                color: #00eaff;
                transition: 0.15s ease;
            }
            .nib:hover {
                background: #00303d;
                transform: scale(1.15);
            }

            /* Colonel panel */
            #panel-colonel .tile {
                display: flex;
                flex-direction: column;
            }
            .col-msgs {
                background: #001015;
                border: 1px solid #003f4f;
                height: 200px;
                overflow-y: auto;
                padding: 8px;
                margin-bottom: 8px;
            }
            .col-msg {
                padding: 6px;
                margin-bottom: 6px;
                border-radius: 4px;
                font-size: 12px;
                line-height: 1.3;
            }
            .col-reply { background: #00252d; color: #00eaff; }
            .col-user  { background: #003f22; color: #66ff66; }

            #col-input {
                padding: 6px;
                background: #00161b;
                border: 1px solid #005a6b;
                color: white;
                margin-bottom: 6px;
                border-radius: 4px;
            }
            #col-send {
                background: #003542;
                color: #00eaff;
                padding: 6px;
                border: 1px solid #0099bb;
                border-radius: 4px;
                cursor: pointer;
            }
            #col-send:hover {
                background: #005a75;
            }

            /* Chain log */
            .chain-log {
                max-height: 200px;
                overflow-y: auto;
            }
            .chain-log-entry {
                padding: 4px;
                border-bottom: 1px solid #00303a;
                display: flex;
                justify-content: space-between;
            }
            .chain-log-entry .time {
                color: #7fdfff;
                font-size: 11px;
            }

        `;

        this.shadow.appendChild(style);
    }


/* ============================================================
   FINAL INITIALIZATION CALL (Trigger after all UI built)
   ============================================================ */

    buildTabs() {
        if (!this.tabsContainer) return;

        // existing tab code remains same…
        this.tabsContainer.innerHTML = `
            <button class="nexus-tab" data-tab="main">Main</button>
            <button class="nexus-tab" data-tab="chain">Chain</button>
            <button class="nexus-tab" data-tab="faction">Faction</button>
            <button class="nexus-tab" data-tab="enemy">Enemies</button>
            <button class="nexus-tab" data-tab="targets">Targets</button>
            <button class="nexus-tab" data-tab="colonel">Ask Colonel</button>
            <button class="nexus-tab" data-tab="settings">Settings</button>
        `;

        const btns = this.tabsContainer.querySelectorAll(".nexus-tab");
        btns.forEach(b => {
            b.addEventListener("click", () => {
                this.activeTab = b.dataset.tab;
                this.renderActivePanel();
            });
        });

        // After tabs are created and clickable, ensure extended CSS + additional panels load:
        this.applyExtendedStyles();
        this.finalizeUI();
    }
} 
})();
