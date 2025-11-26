
/**
 * LIEUTENANT v2 — Chain Operations Officer
 * Fully integrated build (Parts 1–4)
 */

(function () {

    const Lieutenant = {
        general: null,

        /* =======================================================
         * CHAIN MEMORY CORE
         * ======================================================= */

        memoryKey: "lieutenant_chain_memory_v2",
        memory: {
            active: false,
            chainID: 0,
            hits: 0,
            timeLeft: 0,
            requiredPace: 0,
            currentPace: 0,
            lastUpdate: Date.now(),
            hitHistory: [],
            paceHistory: [],
            predictedDropTime: 0
        },

        /* =======================================================
         * INITIALIZATION
         * ======================================================= */

        init(General) {
            this.general = General;
            this.loadMemory();

            General.signals.listen("RAW_INTEL", intel => {
                this.ingestRawIntel(intel);
            });

            General.signals.listen("CHAIN_DATA", data => {
                this.ingestChainData(data);
            });

            setInterval(() => this.runTick(), 1000);

            console.log("%c[Lieutenant v2] Chain Operations Online", "color:#4cf");
        },

        tick() {
            // lightweight; real update in runTick()
        },

        /* =======================================================
         * MEMORY
         * ======================================================= */

        loadMemory() {
            try {
                const raw = localStorage.getItem(this.memoryKey);
                if (raw) this.memory = JSON.parse(raw);
            } catch (e) {
                console.warn("[Lieutenant] Failed to load memory:", e);
            }
        },

        saveMemory() {
            try {
                localStorage.setItem(this.memoryKey, JSON.stringify(this.memory));
            } catch (e) {
                console.warn("[Lieutenant] Failed to save memory:", e);
            }
        },

        /* =======================================================
         * RAW INTEL INGESTION
         * ======================================================= */

        ingestRawIntel(intel) {
            if (!intel || !intel.chain) return;

            const c = intel.chain;

            this.memory.active = !!c.active;
            this.memory.chainID = c.chainID || c.chain_id || this.memory.chainID || 0;
            this.memory.hits = c.hits || c.current || this.memory.hits || 0;
            this.memory.timeLeft = c.timeLeft || c.time_left || this.memory.timeLeft || 0;
            this.memory.requiredPace = c.requiredPace || c.required || this.memory.requiredPace || 0;

            this.memory.lastUpdate = Date.now();
            this.saveMemory();
        },

        ingestChainData(data) {
            if (!data) return;
            this.memory.active = true;
            this.memory.chainID = data.chainID || data.id || this.memory.chainID;
            this.memory.hits = data.hits ?? this.memory.hits;
            this.memory.timeLeft = data.timeLeft ?? this.memory.timeLeft;
            this.memory.requiredPace = data.requiredPace ?? this.memory.requiredPace;
            this.memory.lastUpdate = Date.now();
            this.saveMemory();
        },

        /* =======================================================
         * HIT REGISTRATION
         * ======================================================= */

        registerHit() {
            const now = Date.now();
            this.memory.hitHistory.push(now);
            this.memory.hitHistory = this.memory.hitHistory.filter(
                t => now - t < 10 * 60 * 1000
            );
            this.memory.hits++;
            this.saveMemory();
        },

        /* =======================================================
         * INTERNAL TICK
         * ======================================================= */

        runTick() {
            if (!this.memory.active) return;

            this.memory.timeLeft -= 1;
            if (this.memory.timeLeft < 0) this.memory.timeLeft = 0;

            this.calculatePace();
            this.saveMemory();
            this.outputChainSitrep();
        },

        /* =======================================================
         * BASIC PACE CALCULATION
         * ======================================================= */

        calculatePace() {
            const hits = this.memory.hitHistory.length;
            const windowMinutes = 10;
            const pace = hits / windowMinutes;

            this.memory.currentPace = pace;
            this.memory.paceHistory.push({ t: Date.now(), pace });

            if (this.memory.paceHistory.length > 50) {
                this.memory.paceHistory.shift();
            }
        },

        /* =======================================================
         * ADVANCED PACING ENGINE
         * ======================================================= */

        getRequiredHitsInWindow() {
            return this.memory.requiredPace * 10;
        },

        getCurrentHitsInWindow() {
            return this.memory.hitHistory.length;
        },

        getCatchUpDeficit() {
            const need = this.getRequiredHitsInWindow();
            const have = this.getCurrentHitsInWindow();
            return Math.max(0, need - have);
        },

        computeOptimalWindow() {
            const timeLeft = this.memory.timeLeft;
            let message = "Stable";

            if (timeLeft > 300) {
                message = "Maintain steady pace.";
            } else if (timeLeft > 120) {
                message = "Mid-chain: tighten pacing slightly.";
            } else if (timeLeft <= 120 && timeLeft > 60) {
                message = "Approaching risk zone. Increase pace.";
            } else if (timeLeft <= 60) {
                message = "Critical: hit now or coordinate a burst.";
            }

            return message;
        },

        detectSurge() {
            const pace = this.memory.currentPace;
            const req = this.memory.requiredPace || 0;

            if (!req) return "No required pace data.";

            if (pace > req * 1.4) return "Surge detected (over-performing)";
            if (pace < req * 0.7) return "Under-performing (risk building)";
            return "Pace acceptable";
        },

        computeDropRisk() {
            const time = this.memory.timeLeft;
            const deficit = this.getCatchUpDeficit();
            const pace = this.memory.currentPace;
            const req = this.memory.requiredPace || 0;

            let risk = "Low";

            if (!req) return "Unknown";

            if (deficit > 4 || pace < req * 0.8) risk = "Medium";
            if (deficit > 8 || pace < req * 0.6) risk = "High";
            if (time < 40 && deficit > 2) risk = "Critical";

            return risk;
        },

        getTacticalAdvice() {
            const risk = this.computeDropRisk();
            const windowMessage = this.computeOptimalWindow();
            const surge = this.detectSurge();

            let advice = "";

            if (risk === "Critical") {
                advice = "Hit immediately. Coordinate a push.";
            } else if (risk === "High") {
                advice = "Energy recommended now. Tighten chain.";
            } else if (risk === "Medium") {
                advice = "Below optimal pace — consider a hit.";
            } else {
                advice = "You are safe. Maintain pace.";
            }

            return {
                risk,
                windowMessage,
                surge,
                advice
            };
        },

        /* =======================================================
         * PREDICTIVE MODELING
         * ======================================================= */

        predictFuturePace() {
            const history = this.memory.paceHistory;
            if (history.length < 5) return this.memory.currentPace || 0;

            const last = history.slice(-5).map(h => h.pace);
            const avg = last.reduce((a, b) => a + b, 0) / last.length;
            return avg;
        },

        forecastDropTime() {
            const pace = this.predictFuturePace();
            const req = this.memory.requiredPace || 0;

            if (!req || pace >= req) return Infinity;

            const deficitRate = req - pace;
            const deficit = this.getCatchUpDeficit();

            if (deficitRate <= 0) return Infinity;

            const minutesToFailure = deficit / deficitRate;
            return minutesToFailure * 60;
        },

        computeBufferWindow() {
            const req = this.memory.requiredPace || 0;
            const pace = this.memory.currentPace || 0;

            if (!req) return "Unknown";

            if (pace >= req) {
                return "Positive buffer (ahead of pace)";
            }

            const deficit = this.getCatchUpDeficit();

            if (deficit <= 2) return "Minimal deficit (stable)";
            if (deficit <= 5) return "Light deficit (watch pacing)";
            if (deficit <= 10) return "Moderate deficit (needs correction)";
            return "Critical deficit (burst required)";
        },

        evaluateEnemyInterference() {
            if (!window.WAR_GENERAL || !WAR_GENERAL.officers["Colonel"]) return "Unknown";

            const Colonel = WAR_GENERAL.officers["Colonel"];
            const enemies = (Colonel.memory && Colonel.memory.enemies) || {};

            let totalAgg = 0;
            let rising = 0;

            Object.values(enemies).forEach(e => {
                totalAgg += (e.aggression || 0);
                if (e.threatTrend === "rising") rising++;
            });

            if (totalAgg > 50 || rising > 5)
                return "High interference (enemy surge)";
            if (totalAgg > 25)
                return "Moderate interference";
            if (rising > 2)
                return "Possible interference";
            return "Low interference";
        },

        getForecast() {
            const futurePace = this.predictFuturePace();
            const dropTime = this.forecastDropTime();
            const buffer = this.computeBufferWindow();
            const interference = this.evaluateEnemyInterference();

            let stability = "Safe";

            if (dropTime < 180) stability = "Critical";
            else if (dropTime < 300) stability = "High risk";
            else if (dropTime < 600) stability = "Moderate";
            else stability = "Safe";

            return {
                futurePace,
                dropTime,
                buffer,
                interference,
                stability
            };
        },

        /* =======================================================
         * ENERGY & TIMING ADVICE
         * ======================================================= */

        getEnergyRecommendation() {
            const forecast = this.getForecast();
            const risk = forecast.stability;
            const interference = forecast.interference;
            const timeLeft = this.memory.timeLeft;
            const req = this.memory.requiredPace || 0;
            const pace = this.memory.currentPace || 0;

            if (risk === "Critical") {
                return "⚠️ CRITICAL: Dump energy NOW — chain near failure.";
            }

            if (risk === "High risk") {
                return "Emergency window: use energy soon. Coordinate faction hits.";
            }

            if (risk === "Moderate") {
                if (interference.includes("High"))
                    return "Enemy surge detected — recommend using some energy now.";
                if (pace < req)
                    return "Below pace: consider a hit.";
                return "Moderate risk: hold but be ready.";
            }

            if (risk === "Safe") {
                if (timeLeft < 180)
                    return "Approaching end: safe to wait unless surges appear.";
                return "Safe window: conserve energy.";
            }

            return "No energy recommendation available.";
        },

        getHitTimingAdvice() {
            const forecast = this.getForecast();
            const risk = forecast.stability;
            const time = this.memory.timeLeft;

            if (risk === "Critical")
                return "Strike immediately — every second counts.";
            if (risk === "High risk")
                return "Hit ASAP. Sync with faction for burst.";

            if (risk === "Moderate") {
                if (time < 120) return "Hit within the next 30s.";
                return "Monitor pace — hit if deficit rises.";
            }

            if (risk === "Safe") {
                if (time < 150) return "Wait — long chain buffer still available.";
                return "Hold — no urgency.";
            }

            return "Timing advice unavailable.";
        },

        generateWarnings() {
            const forecast = this.getForecast();
            const interference = forecast.interference;
            const risk = forecast.stability;

            const warnings = [];

            if (risk === "Critical")
                warnings.push("Chain collapse imminent!");
            else if (risk === "High risk")
                warnings.push("High chain instability.");

            if (interference.includes("High"))
                warnings.push("Enemy surge (Colonel warning).");

            if (forecast.futurePace < (this.memory.requiredPace || 0) * 0.8)
                warnings.push("Future pace trending downward.");

            if (forecast.buffer.includes("Critical deficit"))
                warnings.push("Deficit too large — burst required.");

            return warnings.length ? warnings.join(" | ") : "None";
        },

        /* =======================================================
         * ENHANCED CHAIN SITREP OUTPUT
         * ======================================================= */

        outputChainSitrep() {
            const m = this.memory;

            const forecast = this.getForecast();
            const warnings = this.generateWarnings();

            const timingAdvice = this.getHitTimingAdvice();
            const energyAdvice = this.getEnergyRecommendation();

            this.general.signals.dispatch("CHAIN_SITREP", {
                chainID: m.chainID,
                hits: m.hits,
                timeLeft: m.timeLeft,
                requiredPace: m.requiredPace,
                currentPace: m.currentPace,

                dropRisk: forecast.stability,
                warning: warnings,
                message: timingAdvice,

                futurePace: isFinite(forecast.futurePace)
                    ? forecast.futurePace.toFixed(2)
                    : "N/A",
                forecastDropTime:
                    forecast.dropTime === Infinity
                        ? "Safe"
                        : `${Math.floor(forecast.dropTime)}s`,
                buffer: forecast.buffer,
                interference: forecast.interference,
                stability: forecast.stability,

                energyAdvice,
                timingAdvice
            });
        }
    };

    if (window.WAR_GENERAL) {
        WAR_GENERAL.register("Lieutenant", Lieutenant);
    } else {
        console.warn("[LIEUTENANT v2] WAR_GENERAL not found; Lieutenant not registered.");
    }

})();
