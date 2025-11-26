/**
 * CODENAME: WAR_MAJOR v3.1
 * ROLE: Executive Officer (GUI)
 * RESPONSIBILITY: Full War Room interface 

(function () {
    const Major = {
        general: null,
        root: null,
        elements: {},
        targets: { personal: [], war: [], shared: [] },
        factionMembers: {},
        warTargets: [],

        /* ------------------ Helpers ------------------ */
        formatMs(ms) {
            if (!ms || ms <= 0) return "0s";
            const s = Math.floor(ms / 1000);
            const m = Math.floor(s / 60);
            const ss = s % 60;
            if (m <= 0) return `${ss}s`;
            return `${m}m ${ss}s`;
        },

        /* ------------------ Init ------------------ */
        init(General) {
            this.general = General;
            this.createShadowDOM();
            this.injectStyles();
            this.buildDrawer();
            this.buildTabSystem();
            this.registerPanels();
            this.bindGlobalActions();

            /* ======================================================
             * PATCH: Listen for Colonel → Target Score Outputs
             * ====================================================== */
            General.signals.listen("TARGET_SCORES_READY", ({ scored }) => {
                this.applyScoredTargets(scored);
            });

            console.log("%c[Major v3.1] GUI Online (Scoring + Shared Targets Enabled)", "color:#0af");
        },

        /* ------------------ Shadow DOM ------------------ */
        createShadowDOM() {
            const existing = document.getElementById("war-room-host");
            if (existing) existing.remove();

            const host = document.createElement("div");
            host.id = "war-room-host";
            document.body.appendChild(host);
            this.root = host.attachShadow({ mode: "open" });
        },

        /* ------------------ Styles ------------------ */
        injectStyles() {
            const style = document.createElement("style");
            style.textContent = `
                :host { all: initial; font-family: Arial, sans-serif; }
                #drawer {
                    position: fixed; top: 0; left: 0;
                    width: 380px; height: 100vh;
                    background: #1b1d22;
                    box-shadow: 3px 0 10px rgba(0,0,0,0.6);
                    color: #eee;
                    display: flex; flex-direction: column;
                    z-index: 999999; border-right: 1px solid #222;
                    box-sizing: border-box;
                }
                #drawer-header {
                    padding: 12px 14px; background: #23252b;
                    border-bottom: 1px solid #2f3138;
                    font-size: 14px; font-weight: 600;
                }
                #drawer-tabs {
                    display: flex; background: #18191d;
                    border-bottom: 1px solid #2f3138;
                }
                .tab-btn {
                    flex: 1; padding: 8px 4px;
                    text-align: center; cursor: pointer;
                    font-size: 12px; background: #18191d;
                    border-right: 1px solid #24262c;
                    color: #aaa; transition: 0.12s;
                }
                .tab-btn:hover { background: #222429; color: #fff; }
                .tab-btn.active {
                    background: #292b31;
                    color: #fff; font-weight: 600;
                }
                #tab-content {
                    flex: 1; overflow-y: auto; padding: 10px;
                    box-sizing: border-box;
                }
                .tab-panel { display: none; }

                .card {
                    background: #23252b; border: 1px solid #2f3138;
                    padding: 10px; margin-bottom: 12px; border-radius: 4px;
                }
                .card-title {
                    font-weight: 600; font-size: 13px; margin-bottom: 8px;
                }
                .dash-row {
                    display: flex; justify-content: space-between;
                    font-size: 12px; padding: 2px 0;
                }
                table {
                    width: 100%; border-collapse: collapse; font-size: 12px;
                }
                th, td {
                    padding: 6px 4px; border-bottom: 1px solid #34363d;
                }
                tr:hover { background: rgba(255,255,255,0.05); }
                th { color: #ddd; }

                .online-dot {
                    width: 8px; height: 8px; border-radius: 50%; display: inline-block;
                }
                .online-green { background: #2ecc71; }
                .online-yellow { background: #f1c40f; }
                .online-red { background: #e74c3c; }
                .online-grey { background: #7f8c8d; }

                .subtabs { display: flex; margin-bottom: 8px; }
                .subtab {
                    padding: 4px 8px; margin-right: 4px;
                    background: #2c2f36; border-radius: 4px;
                    font-size: 11px; cursor: pointer; color: #ccc;
                }
                .subtab.active {
                    background: #3b88ff; color: #fff;
                }

                .btn-sm {
                    font-size: 11px; padding: 3px 6px;
                    border-radius: 3px;
                    border: 1px solid #3a3c42;
                    background: #2d2f34; color: #ddd;
                    cursor: pointer;
                }
                .btn-sm:hover { background: #3b3d44; }

                .btn-share {
                    margin-left: 3px;
                    background: #1d6fe0 !important;
                    border-color: #1d6fe0 !important;
                    color: #fff !important;
                }
            `;
            this.root.appendChild(style);
        },

        /* ------------------ Drawer + Tabs ------------------ */
        buildDrawer() {
            const drawer = document.createElement("div");
            drawer.id = "drawer";
            drawer.innerHTML = `
                <div id="drawer-header">WAR ROOM</div>
                <div id="drawer-tabs"></div>
                <div id="tab-content"></div>
            `;
            this.elements.drawer = drawer;
            this.root.appendChild(drawer);
        },

        buildTabSystem() {
            this.elements.tabButtons = {};
            this.elements.tabContainers = {};

            this.addTab("dashboard", "Dashboard");
            this.addTab("targets", "Targets");
            this.addTab("faction", "Faction");
            this.addTab("chain", "Chain");
            this.addTab("war", "War");
            this.addTab("settings", "Settings");

            this.switchTab("dashboard");
        },

        addTab(id, label) {
            const btn = document.createElement("div");
            btn.className = "tab-btn";
            btn.textContent = label;
            btn.onclick = () => this.switchTab(id);

            const cont = document.createElement("div");
            cont.className = "tab-panel";

            this.elements.drawer.querySelector("#drawer-tabs").appendChild(btn);
            this.elements.drawer.querySelector("#tab-content").appendChild(cont);

            this.elements.tabButtons[id] = btn;
            this.elements.tabContainers[id] = cont;
        },

        switchTab(id) {
            Object.keys(this.elements.tabContainers).forEach(key => {
                this.elements.tabContainers[key].style.display = "none";
                this.elements.tabButtons[key].classList.remove("active");
            });
            this.elements.tabContainers[id].style.display = "block";
            this.elements.tabButtons[id].classList.add("active");
        },

        /* ------------------ Panels Registration ------------------ */
        registerPanels() {
            /* ========== DASHBOARD PANEL ========== */
            const dash = document.createElement("div");
            dash.innerHTML = `
                <div class="card">
                    <div class="card-title">Commander Status</div>
                    <div class="dash-row"><span>Energy</span><span id="dash-energy">0</span></div>
                    <div class="dash-row"><span>Nerve</span><span id="dash-nerve">0</span></div>
                    <div class="dash-row"><span>Cooldown</span><span id="dash-cooldown">0s</span></div>
                    <div class="dash-row"><span>Status</span><span id="dash-status">Unknown</span></div>
                </div>
                <div class="card">
                    <div class="card-title">Faction Snapshot</div>
                    <div class="dash-row"><span>Members Online</span><span id="dash-f-on">0</span></div>
                    <div class="dash-row"><span>Chain Watchers</span><span id="dash-f-watch">0</span></div>
                    <div class="dash-row"><span>Hospitalized</span><span id="dash-f-hosp">0</span></div>
                    <div class="dash-row"><span>Jailed</span><span id="dash-f-jail">0</span></div>
                </div>
                <div class="card">
                    <div class="card-title">Chain Status</div>
                    <div class="dash-row"><span>Hits</span><span id="dash-chain-hits">0</span></div>
                    <div class="dash-row"><span>Time Left</span><span id="dash-chain-time">0s</span></div>
                    <div class="dash-row"><span>Pace</span><span id="dash-chain-pace">0/min</span></div>
                    <div class="dash-row"><span>Warning</span><span id="dash-chain-warn">None</span></div>
                </div>
                <div class="card">
                    <div class="card-title">War Intel</div>
                    <div class="dash-row"><span>Enemy Active</span><span id="dash-war-active">0</span></div>
                    <div class="dash-row"><span>Threat Level</span><span id="dash-war-threat">0</span></div>
                    <div class="dash-row"><span>Top Target Score</span><span id="dash-war-topscore">0</span></div>
                    <div class="dash-row"><span>SITREP</span><span id="dash-war-sitrep">OK</span></div>
                </div>
            `;
            this.elements.tabContainers.dashboard.appendChild(dash);
            this.initDashboardPanel();

            /* ========== TARGETS PANEL ========== */
            const tgt = document.createElement("div");
            tgt.innerHTML = `
                <div class="card">
                    <div class="card-title">Targets</div>
                    <div class="subtabs">
                        <div class="subtab active" data-sub="personal">Personal</div>
                        <div class="subtab" data-sub="war">War</div>
                        <div class="subtab" data-sub="shared">Shared</div>
                    </div>
                    <table id="wr-target-table">
                        <thead>
                            <tr>
                                <th>On</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Faction</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Score</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;
            this.elements.tabContainers.targets.appendChild(tgt);
            this.initTargetPanel();

            /* ========== FACTION PANEL ========== */
            const fac = document.createElement("div");
            fac.innerHTML = `
                <div class="card">
                    <div class="card-title">Faction Roster</div>
                    <table id="wr-faction-table">
                        <thead>
                            <tr>
                                <th>On</th>
                                <th>Name</th>
                                <th>Lv</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Timer</th>
                                <th>Watcher</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;
            this.elements.tabContainers.faction.appendChild(fac);
            this.initFactionPanel();

            /* ========== CHAIN PANEL ========== */
            const chain = document.createElement("div");
            chain.innerHTML = `
                <div class="card">
                    <div class="card-title">Chain Status</div>
                    <div class="dash-row"><span>Chain</span><span id="ch-chain-id">0</span></div>
                    <div class="dash-row"><span>Hits</span><span id="ch-hits">0</span></div>
                    <div class="dash-row"><span>Time Left</span><span id="ch-time-left">0s</span></div>
                    <div class="dash-row"><span>Pace (Required)</span><span id="ch-pace-req">0/min</span></div>
                    <div class="dash-row"><span>Pace (Current)</span><span id="ch-pace-now">0/min</span></div>
                    <div class="dash-row"><span>Drop Risk</span><span id="ch-risk">Unknown</span></div>
                </div>
                <div class="card">
                    <div class="card-title">Chain Warnings</div>
                    <div id="ch-warnings">
                        <div class="dash-row"><span>Status</span><span id="ch-warn-status">None</span></div>
                        <div class="dash-row"><span>Message</span><span id="ch-warn-msg">No warnings</span></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-title">Faction Support</div>
                    <div class="dash-row"><span>Watchers Online</span><span id="ch-watchers">0</span></div>
                    <div class="dash-row"><span>Members Online</span><span id="ch-online">0</span></div>
                </div>
            `;
            this.elements.tabContainers.chain.appendChild(chain);
            this.initChainPanel();

            /* ========== WAR PANEL ========== */
            const war = document.createElement("div");
            war.innerHTML = `
                <div class="card">
                    <div class="card-title">Enemy Faction Status</div>
                    <div class="dash-row"><span>Enemy Online</span><span id="war-enemy-online">0</span></div>
                    <div class="dash-row"><span>Hospital</span><span id="war-enemy-hosp">0</span></div>
                    <div class="dash-row"><span>Jail</span><span id="war-enemy-jail">0</span></div>
                    <div class="dash-row"><span>Traveling</span><span id="war-enemy-travel">0</span></div>
                    <div class="dash-row"><span>Threat Level</span><span id="war-threat">0</span></div>
                </div>
                <div class="card">
                    <div class="card-title">High Value Targets</div>
                    <table id="wr-war-targets-table">
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
                <div class="card">
                    <div class="card-title">War SITREP</div>
                    <div class="dash-row"><span>State</span><span id="war-state">OK</span></div>
                    <div class="dash-row"><span>Chaining Power</span><span id="war-chain-power">0</span></div>
                    <div class="dash-row"><span>Danger</span><span id="war-danger">Low</span></div>
                    <div class="dash-row"><span>Message</span><span id="war-msg">Stable</span></div>
                </div>
            `;
            this.elements.tabContainers.war.appendChild(war);
            this.initWarPanel();

            /* ========== SETTINGS PANEL ========== */
            const settings = document.createElement("div");
            settings.innerHTML = `
                <div class="card">
                    <div class="card-title">API Configuration</div>
                    <div class="dash-row">
                        <span>Your API Key</span>
                        <input id="set-api-key" type="password" placeholder="Enter API key" style="
                            width: 180px;
                            background:#2b2d33;
                            border:1px solid #3a3d45;
                            color:#ccc;
                            padding:4px;
                            border-radius:3px;
                        ">
                    </div>
                    <button id="set-save-api" class="btn-sm">Save Key</button>
                </div>
                <div class="card">
                    <div class="card-title">Preferences</div>
                    <div class="dash-row">
                        <span>Auto Chain Watch</span>
                        <input id="set-auto-watch" type="checkbox">
                    </div>
                    <div class="dash-row">
                        <span>Enable Debug Mode</span>
                        <input id="set-debug" type="checkbox">
                    </div>
                    <button id="set-save-pref" class="btn-sm">Save Preferences</button>
                </div>
                <div class="card">
                    <div class="card-title">Maintenance</div>
                    <button id="set-clear" class="btn-sm">Clear Cached Settings</button>
                </div>
                <div class="card">
                    <div class="card-title">About</div>
                    <div class="dash-row"><span>Version</span><span id="set-version">3.1.0</span></div>
                    <div class="dash-row"><span>Status</span><span id="set-status">Operational</span></div>
                </div>
            `;
            this.elements.tabContainers.settings.appendChild(settings);
            this.initSettingsPanel();
        },

        /* ------------------ Dashboard Engine ------------------ */
        initDashboardPanel() {
            this.dashEls = {
                energy: this.root.querySelector("#dash-energy"),
                nerve: this.root.querySelector("#dash-nerve"),
                cooldown: this.root.querySelector("#dash-cooldown"),
                status: this.root.querySelector("#dash-status"),
                f_on: this.root.querySelector("#dash-f-on"),
                f_watch: this.root.querySelector("#dash-f-watch"),
                f_hosp: this.root.querySelector("#dash-f-hosp"),
                f_jail: this.root.querySelector("#dash-f-jail"),
                c_hits: this.root.querySelector("#dash-chain-hits"),
                c_time: this.root.querySelector("#dash-chain-time"),
                c_pace: this.root.querySelector("#dash-chain-pace"),
                c_warn: this.root.querySelector("#dash-chain-warn"),
                w_active: this.root.querySelector("#dash-war-active"),
                w_threat: this.root.querySelector("#dash-war-threat"),
                w_top: this.root.querySelector("#dash-war-topscore"),
                w_sitrep: this.root.querySelector("#dash-war-sitrep")
            };

            const G = this.general;

            G.signals.listen("USER_SITREP", data => {
                if (data.energy != null) this.dashEls.energy.textContent = data.energy;
                if (data.nerve != null) this.dashEls.nerve.textContent = data.nerve;
                if (data.cooldown != null) this.dashEls.cooldown.textContent = this.formatMs(data.cooldown * 1000);
                if (data.status) this.dashEls.status.textContent = data.status;
            });

            G.signals.listen("FACTION_SITREP", data => {
                this.dashEls.f_on.textContent = data.online ?? 0;
                this.dashEls.f_watch.textContent = data.watchers ?? 0;
                this.dashEls.f_hosp.textContent = data.hospital ?? 0;
                this.dashEls.f_jail.textContent = data.jail ?? 0;
            });

            G.signals.listen("CHAIN_SITREP", data => {
                this.dashEls.c_hits.textContent = data.hits ?? 0;
                this.dashEls.c_time.textContent = this.formatMs((data.timeLeft || 0) * 1000);
                this.dashEls.c_pace.textContent = `${data.currentPace || 0}/min`;
                this.dashEls.c_warn.textContent = data.warning || "None";
            });

            G.signals.listen("WAR_SITREP", data => {
                this.dashEls.w_active.textContent = data.enemyOnline ?? 0;
                this.dashEls.w_threat.textContent = data.threat ?? 0;
                this.dashEls.w_top.textContent = data.topScore ?? 0;
                this.dashEls.w_sitrep.textContent = data.state || "OK";
            });
        },

        /* ------------------ Targets Engine ------------------ */
        initTargetPanel() {
            this.targetSubtab = "personal";
            this.targetTableBody = this.root.querySelector("#wr-target-table tbody");

            const subtabs = this.root.querySelectorAll(".subtab");
            subtabs.forEach(st => {
                st.addEventListener("click", () => {
                    subtabs.forEach(x => x.classList.remove("active"));
                    st.classList.add("active");
                    this.targetSubtab = st.dataset.sub;
                    this.renderTargetTable(true);
                });
            });

            const G = this.general;

            G.signals.listen("PERSONAL_TARGETS_UPDATE", list => {
                this.targets.personal = list || [];
                this.requestScores(list);
                this.renderTargetTable(true);
            });

            G.signals.listen("WAR_TARGETS_UPDATE", list => {
                this.targets.war = list || [];
                this.requestScores(list);
                this.renderTargetTable(true);
            });

            G.signals.listen("FACTION_TARGETS_UPDATE", data => {
                this.targets.shared = Object.values(data.targets || {});
                this.requestScores(this.targets.shared);
                this.renderTargetTable(true);
            });

            G.signals.listen("COLONEL_SCORE_OUTPUT", ({ id, score }) => {
                Object.values(this.targets).forEach(list => {
                    list.forEach(t => {
                        if (String(t.id) === String(id)) t.score = score;
                    });
                });
                this.renderTargetTable(false);
            });

            setInterval(() => {
                let changed = false;
                Object.values(this.targets).forEach(list => {
                    list.forEach(t => {
                        if (t.timer > 0) {
                            t.timer -= 1000;
                            if (t.timer < 0) t.timer = 0;
                            changed = true;
                        }
                    });
                });
                if (changed) this.renderTargetTable(false);
            }, 1000);
        },

        /* PATCH: Request scoring from Colonel */
        requestScores(list) {
            if (!list || !list.length) return;
            this.general.signals.dispatch("REQUEST_TARGET_SCORES", { targets: list });
        },

        /* PATCH: Apply Colonel scored list */
        applyScoredTargets(list) {
            const scoreMap = {};
            list.forEach(t => scoreMap[t.id] = t.colonelScore);

            ["personal", "war", "shared"].forEach(cat => {
                this.targets[cat].forEach(t => {
                    if (scoreMap[t.id] != null) t.score = scoreMap[t.id];
                });
            });

            this.renderTargetTable(true);
        },

        sortTargetList(list) {
            return [...list].sort((a, b) => {
                const sA = a.score || 0;
                const sB = b.score || 0;
                if (sB !== sA) return sB - sA;
                return (a.timer || 0) - (b.timer || 0);
            });
        },

        renderTargetTable(full) {
            const list = this.sortTargetList(this.targets[this.targetSubtab] || []);
            if (full) {
                this.targetTableBody.innerHTML = "";
                list.forEach(t => this.targetTableBody.appendChild(this.buildTargetRow(t)));
            } else {
                list.forEach(t => {
                    const row = this.root.querySelector(`tr[data-id="${t.id}"]`);
                    if (!row) return;
                    this.updateTargetRow(row, t);
                    this.targetTableBody.appendChild(row);
                });
            }
        },

        renderOnlineDot(lastSeen) {
            if (!lastSeen) return `<span class="online-dot online-grey"></span>`;
            const diff = Date.now() - lastSeen;
            if (diff < 120000) return `<span class="online-dot online-green"></span>`;
            if (diff < 600000) return `<span class="online-dot online-yellow"></span>`;
            return `<span class="online-dot online-red"></span>`;
        },

        /* PATCHED buildTargetRow: includes SHARE BUTTON */
        buildTargetRow(t) {
            const tr = document.createElement("tr");
            tr.dataset.id = t.id;
            tr.innerHTML = `
                <td>${this.renderOnlineDot(t.lastSeen)}</td>
                <td>${t.name}</td>
                <td>${t.level || ""}</td>
                <td>${t.faction || ""}</td>
                <td class="tstatus">${t.status || "Okay"}</td>
                <td class="ttimer">${this.formatMs(t.timer)}</td>
                <td class="tscore">${t.score || 0}</td>
                <td>
                    <button class="btn-sm btn-sm-act" data-id="${t.id}" data-act="attack">Attack</button>
                    <button class="btn-sm btn-sm-act" data-id="${t.id}" data-act="view">View</button>
                    <button class="btn-sm btn-share" data-id="${t.id}">Share</button>
                </td>
            `;
            return tr;
        },

        updateTargetRow(row, t) {
            row.children[0].innerHTML = this.renderOnlineDot(t.lastSeen);
            row.querySelector(".tstatus").textContent = t.status || "Okay";
            row.querySelector(".ttimer").textContent = this.formatMs(t.timer);
            row.querySelector(".tscore").textContent = t.score || 0;
        },

        /* ------------------ Faction Engine ------------------ */
        initFactionPanel() {
            this.factionBody = this.root.querySelector("#wr-faction-table tbody");
            const G = this.general;

            G.signals.listen("FACTION_MEMBERS_UPDATE", mem => {
                this.factionMembers = mem || {};
                this.renderFactionTable(true);
            });

            setInterval(() => this.renderFactionTable(false), 1000);
        },

        getMemberTimer(m) {
            if (!m.until) return 0;
            return Math.max(0, m.until - Date.now());
        },

        renderMemberOnline(m) {
            return this.renderOnlineDot(m.lastSeen || 0);
        },

        renderWatcher(m) {
            return m.watching
                ? `<span class="online-dot" style="background:#00ff80;"></span>`
                : `<span class="online-dot online-grey"></span>`;
        },

        renderFactionTable(full) {
            const mem = Object.values(this.factionMembers);
            const sorted = [...mem].sort((a, b) => {
                const da = Date.now() - (a.lastSeen || 0);
                const db = Date.now() - (b.lastSeen || 0);
                const oa = da < 600000, ob = db < 600000;
                if (oa && !ob) return -1;
                if (!oa && ob) return 1;
                return (this.getMemberTimer(a) - this.getMemberTimer(b));
            });

            if (full) {
                this.factionBody.innerHTML = "";
                sorted.forEach(m => this.factionBody.appendChild(this.buildFactionRow(m)));
            } else {
                sorted.forEach(m => {
                    const row = this.root.querySelector(`tr[data-fid="${m.userID}"]`);
                    if (!row) return;
                    this.updateFactionRow(row, m);
                    this.factionBody.appendChild(row);
                });
            }
        },

        buildFactionRow(m) {
            const tr = document.createElement("tr");
            tr.dataset.fid = m.userID;
            tr.innerHTML = `
                <td>${this.renderMemberOnline(m)}</td>
                <td>${m.name || "Unknown"}</td>
                <td>${m.level || ""}</td>
                <td>${m.role || ""}</td>
                <td class="fstatus">${m.status || "Okay"}</td>
                <td class="ftimer">${this.formatMs(this.getMemberTimer(m))}</td>
                <td>${this.renderWatcher(m)}</td>
            `;
            return tr;
        },

        updateFactionRow(row, m) {
            row.children[0].innerHTML = this.renderMemberOnline(m);
            row.querySelector(".fstatus").textContent = m.status || "Okay";
            row.querySelector(".ftimer").textContent = this.formatMs(this.getMemberTimer(m));
            row.children[6].innerHTML = this.renderWatcher(m);
        },

        /* ------------------ Chain Engine ------------------ */
        initChainPanel() {
            this.chEls = {
                id: this.root.querySelector("#ch-chain-id"),
                hits: this.root.querySelector("#ch-hits"),
                left: this.root.querySelector("#ch-time-left"),
                req: this.root.querySelector("#ch-pace-req"),
                now: this.root.querySelector("#ch-pace-now"),
                risk: this.root.querySelector("#ch-risk"),
                warnStatus: this.root.querySelector("#ch-warn-status"),
                warnMsg: this.root.querySelector("#ch-warn-msg"),
                watchers: this.root.querySelector("#ch-watchers"),
                online: this.root.querySelector("#ch-online")
            };

            const G = this.general;

            G.signals.listen("CHAIN_SITREP", data => {
                this.chEls.id.textContent = data.chainID ?? 0;
                this.chEls.hits.textContent = data.hits ?? 0;
                this.chEls.left.textContent = this.formatMs((data.timeLeft || 0) * 1000);
                this.chEls.req.textContent = `${data.requiredPace || 0}/min`;
                this.chEls.now.textContent = `${data.currentPace || 0}/min`;
                this.chEls.risk.textContent = data.dropRisk || "Unknown";
                this.chEls.warnStatus.textContent = data.warning || "None";
                this.chEls.warnMsg.textContent = data.message || "No warnings";
            });

            G.signals.listen("FACTION_MEMBERS_UPDATE", mem => {
                let online = 0, watchers = 0;
                Object.values(mem || {}).forEach(m => {
                    if (Date.now() - (m.lastSeen || 0) < 600000) online++;
                    if (m.watching) watchers++;
                });
                this.chEls.online.textContent = online;
                this.chEls.watchers.textContent = watchers;
            });
        },

        /* ------------------ War Engine ------------------ */
        initWarPanel() {
            this.warEls = {
                online: this.root.querySelector("#war-enemy-online"),
                hosp: this.root.querySelector("#war-enemy-hosp"),
                jail: this.root.querySelector("#war-enemy-jail"),
                travel: this.root.querySelector("#war-enemy-travel"),
                threat: this.root.querySelector("#war-threat"),
                state: this.root.querySelector("#war-state"),
                chainPower: this.root.querySelector("#war-chain-power"),
                danger: this.root.querySelector("#war-danger"),
                msg: this.root.querySelector("#war-msg"),
                tbody: this.root.querySelector("#wr-war-targets-table tbody")
            };

            const G = this.general;
            this.warTargets = [];

            G.signals.listen("WAR_SITREP", data => {
                this.warEls.online.textContent = data.enemyOnline ?? 0;
                this.warEls.hosp.textContent = data.enemyHospital ?? 0;
                this.warEls.jail.textContent = data.enemyJail ?? 0;
                this.warEls.travel.textContent = data.enemyTravel ?? 0;
                this.warEls.threat.textContent = data.threat ?? 0;
                this.warEls.state.textContent = data.state ?? "OK";
                this.warEls.chainPower.textContent = data.chainPower ?? 0;
                this.warEls.danger.textContent = data.danger ?? "Low";
                this.warEls.msg.textContent = data.message ?? "Stable";

                if (data.targets) {
                    this.warTargets = data.targets;
                    this.requestScores(this.warTargets);
                    this.renderWarTargets(true);
                }
            });

            G.signals.listen("TARGET_SCORES_READY", ({ scored }) => {
                scored.forEach(t => {
                    const match = this.warTargets.find(x => String(x.id) === String(t.id));
                    if (match) match.score = t.colonelScore;
                });
                this.renderWarTargets(false);
            });

            setInterval(() => {
                let changed = false;
                this.warTargets.forEach(t => {
                    if (t.timer > 0) {
                        t.timer -= 1000;
                        if (t.timer < 0) t.timer = 0;
                        changed = true;
                    }
                });
                if (changed) this.renderWarTargets(false);
            }, 1000);
        },

        renderWarTargets(full) {
            const list = [...this.warTargets].sort((a, b) => (b.score || 0) - (a.score || 0));
            if (full) {
                this.warEls.tbody.innerHTML = "";
                list.forEach(t => this.warEls.tbody.appendChild(this.buildWarRow(t)));
            } else {
                list.forEach(t => {
                    const row = this.root.querySelector(`tr[data-war-id="${t.id}"]`);
                    if (!row) return;
                    this.updateWarRow(row, t);
                    this.warEls.tbody.appendChild(row);
                });
            }
        },

        buildWarRow(t) {
            const tr = document.createElement("tr");
            tr.dataset.warId = t.id;
            tr.innerHTML = `
                <td>${t.score || 0}</td>
                <td>${t.name}</td>
                <td>${t.level || ""}</td>
                <td>${t.status || "Okay"}</td>
                <td class="wtimer">${this.formatMs(t.timer)}</td>
                <td>
                    <button class="btn-sm btn-sm-act" data-id="${t.id}" data-act="attack">Attack</button>
                </td>
            `;
            return tr;
        },

        updateWarRow(row, t) {
            row.children[0].textContent = t.score || 0;
            row.children[3].textContent = t.status || "Okay";
            row.querySelector(".wtimer").textContent = this.formatMs(t.timer);
        },

        /* ------------------ Settings Engine ------------------ */
        initSettingsPanel() {
            this.settings = { apiKey: "", autoWatch: false, debug: false };
            this.loadSettings();
            this.bindSettingsControls();
        },

        loadSettings() {
            try {
                const saved = JSON.parse(localStorage.getItem("war_settings") || "{}");
                this.settings.apiKey = saved.apiKey ?? "";
                this.settings.autoWatch = saved.autoWatch ?? false;
                this.settings.debug = saved.debug ?? false;

                this.root.querySelector("#set-api-key").value = this.settings.apiKey;
                this.root.querySelector("#set-auto-watch").checked = this.settings.autoWatch;
                this.root.querySelector("#set-debug").checked = this.settings.debug;
            } catch (e) {}
        },

        bindSettingsControls() {
            const el = this.root;

            el.querySelector("#set-save-api").onclick = () => {
                this.settings.apiKey = el.querySelector("#set-api-key").value.trim();
                this.saveSettings();
                if (this.settings.apiKey) this.general.intel.setCredentials(this.settings.apiKey);
                alert("API key saved.");
            };

            el.querySelector("#set-save-pref").onclick = () => {
                this.settings.autoWatch = el.querySelector("#set-auto-watch").checked;
                this.settings.debug = el.querySelector("#set-debug").checked;
                this.saveSettings();
                alert("Preferences saved.");
            };

            el.querySelector("#set-clear").onclick = () => {
                localStorage.removeItem("war_settings");
                alert("Settings cleared.");
            };
        },

        saveSettings() {
            localStorage.setItem("war_settings", JSON.stringify(this.settings));
        },

        /* ------------------ Global Actions ------------------ */
        bindGlobalActions() {
            this.root.addEventListener("click", e => {
                const actBtn = e.target.closest(".btn-sm-act");
                const shareBtn = e.target.closest(".btn-share");
                if (actBtn) {
                    const id = actBtn.dataset.id;
                    const act = actBtn.dataset.act;
                    if (act === "attack") window.open(`/loader.php?sid=attack&user2ID=${id}`, "_blank");
                    if (act === "view") window.open(`/profiles.php?XID=${id}`, "_blank");
                }
                if (shareBtn) {
                    const id = shareBtn.dataset.id;
                    const target = this.findTarget(id);
                    if (target) {
                        this.general.signals.dispatch("REQUEST_ADD_SHARED_TARGET", target);
                        alert(`Shared target: ${target.name}`);
                    }
                }
            });
        },

        findTarget(id) {
            for (const cat of Object.values(this.targets)) {
                const t = cat.find(x => String(x.id) === String(id));
                if (t) return t;
            }
            return null;
        }
    };

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Major", Major);
    } else {
        console.warn("[WAR_MAJOR] WAR_GENERAL not found; Major not registered.");
    }
})();
