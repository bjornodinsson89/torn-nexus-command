/**
 * CODENAME: WAR_COLONEL
 * RANK: Senior Analyst (v2)
 * MISSION: Strategic Analysis, SITREP Generation, Battlefield Intelligence
 */

(function() {

    const Colonel = {
        name: "Colonel v2",
        general: null,

        // Configurable danger thresholds (seconds)
        config: {
            panicThreshold: 60,
            warnThreshold: 120
        },

        init(General) {
            this.general = General;
            console.log("🧠 [COLONEL v2] Strategic Analysis online.");

            // Load local settings if present
            this.loadSettings();

            // Listen for unified or raw intel from Lieutenant
            General.signals.listen("RAW_INTEL", (data) => this.analyze(data));

            // Listen for future config changes
            General.signals.listen("CONFIG_UPDATE", (cfg) => {
                this.applyConfig(cfg);
            });
        },

        // ===========================
        // CONFIG + SETTINGS
        // ===========================
        loadSettings() {
            try {
                const p = localStorage.getItem("WAR_CFG_panic");
                const w = localStorage.getItem("WAR_CFG_warning");
                if (p) this.config.panicThreshold = parseInt(p);
                if (w) this.config.warnThreshold = parseInt(w);
            } catch (_) {}
        },

        applyConfig(cfg) {
            if (!cfg) return;
            if (cfg.panic !== undefined) this.config.panicThreshold = cfg.panic;
            if (cfg.warning !== undefined) this.config.warnThreshold = cfg.warning;
        },

        // ===========================
        // MAIN ANALYTICS ENGINE
        // ===========================
        analyze(intel) {
            if (!intel || typeof intel !== "object") return;

            const now = Date.now();

            // Build SITREPs
            const chainSITREP   = this.analyzeChain(intel.chain, now);
            const userSITREP    = this.analyzeUser(intel.user, now);
            const factionSITREP = this.analyzeFaction(intel.faction, now);
            const globalSITREP  = this.buildGlobalSITREP(chainSITREP, userSITREP, factionSITREP, now);

            // Dispatch specialized SITREPs
            this.dispatch("CHAIN_SITREP", chainSITREP);
            this.dispatch("USER_SITREP", userSITREP);
            this.dispatch("FACTION_SITREP", factionSITREP);
            this.dispatch("GLOBAL_SITREP", globalSITREP);

            // Backward compatible SITREP_UPDATE (merged)
            const merged = {
                timestamp: now,
                chain: chainSITREP,
                user: userSITREP,
                faction: factionSITREP,
                status: globalSITREP.status,
                global: globalSITREP
            };

            this.dispatch("SITREP_UPDATE", merged);
        },

        dispatch(ev, payload) {
            try {
                this.general.signals.dispatch(ev, payload);
            } catch (e) {
                console.error(`[COLONEL v2] Dispatch error for ${ev}:`, e);
            }
        },

        // ===========================
        // CHAIN ANALYSIS
        // ===========================
        analyzeChain(chain, now) {
            if (!chain) {
                return {
                    active: false,
                    current: 0,
                    max: 0,
                    timeout: 0,
                    state: "peace",
                    color: "#888",
                    isPanic: false,
                    projectedEnd: null
                };
            }

            const active  = chain.current > 0;
            const timeout = chain.timeout ?? 0;

            let state = "peace";
            let color = "#33ff33"; // green
            let isPanic = false;

            if (active) {
                if (timeout < this.config.panicThreshold) {
                    state = "panic";
                    color = "#ff3333";
                    isPanic = true;
                } else if (timeout < this.config.warnThreshold) {
                    state = "warning";
                    color = "#ffaa33";
                } else {
                    state = "chain";
                    color = "#33ff33";
                }
            }

            return {
                active,
                current: chain.current ?? 0,
                max: chain.max ?? chain.maximum ?? 0,
                timeout,
                state,
                color,
                isPanic,
                projectedEnd: now + timeout * 1000
            };
        },

        // ===========================
        // USER ANALYSIS
        // ===========================
        analyzeUser(user, now) {
            if (!user) return { status: null, bars: null };

            const status = user.status || null;
            const bars   = user.bars || null;

            let isHosp = false;
            let hospSeconds = 0;

            if (status && status.state && status.state.toLowerCase() === "hospital") {
                isHosp = true;
                if (status.until) {
                    const diff = Math.max(0, status.until - Math.floor(now / 1000));
                    hospSeconds = diff;
                }
            }

            return {
                status,
                bars,
                isHosp,
                hospSeconds
            };
        },

        // ===========================
        // FACTION ANALYSIS
        // ===========================
        analyzeFaction(faction, now) {
            if (!faction) {
                return {
                    id: null,
                    name: null,
                    respect: 0,
                    members: null,
                    onlineCount: 0,
                    hospCount: 0
                };
            }

            const members = faction.members || {};
            let online = 0;
            let hosp = 0;

            for (const id in members) {
                const m = members[id];
                if (!m || !m.status) continue;

                if (m.status.state === "Hospital") hosp++;

                if (m.last_action && m.last_action.relative) {
                    const rel = m.last_action.relative;
                    if (rel.includes("minute") || rel.includes("seconds") || rel.includes("now")) {
                        online++;
                    }
                }
            }

            return {
                id: faction.id ?? null,
                name: faction.name ?? "",
                respect: faction.respect ?? 0,
                members,
                onlineCount: online,
                hospCount: hosp
            };
        },

        // ===========================
        // GLOBAL SITREP
        // ===========================
        buildGlobalSITREP(chain, user, faction, now) {
            // Determine highest alert level
            let status = {
                code: "GREEN",
                priority: 0,
                text: "Stable"
            };

            if (chain.isPanic) {
                status = { code: "RED", priority: 3, text: "Chain Panic" };
            }
            else if (chain.state === "warning") {
                status = { code: "ORANGE", priority: 2, text: "Chain Warning" };
            }
            else if (user.isHosp) {
                status = { code: "YELLOW", priority: 1, text: "User Hospitalized" };
            }

            return {
                timestamp: now,
                chain,
                user,
                faction,
                status
            };
        }

    };

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Colonel", Colonel);
    }

})();
