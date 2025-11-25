/**
 * CODENAME: WAR_LIEUTENANT
 * RANK: Tactical Intelligence Officer (v2)
 * MISSION: Smart Recon, Adaptive Polling, Hybrid API Targeting
 * NOTES:
 *   - Never fetches directly
 *   - Never touches the API key
 *   - Only requests through WAR_GENERAL.intel.request()
 *   - Determines WHEN and WHAT intel is needed
 *   - Emits tactical signals
 */

(function() {

    const Lieutenant = {
        name: "Lieutenant v2",
        general: null,

        // Tactical state
        polling: null,
        mode: "peace", // peace | chain | panic
        lastIntelTs: 0,

        // Timing presets (ms)
        intervals: {
            peace:  15000,
            chain:  5000,
            panic:  1500
        },

        // For recovery logic
        consecutiveFails: 0,
        failThreshold: 3,

        init(General) {
            this.general = General;
            console.log("👁 [LIEUTENANT v2] Tactical Recon online.");

            // Watch for SITREPs from Colonel to adjust tactics
            General.signals.listen("SITREP_UPDATE", (sitrep) => {
                this.updateTacticalMode(sitrep);
            });

            // Watch API faults
            General.signals.listen("API_ERROR",    () => this.handleApiFault());
            General.signals.listen("API_TIMEOUT",  () => this.handleApiFault());
            General.signals.listen("API_NETWORK_ERROR", () => this.handleApiFault());
            General.signals.listen("API_RATE_LIMIT",   () => this.handleApiFault());

            // Watch successful API
            General.signals.listen("RAW_INTEL", () => {
                this.consecutiveFails = 0;
            });

            // Ensure API key state is confirmed
            General.signals.listen("API_KEY_UPDATED", () => {
                this.startPatrol();
            });

            // Begin if key already exists
            if (General.intel.hasCredentials()) {
                this.startPatrol();
            } else {
                console.warn("👁 [LIEUTENANT v2] No API key, patrol on standby.");
            }
        },

        // ---------------------------
        // PATROL ENGINE
        // ---------------------------
        startPatrol() {
            if (this.polling) clearTimeout(this.polling);
            console.log("👁 [LIEUTENANT v2] Patrol started.");
            this.scheduleNext();
        },

        scheduleNext() {
            if (this.polling) clearTimeout(this.polling);
            const delay = this.intervals[this.mode] || this.intervals.peace;

            this.polling = setTimeout(() => {
                this.performRecon();
            }, delay);
        },

        // ---------------------------
        // RECON LOGIC
        // ---------------------------
        performRecon() {
            if (!this.general.intel.hasCredentials()) {
                console.warn("👁 [LIEUTENANT v2] No credentials. Pausing recon.");
                this.scheduleNext();
                return;
            }

            const now = Date.now();
            const sinceLast = now - this.lastIntelTs;

            // Skip if last intel too recent
            // (General caching already helps but this reduces load further)
            if (sinceLast < 500) {
                this.scheduleNext();
                return;
            }

            this.lastIntelTs = now;

            // Request unified intel block from General (v1 auto)
            const requestMeta = {
                version: "auto",
                endpoint: "user",
                selections: ["basic", "chain", "faction", "bars", "profile", "timestamp"],
                normalize: true
            };

            this.general.signals.dispatch("INTEL_REQUESTED", { mode: this.mode });

            this.general.intel.request(requestMeta)
                .then(data => {
                    this.general.signals.dispatch("RAW_INTEL", data);
                })
                .catch(err => {
                    console.warn("👁 [LIEUTENANT v2] Recon error:", err);
                })
                .finally(() => {
                    this.scheduleNext();
                });
        },

        // ---------------------------
        // MODE ADJUSTMENT (BASED ON COLONEL)
        // ---------------------------
        updateTacticalMode(sitrep) {
            if (!sitrep || !sitrep.chain) {
                this.changeMode("peace");
                return;
            }

            const timeout = sitrep.chain.timeout ?? 0;
            const active = sitrep.chain.current > 0;

            if (!active) {
                this.changeMode("peace");
            } 
            else if (timeout < 60) {
                this.changeMode("panic");
            } 
            else {
                this.changeMode("chain");
            }
        },

        changeMode(newMode) {
            if (newMode === this.mode) return;
            this.mode = newMode;
            console.log(`👁 [LIEUTENANT v2] Tactical mode now: ${newMode.toUpperCase()}`);
            this.general.signals.dispatch("TACTIC_SHIFT", { mode: newMode });
            this.scheduleNext();
        },

        // ---------------------------
        // FAULT RECOVERY
        // ---------------------------
        handleApiFault() {
            this.consecutiveFails++;
            if (this.consecutiveFails >= this.failThreshold) {
                console.warn("👁 [LIEUTENANT v2] Too many API failures — entering safe mode.");
                this.changeMode("peace");
                this.consecutiveFails = 0;
            }
        }

    };

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Lieutenant", Lieutenant);
    }

})();
