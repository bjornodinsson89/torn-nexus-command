/**
 * WAR_MAJOR v3.2 — Final Commander Interface System
 * --------------------------------------------------
 * 

(function() {
    const Major = {
        // =========================
        // CORE STATE
        // =========================
        general: null,
        hostEl: null,
        root: null,
        drawerEl: null,
        toggleBtn: null,

        intervals: [],
        listeners: [],
        resizeObserver: null,

        drawerSide: "left", // user setting (left | right)
        drawerOpen: false,

        drawerWidth: 380,
        drawerHeight: window.innerHeight * 0.95,

        targets: { personal: [], war: [], shared: [] },
        factionMembers: {},
        warTargets: [],

        scoreHash: "", // For diff-checking

        settings: {
            apiKey: "",
            autoWatch: false,
            debug: false,
            drawerSide: "left",
            toggleBtnX: 20,
            toggleBtnY: 200
        },

        // =========================
        // INIT
        // =========================
        init(General) {
            // CLEAN PREVIOUS INSTANCES
            this.cleanup();

            this.general = General;

            // LOAD USER SETTINGS
            this.loadSettings();

            // CREATE HOST & SHADOW DOM
            this.createHost();
            this.createShadow();

            // CREATE TOGGLE BUTTON
            this.createToggleButton();

            // CREATE DRAWER
            this.createDrawer();

            // INIT PANELS & UI
            this.buildTabs();
            this.registerTabPanels();

            // REGISTER SIGNAL LISTENERS
            this.registerGeneralListeners();

            // READY
            console.log("%c[Major v3.2] Command Interface Online", "color:#0af");
        },

        // =========================
        // CLEANUP
        // =========================
        cleanup() {
            // Kill intervals
            this.intervals.forEach(id => clearInterval(id));
            this.intervals = [];

            // Remove signal listeners
            if (this.listeners.length) {
                this.listeners.forEach(unsub => { try { unsub(); } catch {} });
                this.listeners = [];
            }

            // Remove old root if exists
            if (this.hostEl && this.hostEl.parentNode) {
                this.hostEl.remove();
            }

            this.hostEl = null;
            this.root = null;
            this.drawerEl = null;
            this.toggleBtn = null;
        },

        // =========================
        // SETTINGS
        // =========================
        loadSettings() {
            try {
                const saved = JSON.parse(localStorage.getItem("major_v32_settings")) || {};
                Object.assign(this.settings, saved);
                this.drawerSide = this.settings.drawerSide;
            } catch(e){}
        },

        saveSettings() {
            localStorage.setItem("major_v32_settings", JSON.stringify(this.settings));
        },

        // =========================
        // HOST + SHADOW
        // =========================
        createHost() {
            const host = document.createElement("div");
            host.id = "war-major-host";
            document.body.appendChild(host);
            this.hostEl = host;
        },

        createShadow() {
            this.root = this.hostEl.attachShadow({ mode: "open" });
            this.injectStyles();
        },

        // =========================
        // STYLES
        // =========================
        injectStyles() {
            const style = document.createElement("style");
            style.textContent = `
                :host {
                    all: initial;
                    font-family: Arial, sans-serif;
                }

                /* Toggle Button */
                #war-toggle-btn {
                    position: fixed;
                    z-index: 100000000;
                    width: 46px;
                    height: 46px;
                    background: #1b1d22;
                    border: 1px solid #2f3138;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #eee;
                    font-size: 12px;
                    cursor: pointer;
                    box-shadow: 0 0 8px rgba(0,0,0,0.6);
                    user-select: none;
                }

                /* Drawer */
                #drawer {
                    position: fixed;
                    top: 0;
                    width: ${this.drawerWidth}px;
                    height: ${this.drawerHeight}px;
                    background: #1b1d22;
                    border: 1px solid #222;
                    box-shadow: 3px 0 10px rgba(0,0,0,0.6);
                    display: flex;
                    flex-direction: column;
                    z-index: 9999999;
                    transition: transform 0.25s ease;
                }

                #drawer.left {
                    left: 0;
                    transform: translateX(-100%);
                }
                #drawer.right {
                    right: 0;
                    transform: translateX(100%);
                }

                #drawer.open.left {
                    transform: translateX(0);
                }
                #drawer.open.right {
                    transform: translateX(0);
                }

                #drawer-header {
                    padding: 12px 14px;
                    background: #23252b;
                    border-bottom: 1px solid #2f3138;
                    font-size: 14px;
                    font-weight: 600;
                }

                /* Resize handles */
                #resize-handle-right {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 6px;
                    height: 100%;
                    cursor: ew-resize;
                    background: transparent;
                }
                #resize-handle-bottom {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 6px;
                    cursor: ns-resize;
                    background: transparent;
                }

                /* Tabs */
                #drawer-tabs {
                    display: flex;
                    background: #18191d;
                    border-bottom: 1px solid #2f3138;
                }
                .tab-btn {
                    flex: 1;
                    padding: 8px 4px;
                    text-align: center;
                    cursor: pointer;
                    font-size: 12px;
                    background: #18191d;
                    border-right: 1px solid #24262c;
                    color: #aaa;
                    user-select: none;
                }
                .tab-btn.active {
                    background: #292b31;
                    color: #fff;
                }

                #tab-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }
                .tab-panel { display: none; }

                /* Cards */
                .card {
                    background: #23252b;
                    border: 1px solid #2f3138;
                    padding: 10px;
                    margin-bottom: 12px;
                    border-radius: 4px;
                }
                .card-title {
                    font-weight: 600;
                    font-size: 13px;
                    margin-bottom: 8px;
                }
                .dash-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    padding: 2px 0;
                }

                .btn-sm {
                    font-size: 11px;
                    padding: 3px 6px;
                    border-radius: 3px;
                    border: 1px solid #3a3c42;
                    background: #2d2f34;
                    color: #ddd;
                    cursor: pointer;
                }
            `;
            this.root.appendChild(style);
        },

        // =========================
        // TOGGLE BUTTON
        // =========================
        createToggleButton() {
            const btn = document.createElement("div");
            btn.id = "war-toggle-btn";
            btn.textContent = "⚔️";

            btn.style.left = this.settings.toggleBtnX + "px";
            btn.style.top = this.settings.toggleBtnY + "px";

            this.toggleBtn = btn;
            this.root.appendChild(btn);

            this.makeToggleDraggable(btn);
            btn.addEventListener("click", () => this.toggleDrawer());
        },

        makeToggleDraggable(btn) {
            let drag = false;
            let offsetX = 0, offsetY = 0;

            const down = (e) => {
                drag = true;
                offsetX = e.clientX - btn.getBoundingClientRect().left;
                offsetY = e.clientY - btn.getBoundingClientRect().top;
                e.stopPropagation();
            };

            const move = (e) => {
                if (!drag) return;
                let x = e.clientX - offsetX;
                let y = e.clientY - offsetY;
                btn.style.left = x + "px";
                btn.style.top = y + "px";

                // Save immediately
                this.settings.toggleBtnX = x;
                this.settings.toggleBtnY = y;
                this.saveSettings();
            };

            const up = () => drag = false;

            btn.addEventListener("mousedown", down);
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        },

        toggleDrawer() {
            this.drawerOpen = !this.drawerOpen;
            if (this.drawerOpen) {
                this.drawerEl.classList.add("open");
            } else {
                this.drawerEl.classList.remove("open");
            }
        },

        // =========================
        // DRAWER
        // =========================
        createDrawer() {
            const drawer = document.createElement("div");
            drawer.id = "drawer";
            drawer.classList.add(this.drawerSide);

            drawer.style.width = this.drawerWidth + "px";
            drawer.style.height = this.drawerHeight + "px";

            drawer.innerHTML = `
                <div id="drawer-header">WAR ROOM</div>
                <div id="drawer-tabs"></div>
                <div id="tab-content"></div>

                <div id="resize-handle-right"></div>
                <div id="resize-handle-bottom"></div>
            `;

            this.drawerEl = drawer;
            this.root.appendChild(drawer);

            this.setupResizeHandles();
        },

        setupResizeHandles() {
            const rh = this.drawerEl.querySelector("#resize-handle-right");
            const bh = this.drawerEl.querySelector("#resize-handle-bottom");

            let resizingRight = false;
            let resizingBottom = false;

            rh.addEventListener("mousedown", () => resizingRight = true);
            bh.addEventListener("mousedown", () => resizingBottom = true);

            window.addEventListener("mousemove", (e) => {
                if (resizingRight) {
                    const newW = this.drawerSide === "left"
                        ? e.clientX
                        : window.innerWidth - e.clientX;
                    this.drawerWidth = Math.max(250, newW);
                    this.drawerEl.style.width = this.drawerWidth + "px";
                }
                if (resizingBottom) {
                    const newH = e.clientY;
                    this.drawerHeight = Math.max(300, newH);
                    this.drawerEl.style.height = this.drawerHeight + "px";
                }
            });

            window.addEventListener("mouseup", () => {
                resizingRight = false;
                resizingBottom = false;
            });
        },

        // =========================
        // TABS
        // =========================
        buildTabs() {
            const tabBar = this.drawerEl.querySelector("#drawer-tabs");
            const content = this.drawerEl.querySelector("#tab-content");

            this.elements = {
                tabButtons: {},
                tabPanels: {}
            };

            const tabs = [
                ["overview", "Overview"],
                ["targets", "Targets"],
                ["faction", "Faction"],
                ["war", "War"],
                ["chain", "Chain"],
                ["ai", "AI"],
                ["settings", "Settings"]
            ];

            tabs.forEach(([id, label]) => {
                const btn = document.createElement("div");
                btn.className = "tab-btn";
                btn.textContent = label;
                btn.dataset.tab = id;

                const panel = document.createElement("div");
                panel.className = "tab-panel";
                panel.dataset.tab = id;

                tabBar.appendChild(btn);
                content.appendChild(panel);

                this.elements.tabButtons[id] = btn;
                this.elements.tabPanels[id] = panel;

                btn.addEventListener("click", () => this.switchTab(id));
            });

            this.switchTab("overview");
        },

        switchTab(id) {
            Object.keys(this.elements.tabPanels).forEach(key => {
                const p = this.elements.tabPanels[key];
                const b = this.elements.tabButtons[key];
                p.style.display = (key === id ? "block" : "none");
                b.classList.toggle("active", key === id);
            });
        },

        // =========================
        // REGISTER PANELS
        // =========================
        registerTabPanels() {
            this.buildOverviewPanel();
            this.buildTargetsPanel();
            this.buildFactionPanel();
            this.buildWarPanel();
            this.buildChainPanel();
            this.buildAIPanel();
            this.buildSettingsPanel();
        },

        // =========================
        // PANEL — OVERVIEW
        // =========================
        buildOverviewPanel() {
            const p = this.elements.tabPanels.overview;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Commander Status</div>
                    <div class="dash-row"><span>Energy</span><span id="ov-energy">0</span></div>
                    <div class="dash-row"><span>Nerve</span><span id="ov-nerve">0</span></div>
                    <div class="dash-row"><span>Life</span><span id="ov-life">0</span></div>
                    <div class="dash-row"><span>Status</span><span id="ov-status">Unknown</span></div>
                    <div class="dash-row"><span>Cooldown</span><span id="ov-cd">0s</span></div>
                </div>

                <div class="card">
                    <div class="card-title">Faction Summary</div>
                    <div class="dash-row"><span>Online</span><span id="ov-f-on">0</span></div>
                    <div class="dash-row"><span>Watchers</span><span id="ov-f-watch">0</span></div>
                    <div class="dash-row"><span>Hospital</span><span id="ov-f-hosp">0</span></div>
                    <div class="dash-row"><span>Jail</span><span id="ov-f-jail">0</span></div>
                </div>

                <div class="card">
                    <div class="card-title">War Summary</div>
                    <div class="dash-row"><span>Enemy Online</span><span id="ov-w-on">0</span></div>
                    <div class="dash-row"><span>Threat</span><span id="ov-w-threat">0</span></div>
                    <div class="dash-row"><span>Danger</span><span id="ov-w-danger">Low</span></div>
                </div>

                <div class="card">
                    <div class="card-title">Chain Summary</div>
                    <div class="dash-row"><span>Hits</span><span id="ov-c-hits">0</span></div>
                    <div class="dash-row"><span>Time Left</span><span id="ov-c-time">0s</span></div>
                    <div class="dash-row"><span>Pace</span><span id="ov-c-pace">0/min</span></div>
                    <div class="dash-row"><span>Risk</span><span id="ov-c-risk">Unknown</span></div>
                </div>
            `;

            // Save references for fast updates
            this.ov = {
                energy: p.querySelector("#ov-energy"),
                nerve: p.querySelector("#ov-nerve"),
                life: p.querySelector("#ov-life"),
                status: p.querySelector("#ov-status"),
                cd: p.querySelector("#ov-cd"),

                f_on: p.querySelector("#ov-f-on"),
                f_watch: p.querySelector("#ov-f-watch"),
                f_hosp: p.querySelector("#ov-f-hosp"),
                f_jail: p.querySelector("#ov-f-jail"),

                w_on: p.querySelector("#ov-w-on"),
                w_threat: p.querySelector("#ov-w-threat"),
                w_danger: p.querySelector("#ov-w-danger"),

                c_hits: p.querySelector("#ov-c-hits"),
                c_time: p.querySelector("#ov-c-time"),
                c_pace: p.querySelector("#ov-c-pace"),
                c_risk: p.querySelector("#ov-c-risk")
            };
        },

        // =========================
        // PANEL — TARGETS
        // =========================
        buildTargetsPanel() {
            const p = this.elements.tabPanels.targets;
            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Targets</div>
                    <table id="targets-table">
                        <thead>
                            <tr>
                                <th>On</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Score</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;
            this.targetsTable = p.querySelector("#targets-table tbody");
        },

        // =========================
        // PANEL — FACTION
        // =========================
        buildFactionPanel() {
            const p = this.elements.tabPanels.faction;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Faction Roster</div>
                    <table id="faction-table">
                        <thead>
                            <tr>
                                <th>On</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Watcher</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            this.factionTable = p.querySelector("#faction-table tbody");
        },

        // =========================
        // PANEL — WAR
        // =========================
        buildWarPanel() {
            const p = this.elements.tabPanels.war;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Enemy Faction Status</div>
                    <div class="dash-row"><span>Online</span><span id="war-on">0</span></div>
                    <div class="dash-row"><span>Hospital</span><span id="war-hosp">0</span></div>
                    <div class="dash-row"><span>Jail</span><span id="war-jail">0</span></div>
                    <div class="dash-row"><span>Travel</span><span id="war-travel">0</span></div>
                    <div class="dash-row"><span>Threat</span><span id="war-threat">0</span></div>
                    <div class="dash-row"><span>Danger</span><span id="war-danger">Low</span></div>
                </div>

                <div class="card">
                    <div class="card-title">High Value Targets</div>
                    <table id="war-targets">
                        <thead>
                            <tr>
                                <th>Score</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            this.warEls = {
                on: p.querySelector("#war-on"),
                hosp: p.querySelector("#war-hosp"),
                jail: p.querySelector("#war-jail"),
                travel: p.querySelector("#war-travel"),
                threat: p.querySelector("#war-threat"),
                danger: p.querySelector("#war-danger"),
                table: p.querySelector("#war-targets tbody")
            };
        },

        // =========================
        // PANEL — CHAIN
        // =========================
        buildChainPanel() {
            const p = this.elements.tabPanels.chain;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Chain Status</div>
                    <div class="dash-row"><span>Hits</span><span id="chain-hits">0</span></div>
                    <div class="dash-row"><span>Time Left</span><span id="chain-time">0s</span></div>
                    <div class="dash-row"><span>Pace</span><span id="chain-pace">0/min</span></div>
                    <div class="dash-row"><span>Risk</span><span id="chain-risk">Unknown</span></div>
                </div>

                <button id="chain-settings-btn" class="btn-sm">Chain Settings</button>

                <div id="chain-settings-panel" style="display:none; margin-top:10px;" class="card">
                    <div class="card-title">Chain Configuration</div>
                    <div class="dash-row">
                        <span>Drop Warning Threshold (seconds)</span>
                        <input id="chain-threshold" type="number" style="width:80px;">
                    </div>
                    <button id="chain-save" class="btn-sm">Save</button>
                </div>
            `;

            const btn = p.querySelector("#chain-settings-btn");
            const panel = p.querySelector("#chain-settings-panel");

            btn.addEventListener("click", () => {
                panel.style.display = panel.style.display === "none" ? "block" : "none";
            });

            this.chainEls = {
                hits: p.querySelector("#chain-hits"),
                time: p.querySelector("#chain-time"),
                pace: p.querySelector("#chain-pace"),
                risk: p.querySelector("#chain-risk")
            };
        },

        // =========================
        // PANEL — AI
        // =========================
        buildAIPanel() {
            const p = this.elements.tabPanels.ai;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">AI Command Interface</div>
                    <p>Future integration point for Commander AI panels.</p>
                </div>
            `;
        },

        // =========================
        // PANEL — SETTINGS
        // =========================
        buildSettingsPanel() {
            const p = this.elements.tabPanels.settings;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Drawer Settings</div>
                    <div class="dash-row">
                        <span>Drawer Side</span>
                        <select id="set-drawer-side">
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">API Configuration</div>
                    <div class="dash-row">
                        <span>Your API Key</span>
                        <input id="set-api-key" type="password" placeholder="API Key" style="width:170px;">
                    </div>
                    <button id="set-save-api" class="btn-sm">Save</button>
                </div>
            `;

            const side = p.querySelector("#set-drawer-side");
            side.value = this.settings.drawerSide;

            side.addEventListener("change", () => {
                this.settings.drawerSide = side.value;
                this.saveSettings();
                this.drawerSide = side.value;
                this.rebuildDrawer();
            });

            p.querySelector("#set-save-api").addEventListener("click", () => {
                const key = p.querySelector("#set-api-key").value.trim();
                this.settings.apiKey = key;
                this.saveSettings();

                try {
                    if (this.general.intel && this.general.intel.setCredentials) {
                        this.general.intel.setCredentials(key);
                    }
                } catch(e){}
            });
        },

        rebuildDrawer() {
            // Close then recreate side
            this.drawerEl.remove();
            this.createDrawer();
            this.buildTabs();
            this.registerTabPanels();
        },

        // =========================
        // LISTENERS
        // =========================
        registerGeneralListeners() {
            const G = this.general;

            // Utility to wrap listeners + allow unsubscribe
            const listen = (ev, fn) => {
                G.signals.listen(ev, fn);
                // No native unsubscribe in your bus — so we wrap manually
                const unsub = () => {
                    const arr = G.signals._internal?.[ev];
                    if (!arr) return;
                    const idx = arr.indexOf(fn);
                    if (idx >= 0) arr.splice(idx, 1);
                };
                this.listeners.push(unsub);
            };

            // USER SITREP
            listen("USER_SITREP", data => {
                this.ov.energy.textContent = data.energy ?? 0;
                this.ov.nerve.textContent = data.nerve ?? 0;
                this.ov.life.textContent = data.life ?? 0;
                this.ov.status.textContent = data.status ?? "Unknown";
                this.ov.cd.textContent = this.formatMs((data.cooldown || 0) * 1000);
            });

            // FACTION SITREP
            listen("FACTION_SITREP", data => {
                this.ov.f_on.textContent = data.online ?? 0;
                this.ov.f_watch.textContent = data.watchers ?? 0;
                this.ov.f_hosp.textContent = data.hospital ?? 0;
                this.ov.f_jail.textContent = data.jail ?? 0;
            });

            // CHAIN SITREP
            listen("CHAIN_SITREP", data => {
                this.ov.c_hits.textContent = data.hits ?? 0;
                this.ov.c_time.textContent = this.formatMs((data.timeLeft || 0) * 1000);
                this.ov.c_pace.textContent = `${data.currentPace || 0}/min`;
                this.ov.c_risk.textContent = data.dropRisk || "Unknown";

                this.chainEls.hits.textContent = data.hits ?? 0;
                this.chainEls.time.textContent = this.formatMs((data.timeLeft || 0) * 1000);
                this.chainEls.pace.textContent = `${data.currentPace || 0}/min`;
                this.chainEls.risk.textContent = data.dropRisk || "Unknown";
            });

            // WAR SITREP
            listen("WAR_SITREP", data => {
                this.ov.w_on.textContent = data.enemyOnline ?? 0;
                this.ov.w_threat.textContent = data.threat ?? 0;
                this.ov.w_danger.textContent = data.danger ?? "Low";

                this.warEls.on.textContent = data.enemyOnline ?? 0;
                this.warEls.hosp.textContent = data.enemyHospital ?? 0;
                this.warEls.jail.textContent = data.enemyJail ?? 0;
                this.warEls.travel.textContent = data.enemyTravel ?? 0;
                this.warEls.threat.textContent = data.threat ?? 0;
                this.warEls.danger.textContent = data.danger ?? "Low";

                if (data.targets) {
                    const ids = data.targets.map(t => t.id).join(",");
                    if (this.scoreHash !== ids) {
                        this.scoreHash = ids;
                        this.requestScores(data.targets);
                    }
                    this.warTargets = data.targets;
                    this.renderWarTargets();
                }
            });

            // TARGET SCORES
            listen("TARGET_SCORES_READY", ({ scored }) => {
                scored.forEach(t => {
                    const tgt = this.warTargets.find(x => String(x.id) === String(t.id));
                    if (tgt) tgt.score = t.colonelScore;
                });
                this.renderWarTargets();
            });
        },

        // =========================
        // SCORING
        // =========================
        requestScores(list) {
            if (!list || !list.length) return;
            this.general.signals.dispatch("REQUEST_TARGET_SCORES", { targets: list });
        },

        // =========================
        // RENDER FUNCTIONS
        // =========================
        formatMs(ms) {
            const t = Number(ms);
            if (isNaN(t) || t <= 0) return "0s";
            const s = Math.floor(t / 1000);
            const m = Math.floor(s / 60);
            const ss = s % 60;
            return m > 0 ? `${m}m ${ss}s` : `${ss}s`;
        },

        renderWarTargets() {
            const tbody = this.warEls.table;
            tbody.innerHTML = "";

            const list = [...this.warTargets].sort((a, b) => (b.score || 0) - (a.score || 0));

            list.forEach(t => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${t.score || 0}</td>
                    <td>${t.name}</td>
                    <td>${t.level || ""}</td>
                    <td>${t.status || "Okay"}</td>
                    <td>${this.formatMs(t.timer)}</td>
                    <td><button class="btn-sm" data-id="${t.id}" data-act="attack">Attack</button></td>
                `;
                tbody.appendChild(tr);
            });
        }
    };

    if (window.WAR_GENERAL) {
        WAR_GENERAL.register("Major", Major);
    } else {
        console.warn("[MAJOR v3.2] WAR_GENERAL not detected.");
    }
})();
