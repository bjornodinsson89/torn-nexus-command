/**
 * CODENAME: WAR_MAJOR
 * RANK: ⭐⭐⭐ (Executive Officer)
 * STATUS: OPERATIONAL
 */

(function() {

    const Major = {
        general: null,
        ui: null,
        root: null,

        // ======================
        // STATE
        // ======================
        tab: "targets",
        subTab: "personal",

        personalTargets: [],
        warTargets: [],
        sharedTargets: [],
        factionMembers: {},

        timerInterval: null,
        
        // CACHE: Maps ID -> DOM Element (TR)
        rowCache: new Map(),

        // ======================
        // INIT
        // ======================
        init(General) {
            this.general = General;
            
            // Robust UI detection
            this.ui = (General && General.ui) ? General.ui :
                      (window.WAR && WAR.ui) ? WAR.ui : null;

            if (!this.ui) {
                console.warn("[MAJOR] UI handler not found. Aborting.");
                return;
            }

            this.buildUI();
            this.bindSignals();
            this.startTimerEngine();
        },

        // ======================
        // SIGNALS
        // ======================
        bindSignals() {
            const G = this.general;

            G.signals.listen("PERSONAL_TARGETS_UPDATE", list => {
                this.personalTargets = list || [];
                if (this.subTab === "personal") this.renderTable(true);
            });

            G.signals.listen("WAR_TARGETS_UPDATE", list => {
                this.warTargets = list || [];
                if (this.subTab === "war") this.renderTable(true);
            });

            G.signals.listen("FACTION_TARGETS_UPDATE", data => {
                this.sharedTargets = Object.values(data.targets || {});
                if (this.subTab === "shared") this.renderTable(true);
            });

            G.signals.listen("FACTION_MEMBERS_UPDATE", mem => {
                this.factionMembers = mem || {};
            });

            G.signals.listen("REQUEST_ADD_PERSONAL_TARGET", t => {
                this.addPersonalTarget(t);
            });

            G.signals.listen("COLONEL_SCORE_OUTPUT", payload => {
                this.applyScore(payload.id, payload.score);
            });
        },

        applyScore(id, score) {
            const lists = [this.personalTargets, this.warTargets, this.sharedTargets];
            let found = false;
            
            for (let list of lists) {
                for (let t of list) {
                    if (String(t.id) === String(id)) {
                        t.score = score;
                        found = true;
                    }
                }
            }
            
            // OPTIMIZATION: Use partial render. 
            // Since partial render now handles sorting, we don't need a full rebuild.
            if (found) this.renderTable(false);
        },

        addPersonalTarget(t) {
            if (!t || !t.id) return;
            // Prevent duplicates
            if (this.personalTargets.some(x => String(x.id) === String(t.id))) return;

            this.personalTargets.push({
                id: t.id,
                name: t.name || "Unknown",
                level: t.level || null,
                faction: t.faction || null,
                status: "Okay",
                timer: 0,
                score: 0,
                lastSeen: Date.now()
            });
            
            if (this.subTab === "personal") this.renderTable(true);
        },

        // ======================
        // UI BUILDER
        // ======================
        buildUI() {
            this.root = this.ui.addTab("Targets");
            this.root.innerHTML = `
                <div class="card wr-major-container">
                    <div class="card-header wr-major-header">
                        <span class="wr-major-title">Targets</span>
                        <div class="wr-subtabs">
                            <button data-sub="personal" class="wr-subtab active">Personal</button>
                            <button data-sub="war" class="wr-subtab">War</button>
                            <button data-sub="shared" class="wr-subtab">Shared</button>
                        </div>
                    </div>
                    <div class="scroll-table-container">
                        <table class="fwh-table wr-target-table">
                            <thead>
                                <tr>
                                    <th width="30">On</th>
                                    <th>Name</th>
                                    <th>Lv</th>
                                    <th>Faction</th>
                                    <th>Status</th>
                                    <th>Timer</th>
                                    <th>Score</th>
                                    <th width="120">Actions</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            `;
            this.bindSubtabs();
            this.bindActionDelegation();
        },

        bindSubtabs() {
            const tabs = this.root.querySelectorAll(".wr-subtab");
            tabs.forEach(btn => {
                btn.addEventListener("click", () => {
                    tabs.forEach(x => x.classList.remove("active"));
                    btn.classList.add("active");
                    this.subTab = btn.dataset.sub;
                    this.renderTable(true);
                });
            });
        },

        bindActionDelegation() {
            const tbody = this.root.querySelector(".wr-target-table tbody");
            tbody.addEventListener("click", (e) => {
                const btn = e.target.closest(".wr-act-btn");
                if (!btn) return;

                const id = btn.dataset.id;
                const act = btn.dataset.act;
                this.handleAction(act, id);
            });
        },

        handleAction(act, id) {
            // Opens in new tab so you don't lose the dashboard
            if (act === "attack")
                window.open(`https://www.torn.com/loader.php?sid=attack&user2ID=${id}`, "_blank");
            if (act === "view")
                window.open(`https://www.torn.com/profiles.php?XID=${id}`, "_blank");
        },

        // ======================
        // RENDER LOGIC (Cached)
        // ======================
        renderTable(full = false) {
            const tbody = this.root.querySelector(".wr-target-table tbody");
            if (!tbody) return;

            let list = this.subTab === "personal" ? this.personalTargets :
                       this.subTab === "war"      ? this.warTargets :
                                                    this.sharedTargets;
            
            list = this.sortList(list);

            if (full) {
                // FULL: Wipe and Rebuild
                this.rowCache.clear();
                tbody.innerHTML = "";
                list.forEach(t => {
                    const row = this.renderRow(t);
                    this.rowCache.set(String(t.id), row);
                    tbody.appendChild(row);
                });
            } else {
                // PARTIAL: Update & Reorder
                list.forEach(t => {
                    let row = this.rowCache.get(String(t.id));
                    
                    // Safety: Create row if it's missing from cache
                    if (!row) {
                        row = this.renderRow(t);
                        this.rowCache.set(String(t.id), row);
                    }

                    this.updateRow(row, t);
                    
                    // Appending an existing row moves it to the new sorted position
                    tbody.appendChild(row);
                });
            }
        },

        sortList(list) {
            return [...list].sort((a, b) => {
                const sA = a.score || 0;
                const sB = b.score || 0;
                // Higher score first
                if (sB !== sA) return sB - sA;
                // Lower timer first
                return (a.timer || 0) - (b.timer || 0);
            });
        },

        renderRow(t) {
            const tr = document.createElement("tr");
            tr.dataset.id = t.id;
            tr.innerHTML = `
                <td class="online-cell" style="text-align:center;">${this.onlineIndicator(t)}</td>
                <td class="name-cell"><a href="https://www.torn.com/profiles.php?XID=${t.id}" target="_blank">${t.name}</a></td>
                <td class="level-cell">${t.level || ""}</td>
                <td class="faction-cell">${t.faction || ""}</td>
                <td class="status-cell">${t.status || "Okay"}</td>
                <td class="timer-cell">${this.formatTimer(t.timer)}</td>
                <td class="score-cell">${t.score || 0}</td>
                <td class="act-cell">
                    <button class="wr-act-btn" data-id="${t.id}" data-act="attack">Attack</button>
                    <button class="wr-act-btn" data-id="${t.id}" data-act="view">View</button>
                </td>
            `;
            return tr;
        },

        updateRow(row, t) {
            row.querySelector(".online-cell").innerHTML = this.onlineIndicator(t);
            row.querySelector(".status-cell").textContent = t.status || "Okay";
            row.querySelector(".timer-cell").textContent = this.formatTimer(t.timer);
            row.querySelector(".score-cell").textContent = t.score || 0;
        },

        onlineIndicator(t) {
            if (!t.lastSeen) return `<span class="wr-online grey" title="Unknown"></span>`;
            const diff = Date.now() - t.lastSeen;
            if (diff < 120000) return `<span class="wr-online green" title="Online"></span>`;
            if (diff < 600000) return `<span class="wr-online yellow" title="Idle"></span>`;
            return `<span class="wr-online red" title="Offline"></span>`;
        },

        // ======================
        // TIMER ENGINE
        // ======================
        startTimerEngine() {
            if (this.timerInterval) clearInterval(this.timerInterval);
            
            this.timerInterval = setInterval(() => {
                let changed = false;
                
                // Only process the currently visible list to save CPU
                let activeList = this.subTab === "personal" ? this.personalTargets :
                                 this.subTab === "war" ? this.warTargets :
                                 this.sharedTargets;

                for (let t of activeList) {
                    if (t.timer > 0) {
                        t.timer -= 1000;
                        if (t.timer < 0) t.timer = 0;
                        changed = true;
                    }
                }
                
                // If a timer ticked, partial render (updates text AND sorts rows)
                if (changed) this.renderTable(false);
            }, 1000);
        },

        formatTimer(ms) {
            if (!ms || ms <= 0) return "";
            const s = Math.floor(ms / 1000);
            const m = Math.floor(s / 60);
            const ss = s % 60;
            return `${m}m ${ss.toString().padStart(2, '0')}s`;
        }
    };

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Major", Major);
    }
})();
