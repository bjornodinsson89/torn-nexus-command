/**
 * WAR_COLONEL v4.0 — Balanced Ultra-AI
 *
 * Role:
 *  - Tactical intelligence engine
 *  - Analyze RAW_INTEL
 *  - Produce CHAIN_SITREP + WAR_SITREP
 *  - Advanced but lightweight target scoring
 *  - Threat & danger modeling with short-term history
 *  - Re-init safe (cleanup + unsubscribe)
 *
 * Design:
 *  - No IndexedDB / massive DB
 *  - No text-guide ingestion / heavy NLP
 *  - In-memory rolling history only
 */

(function () {
    "use strict";

    const Colonel = {
        general: null,
        listeners: [],
        intervals: [],

        memory: {
            self: {
                status: "Okay",
                level: 1
            },
            lastIntel: null,
            chainHistory: [],   // [{time, hits, timeout}]
            warHistory: [],     // [{time, enemyOnline, threat}]
            factionHistory: []  // [{time, online, hosp, jail}]
        },

        /* =========================
         * INIT & CLEANUP
         * ========================= */
        init(General) {
            this.cleanup();
            this.general = General;

            this.registerListeners();

            console.log("%c[Colonel v4.0] Balanced Ultra-AI Online", "color:#fa4");
        },

        cleanup() {
            // unsubscribe listeners
            if (this.listeners.length) {
                this.listeners.forEach(u => { try { u(); } catch {} });
                this.listeners = [];
            }

            // clear any timers (future use)
            this.intervals.forEach(id => clearInterval(id));
            this.intervals = [];

            // do NOT clear memory here; it’s okay for some state to persist
        },

        listen(event, handler) {
            const unsub = this.general.signals.listen(event, handler);
            this.listeners.push(unsub);
        },

        /* =========================
         * REGISTRATION
         * ========================= */
        registerListeners() {
            // RAW_INTEL from General (normalized intel)
            this.listen("RAW_INTEL", intel => {
                this.ingestIntel(intel);
            });

            // USER_SITREP to cache commander basic status
            this.listen("USER_SITREP", sitrep => {
                if (!sitrep) return;
                this.memory.self.status = sitrep.status || this.memory.self.status;
                // level isn't normally in sitrep, so we leave it as 1 unless later enhanced
            });

            // Major requests scores for targets
            this.listen("REQUEST_TARGET_SCORES", payload => {
                if (!payload || !payload.targets) return;
                this.processScoreRequest(payload.targets);
            });
        },

        /* =========================
         * RAW INTEL INGESTION
         * ========================= */
        ingestIntel(intel) {
            if (!intel) return;

            this.memory.lastIntel = intel;

            // Chain, Faction, War computed from the normalized structure
            if (intel.chain) this.processChain(intel.chain);
            if (intel.faction) this.processFaction(intel.faction);

            this.processWar(intel);
        },

        /* =========================
         * CHAIN ENGINE
         * ========================= */
        processChain(chain) {
            const now = Date.now();
            const hits = chain.current || 0;
            const timeout = chain.timeout || 0;

            this.memory.chainHistory.push({ time: now, hits, timeout });

            // keep ~2 minutes of history
            const cutoff = now - 120000;
            this.memory.chainHistory = this.memory.chainHistory.filter(c => c.time >= cutoff);

            // basic pace model: approximate hits/min over last minute
            const oneMinCut = now - 60000;
            const oneMin = this.memory.chainHistory.filter(c => c.time >= oneMinCut);
            let pace = 0;
            if (oneMin.length >= 2) {
                const first = oneMin[0];
                const last = oneMin[oneMin.length - 1];
                const dh = last.hits - first.hits;
                const dt = (last.time - first.time) / 60000; // minutes
                if (dt > 0) pace = Math.max(0, Math.round(dh / dt));
            }

            // drop risk
            let risk = "Low";
            if (timeout < 50) risk = "Medium";
            if (timeout < 30) risk = "High";
            if (timeout < 15) risk = "Critical";

            const sitrep = {
                chainID: hits > 0 ? 1 : 0,
                hits,
                timeLeft: timeout,
                currentPace: pace,
                requiredPace: 0, // left for future refinement
                dropRisk: risk,
                warning: risk === "Critical" ? "CHAIN AT RISK" : "OK",
                message: risk === "Critical" ? "Immediate hits required to save chain." : ""
            };

            this.general.signals.dispatch("CHAIN_SITREP", sitrep);
        },

        /* =========================
         * FACTION ENGINE (BASIC)
         * ========================= */
        processFaction(faction) {
            const members = faction.members || {};
            const now = Date.now();
            let online = 0, hosp = 0, jail = 0;

            Object.values(members).forEach(m => {
                if (!m) return;
                const st = (m.status?.state || "").toLowerCase();
                if (m.lastSeen && (now - m.lastSeen < 600000)) online++;
                if (st.includes("hospital")) hosp++;
                if (st.includes("jail")) jail++;
            });

            this.memory.factionHistory.push({ time: now, online, hosp, jail });
            const cutoff = now - 300000; // 5 min
            this.memory.factionHistory = this.memory.factionHistory.filter(f => f.time >= cutoff);
        },

        /* =========================
         * WAR ENGINE
         * ========================= */
        processWar(intel) {
            const faction = intel.faction || {};
            const chain = intel.chain || {};

            // Derive "enemy" targets from faction members for now.
            const enemyTargets = this.deriveEnemyTargets(faction);
            const stats = this.deriveWarStats(enemyTargets, chain);

            const now = Date.now();
            this.memory.warHistory.push({
                time: now,
                enemyOnline: stats.enemyOnline,
                threat: stats.threat
            });
            const cutoff = now - 300000;
            this.memory.warHistory = this.memory.warHistory.filter(w => w.time >= cutoff);

            // Trend: is threat rising?
            const trend = this.calculateThreatTrend();

            // Score targets using our advanced but lightweight model
            const scored = this.scoreTargets(enemyTargets, {
                chainHits: chain.current || 0,
                chainTimeout: chain.timeout || 0,
                enemyOnline: stats.enemyOnline
            });

            const sitrep = {
                state: (chain.current || 0) > 0 ? "CHAINING" : "PEACE",
                chainPower: chain.modifier || 1,

                enemyOnline: stats.enemyOnline,
                enemyHospital: stats.enemyHospital,
                enemyJail: stats.enemyJail,
                enemyTravel: stats.enemyTravel,

                threat: stats.threat,
                danger: stats.danger,
                trend,                                   // "Rising", "Stable", "Falling"
                message: stats.message,

                targets: scored,
                topScore: scored.length ? scored[0].colonelScore : 0
            };

            this.general.signals.dispatch("WAR_SITREP", sitrep);
        },

        deriveEnemyTargets(faction) {
            const members = faction.members || {};
            const list = [];
            const now = Date.now();

            Object.values(members).forEach(m => {
                if (!m) return;

                list.push({
                    id: m.userID,
                    name: m.name || "Unknown",
                    level: m.level || 1,
                    status: m.status?.state || "Okay",
                    timer: m.status?.until || 0,
                    lastSeen: m.lastSeen || 0,
                    // For future: add respect, stats, etc.
                    isOnline: m.lastSeen && (now - m.lastSeen < 600000)
                });
            });

            return list;
        },

        deriveWarStats(list, chain) {
            let enemyOnline = 0, enemyHospital = 0, enemyJail = 0, enemyTravel = 0;
            const now = Date.now();

            list.forEach(t => {
                const st = (t.status || "").toLowerCase();
                if (t.lastSeen && (now - t.lastSeen < 600000)) enemyOnline++;
                if (st.includes("hospital")) enemyHospital++;
                if (st.includes("jail")) enemyJail++;
                if (st.includes("travel")) enemyTravel++;
            });

            let threat = enemyOnline * 2;
            if ((chain.current || 0) > 0) threat += 8;
            threat += enemyHospital * 0.5; // wounded but could recover
            threat += enemyTravel * 0.5;   // mobility

            let danger = "Low";
            if (threat >= 12) danger = "Medium";
            if (threat >= 24) danger = "High";
            if (threat >= 36) danger = "Extreme";

            const message =
                danger === "Extreme" ? "Hostile faction is highly active – exercise caution."
              : danger === "High"    ? "Elevated hostile presence detected."
              : danger === "Medium"  ? "Moderate hostile presence – stay aware."
              : "Hostile activity appears low.";

            return {
                enemyOnline,
                enemyHospital,
                enemyJail,
                enemyTravel,
                threat,
                danger,
                message
            };
        },

        calculateThreatTrend() {
            const hist = this.memory.warHistory;
            if (hist.length < 2) return "Stable";

            const first = hist[0];
            const last = hist[hist.length - 1];
            const dThreat = last.threat - first.threat;
            const dTime = (last.time - first.time) / 60000; // minutes

            if (dTime <= 0) return "Stable";

            const slope = dThreat / dTime;
            if (slope > 4) return "Rising";
            if (slope < -4) return "Falling";
            return "Stable";
        },

        /* =========================
         * TARGET SCORING
         * ========================= */
        processScoreRequest(list) {
            if (!list || !list.length) return;

            const scored = this.scoreTargets(list, {
                chainHits: this.memory.lastIntel?.chain?.current || 0,
                chainTimeout: this.memory.lastIntel?.chain?.timeout || 0,
                enemyOnline: 0 // not strictly needed for scoring, but could be used later
            });

            this.general.signals.dispatch("TARGET_SCORES_READY", { scored });
        },

        scoreTargets(list, context) {
            return list.map(t => ({
                ...t,
                colonelScore: this.scoreSingle(t, context)
            })).sort((a, b) => (b.colonelScore || 0) - (a.colonelScore || 0));
        },

        scoreSingle(t, context) {
            const now = Date.now();
            let s = 0;

            const level = Number(t.level) || 1;
            const status = (t.status || "").toLowerCase();
            const lastSeen = t.lastSeen || 0;
            const timerMs = t.timer || 0;
            const timerSec = timerMs / 1000;

            const chainHits = context.chainHits || 0;
            const chainTimeout = context.chainTimeout || 0;

            // Base value: mixture of level & being online
            s += level * 2;
            if (lastSeen && (now - lastSeen < 600000)) s += 10; // recently active

            // Status adjustments
            if (status.includes("hospital")) s -= 25;
            if (status.includes("jail")) s -= 20;
            if (status.includes("travel")) s -= 10;
            if (status.includes("okay")) s += 3;

            // Cooldown / recovery timer
            if (timerSec > 0) {
                // The further in the future, the lower the immediate priority
                s -= Math.min(20, timerSec / 10);
            }

            // Chain context:
            // During high-pressure chain (low timeout, many hits), we prefer faster, easier kills,
            // so slightly penalize very high levels.
            if (chainHits > 0) {
                if (chainTimeout < 30) {
                    if (level > 60) s -= 5;
                    if (level < 25) s += 5;
                }
            }

            // Clamp to 0+
            s = Math.max(0, Math.floor(s));

            return s;
        }
    };

    if (window.WAR_GENERAL) {
        WAR_GENERAL.register("Colonel", Colonel);
    } else {
        console.warn("[WAR_COLONEL v4.0] WAR_GENERAL missing – Colonel not registered.");
    }

})();
