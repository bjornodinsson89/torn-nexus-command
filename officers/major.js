/**
 * WAR_MAJOR v3.2.1 — Final Deployment Build
 * GUI Officer — Full Slide-Out Drawer, Reinit Safe, Polished UI
 */

(function () {

    const Major = {
        general: null,

        // internal state
        host: null,
        root: null,
        drawer: null,
        toggleBtn: null,
        intervals: [],
        listeners: [],
        settings: {
            drawerSide: "left",
            toggleX: 18,
            toggleY: 200,
        },

        // data caches
        factionMembers: {},
        warTargets: [],
        targets: { personal: [], war: [], shared: [] },
        scoreHash: "",

        init(General) {
            this.cleanup();
            this.general = General;

            this.loadSettings();
            this.createHost();
            this.createShadow();
            this.createToggleButton();
            this.createDrawer();
            this.buildTabs();
            this.buildAllPanels();
            this.wireGeneralSignals();

            console.log("%c[Major v3.2.1] GUI Online", "color:#0af");
        },

        /* --------------------------
           CLEANUP & SAFE-REINIT
        --------------------------- */
        cleanup() {
            // remove intervals
            this.intervals.forEach(id => clearInterval(id));
            this.intervals = [];

            // remove listeners
            this.listeners.forEach(u => { try { u(); } catch {} });
            this.listeners = [];

            // remove host if exists
            if (this.host && this.host.parentNode) {
                this.host.remove();
            }

            this.host = null;
            this.root = null;
            this.drawer = null;
            this.toggleBtn = null;
        },

        /* --------------------------
           SETTINGS
        --------------------------- */
        loadSettings() {
            try {
                const d = JSON.parse(localStorage.getItem("major_v321_settings")) || {};
                Object.assign(this.settings, d);
            } catch {}
        },

        saveSettings() {
            localStorage.setItem("major_v321_settings", JSON.stringify(this.settings));
        },

        /* --------------------------
           HOST + SHADOW DOM
        --------------------------- */
        createHost() {
            const el = document.createElement("div");
            el.id = "war-major-host";
            document.body.appendChild(el);
            this.host = el;
        },

        createShadow() {
            this.root = this.host.attachShadow({ mode: "open" });
            this.injectStyles();
        },

        /* --------------------------
           TOGGLE BUTTON
        --------------------------- */
        createToggleButton() {
            const btn = document.createElement("div");
            btn.id = "war-toggle-btn";
            btn.textContent = "⚔️";
            btn.style.left = this.settings.toggleX + "px";
            btn.style.top = this.settings.toggleY + "px";

            this.toggleBtn = btn;
            this.root.appendChild(btn);

            this.makeDraggable(btn);

            btn.addEventListener("click", (e) => {
                if (this._dragging) return;
                this.toggleDrawer();
            });
        },

        toggleDrawer() {
            if (!this.drawer) return;
            this.drawer.classList.toggle("open");
        },

        makeDraggable(btn) {
            let dragging = false;
            let offsetX = 0, offsetY = 0;

            btn.addEventListener("mousedown", e => {
                dragging = true;
                this._dragging = false;
                offsetX = e.clientX - btn.getBoundingClientRect().left;
                offsetY = e.clientY - btn.getBoundingClientRect().top;
            });

            window.addEventListener("mousemove", e => {
                if (!dragging) return;
                this._dragging = true; // distinguish drag vs click

                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;

                btn.style.left = x + "px";
                btn.style.top = y + "px";

                this.settings.toggleX = x;
                this.settings.toggleY = y;
                this.saveSettings();
            });

            window.addEventListener("mouseup", () => dragging = false);
        },

        /* --------------------------
           DRAWER
        --------------------------- */
        createDrawer() {
            const drawer = document.createElement("div");
            drawer.id = "drawer";
            drawer.classList.add(this.settings.drawerSide);

            drawer.innerHTML = `
                <div id="drawer-header">WAR ROOM</div>
                <div id="drawer-tabs"></div>
                <div id="tab-content"></div>
                <div id="resize-right"></div>
                <div id="resize-bottom"></div>
            `;

            this.drawer = drawer;
            this.root.appendChild(drawer);

            this.setupResizeHandles(drawer);
        },

        setupResizeHandles(drawer) {
            const rh = drawer.querySelector("#resize-right");
            const bh = drawer.querySelector("#resize-bottom");
            let resizingR = false, resizingB = false;

            rh.addEventListener("mousedown", () => resizingR = true);
            bh.addEventListener("mousedown", () => resizingB = true);

            window.addEventListener("mousemove", e => {
                if (resizingR) {
                    drawer.style.width = e.clientX + "px";
                }
                if (resizingB) {
                    drawer.style.height = e.clientY + "px";
                }
            });

            window.addEventListener("mouseup", () => {
                resizingR = false;
                resizingB = false;
            });
        },

        /* --------------------------
           TABS
        --------------------------- */
        buildTabs() {
            this.tabs = {
                order: ["overview", "targets", "faction", "war", "chain", "ai", "settings"],
                labels: {
                    overview: "Overview",
                    targets: "Targets",
                    faction: "Faction",
                    war: "War",
                    chain: "Chain",
                    ai: "AI",
                    settings: "Settings"
                },
                buttons: {},
                panels: {}
            };

            const tabBar = this.drawer.querySelector("#drawer-tabs");
            const tabContent = this.drawer.querySelector("#tab-content");

            this.tabs.order.forEach(id => {
                const btn = document.createElement("div");
                btn.className = "tab-btn";
                btn.dataset.tab = id;
                btn.textContent = this.tabs.labels[id];
                tabBar.appendChild(btn);
                this.tabs.buttons[id] = btn;

                const panel = document.createElement("div");
                panel.className = "tab-panel";
                panel.dataset.tab = id;
                tabContent.appendChild(panel);
                this.tabs.panels[id] = panel;

                btn.addEventListener("click", () => this.switchTab(id));
            });

            this.switchTab("overview");
        },

        switchTab(id) {
            Object.keys(this.tabs.panels).forEach(key => {
                const p = this.tabs.panels[key];
                const b = this.tabs.buttons[key];
                const active = key === id;
                p.style.display = active ? "block" : "none";
                b.classList.toggle("active", active);
            });
        },

        /* --------------------------
           PANELS (build all content)
        --------------------------- */
        buildAllPanels() {
            this.buildOverview();
            this.buildTargets();
            this.buildFaction();
            this.buildWar();
            this.buildChain();
            this.buildAI();
            this.buildSettings();
        },

        /* --------------------------
           OVERVIEW PANEL
        --------------------------- */
        buildOverview() {
            const p = this.tabs.panels.overview;
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
                c_risk: p.querySelector("#ov-c-risk"),
            };
        },

        /* --------------------------
           TARGETS PANEL
        --------------------------- */
        buildTargets() {
            const p = this.tabs.panels.targets;
            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Targets</div>
                    <table id="t-table">
                        <thead>
                            <tr>
                                <th>On</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Score</th>
                                <th>Act</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;
            this.tBody = p.querySelector("#t-table tbody");
        },

        /* --------------------------
           FACTION PANEL
        --------------------------- */
        buildFaction() {
            const p = this.tabs.panels.faction;
            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Faction Roster</div>
                    <table id="f-table">
                        <thead>
                            <tr>
                                <th>On</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Watch</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;
            this.fBody = p.querySelector("#f-table tbody");
        },

        /* --------------------------
           WAR PANEL
        --------------------------- */
        buildWar() {
            const p = this.tabs.panels.war;
            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Enemy Faction</div>
                    <div class="dash-row"><span>Online</span><span id="war-on">0</span></div>
                    <div class="dash-row"><span>Hospital</span><span id="war-hosp">0</span></div>
                    <div class="dash-row"><span>Jail</span><span id="war-jail">0</span></div>
                    <div class="dash-row"><span>Travel</span><span id="war-travel">0</span></div>
                    <div class="dash-row"><span>Threat</span><span id="war-threat">0</span></div>
                    <div class="dash-row"><span>Danger</span><span id="war-danger">Low</span></div>
                </div>

                <div class="card">
                    <div class="card-title">High Value Targets</div>
                    <table id="war-table">
                        <thead>
                            <tr>
                                <th>Score</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Act</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            this.wEls = {
                on: p.querySelector("#war-on"),
                hosp: p.querySelector("#war-hosp"),
                jail: p.querySelector("#war-jail"),
                travel: p.querySelector("#war-travel"),
                threat: p.querySelector("#war-threat"),
                danger: p.querySelector("#war-danger"),
                tbody: p.querySelector("#war-table tbody"),
            };
        },

        /* --------------------------
           CHAIN PANEL
        --------------------------- */
        buildChain() {
            const p = this.tabs.panels.chain;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Chain Status</div>
                    <div class="dash-row"><span>Hits</span><span id="ch-hits">0</span></div>
                    <div class="dash-row"><span>Time Left</span><span id="ch-time">0s</span></div>
                    <div class="dash-row"><span>Pace</span><span id="ch-pace">0/min</span></div>
                    <div class="dash-row"><span>Risk</span><span id="ch-risk">Unknown</span></div>
                </div>

                <button id="ch-set-btn" class="btn-sm">Chain Settings</button>

                <div id="ch-panel" class="card" style="display:none; margin-top:10px;">
                    <div class="card-title">Chain Configuration</div>
                    <div class="dash-row">
                        <span>Drop Warning Threshold (secs)</span>
                        <input id="ch-threshold" type="number" value="30" style="width:70px;">
                    </div>
                    <button id="ch-save" class="btn-sm">Save</button>
                </div>
            `;

            const btn = p.querySelector("#ch-set-btn");
            const panel = p.querySelector("#ch-panel");

            btn.addEventListener("click", () => {
                panel.style.display = panel.style.display === "none" ? "block" : "none";
            });

            this.chEls = {
                hits: p.querySelector("#ch-hits"),
                time: p.querySelector("#ch-time"),
                pace: p.querySelector("#ch-pace"),
                risk: p.querySelector("#ch-risk"),
                thresholdInput: p.querySelector("#ch-threshold")
            };

            p.querySelector("#ch-save").addEventListener("click", () => {
                alert("Chain settings saved.");
            });
        },

        /* --------------------------
           AI PANEL
        --------------------------- */
        buildAI() {
            const p = this.tabs.panels.ai;
            p.innerHTML = `
                <div class="card">
                    <div class="card-title">AI Interface</div>
                    <p>The Warrant Officer AI will be added here.</p>
                </div>
            `;
        },

        /* --------------------------
           SETTINGS PANEL
        --------------------------- */
        buildSettings() {
            const p = this.tabs.panels.settings;

            p.innerHTML = `
                <div class="card">
                    <div class="card-title">Drawer Settings</div>
                    <div class="dash-row">
                        <span>Side</span>
                        <select id="set-side">
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </div>
            `;

            const side = p.querySelector("#set-side");
            side.value = this.settings.drawerSide;

            side.addEventListener("change", () => {
                this.settings.drawerSide = side.value;
                this.saveSettings();
                this.redrawDrawerSide();
            });
        },

        redrawDrawerSide() {
            if (!this.drawer) return;
            this.drawer.classList.remove("left", "right");
            this.drawer.classList.add(this.settings.drawerSide);
        },

        /* --------------------------
           SIGNAL LISTENERS
        --------------------------- */
        wireGeneralSignals() {
            const G = this.general;

            // USER SITREP
            this.listeners.push(G.signals.listen("USER_SITREP", data => {
                this.ov.energy.textContent = data.energy;
                this.ov.nerve.textContent = data.nerve;
                this.ov.life.textContent = data.life;
                this.ov.status.textContent = data.status;
                this.ov.cd.textContent = this.formatMs(data.cooldown * 1000);
            }));

            // FACTION
            this.listeners.push(G.signals.listen("FACTION_SITREP", data => {
                this.ov.f_on.textContent = data.online;
                this.ov.f_watch.textContent = data.watchers;
                this.ov.f_hosp.textContent = data.hospital;
                this.ov.f_jail.textContent = data.jail;

                this.updateFactionTable(data);
            }));

            // CHAIN
            this.listeners.push(G.signals.listen("CHAIN_SITREP", data => {
                this.ov.c_hits.textContent = data.hits;
                this.ov.c_time.textContent = this.formatMs(data.timeLeft * 1000);
                this.ov.c_pace.textContent = `${data.currentPace}/min`;
                this.ov.c_risk.textContent = data.dropRisk;

                this.chEls.hits.textContent = data.hits;
                this.chEls.time.textContent = this.formatMs(data.timeLeft * 1000);
                this.chEls.pace.textContent = `${data.currentPace}/min`;
                this.chEls.risk.textContent = data.dropRisk;
            }));

            // WAR SITREP
            this.listeners.push(G.signals.listen("WAR_SITREP", data => {
                this.ov.w_on.textContent = data.enemyOnline;
                this.ov.w_threat.textContent = data.threat;
                this.ov.w_danger.textContent = data.danger;

                this.wEls.on.textContent = data.enemyOnline;
                this.wEls.hosp.textContent = data.enemyHospital;
                this.wEls.jail.textContent = data.enemyJail;
                this.wEls.travel.textContent = data.enemyTravel;
                this.wEls.threat.textContent = data.threat;
                this.wEls.danger.textContent = data.danger;

                const ids = data.targets.map(t => t.id).join(",");
                if (ids !== this.scoreHash) {
                    this.scoreHash = ids;
                    this.general.signals.dispatch("REQUEST_TARGET_SCORES", { targets: data.targets });
                }

                this.warTargets = data.targets;
                this.renderWarTargets();
            }));

            // SCORES
            this.listeners.push(G.signals.listen("TARGET_SCORES_READY", ({ scored }) => {
                scored.forEach(s => {
                    const tgt = this.warTargets.find(x => String(x.id) === String(s.id));
                    if (tgt) tgt.colonelScore = s.colonelScore;
                });
                this.renderWarTargets();
            }));
        },

        /* --------------------------
           RENDER HELPERS
        --------------------------- */
        formatMs(ms) {
            const n = Number(ms);
            if (isNaN(n) || n <= 0) return "0s";
            const s = Math.floor(n / 1000);
            const m = Math.floor(s / 60);
            const ss = s % 60;
            return m > 0 ? `${m}m ${ss}s` : `${ss}s`;
        },

        /* --------------------------
           FACTION TABLE RENDER
        --------------------------- */
        updateFactionTable(data) {
            const tbody = this.fBody;
            tbody.innerHTML = "";

            const now = Date.now();

            const mem = this.general.factionMembers || data.members || {};
            Object.values(mem).forEach(m => {
                const row = document.createElement("tr");
                const online = (now - (m.lastSeen || 0)) < 600000;

                row.innerHTML = `
                    <td>${online ? "●" : "○"}</td>
                    <td>${m.name}</td>
                    <td>${m.level}</td>
                    <td>${m.status || "Okay"}</td>
                    <td>${this.formatMs((m.until || 0) - now)}</td>
                    <td>${m.watching ? "👁️" : "-"}</td>
                `;

                tbody.appendChild(row);
            });
        },

        /* --------------------------
           WAR TARGETS RENDER
        --------------------------- */
        renderWarTargets() {
            const tbody = this.wEls.tbody;
            tbody.innerHTML = "";

            const list = [...this.warTargets].sort((a,b)=> (b.colonelScore || 0) - (a.colonelScore || 0));

            list.forEach(t => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${t.colonelScore || 0}</td>
                    <td>${t.name}</td>
                    <td>${t.level}</td>
                    <td>${t.status}</td>
                    <td>${this.formatMs(t.timer)}</td>
                    <td><button class="btn-sm" data-id="${t.id}" data-act="attack">Go</button></td>
                `;
                tbody.appendChild(row);
            });
        },

        /* --------------------------
           STYLES (POLISHED)
        --------------------------- */
        injectStyles() {
            const s = document.createElement("style");
            s.textContent = `
                :host {
                    all: initial;
                    font-family: Arial, sans-serif;
                }

                /* Toggle Button */
                #war-toggle-btn {
                    position: fixed;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: #18191d;
                    border: 1px solid #333;
                    color: #ccc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                    z-index: 9999999;
                    box-shadow: 0 0 8px rgba(0,0,0,0.6);
                    user-select: none;
                }

                #war-toggle-btn:active {
                    cursor: grabbing;
                }

                /* Drawer */
                #drawer {
                    position: fixed;
                    top: 0;
                    width: 380px;
                    height: 92vh;
                    background: #1b1d22;
                    border: 1px solid #222;
                    display: flex;
                    flex-direction: column;
                    transform: translateX(-100%);
                    transition: transform 0.25s ease;
                    z-index: 10000000;
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
                    font-weight: bold;
                }

                /* Resize */
                #resize-right {
                    position: absolute;
                    right: 0;
                    top: 0;
                    width: 6px;
                    height: 100%;
                    cursor: ew-resize;
                }
                #resize-bottom {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 6px;
                    cursor: ns-resize;
                }

                /* Tabs */
                #drawer-tabs {
                    display: flex;
                    background: #15161a;
                    border-bottom: 1px solid #2f3138;
                }
                .tab-btn {
                    flex: 1;
                    padding: 8px;
                    text-align: center;
                    cursor: pointer;
                    color: #aaa;
                    font-size: 12px;
                    user-select: none;
                }
                .tab-btn.active {
                    color: #fff;
                    background: #292b31;
                    font-weight: bold;
                }

                #tab-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }

                /* Cards */
                .card {
                    background: #23252b;
                    border: 1px solid #303036;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 14px;
                    color: #eee;
                }

                .card-title {
                    font-size: 14px;
                    margin-bottom: 8px;
                    font-weight: 600;
                }

                .dash-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    padding: 3px 0;
                }

                .btn-sm {
                    font-size: 11px;
                    padding: 3px 6px;
                    background: #2d2f34;
                    border: 1px solid #3a3d45;
                    color: #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .btn-sm:hover {
                    background: #3e4047;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    color: #ccc;
                }
                th {
                    font-size: 12px;
                    color: #bbb;
                    text-align: left;
                    padding: 5px 4px;
                    border-bottom: 1px solid #383a40;
                }
                td {
                    font-size: 12px;
                    padding: 6px 4px;
                    border-bottom: 1px solid #31333a;
                }

                tr:hover {
                    background: rgba(255,255,255,0.05);
                }

                /* Scrollbar */
                #tab-content::-webkit-scrollbar {
                    width: 8px;
                }
                #tab-content::-webkit-scrollbar-thumb {
                    background: #333;
                    border-radius: 4px;
                }
            `;
            this.root.appendChild(s);
        }
    };

    if (window.WAR_GENERAL) {
        WAR_GENERAL.register("Major", Major);
    } else {
        console.warn("[MAJOR v3.2.1] WAR_GENERAL missing");
    }
})();
