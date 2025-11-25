/**
 * CODENAME: WAR_LIEUTENANT
 * RANK: ⭐️ (Junior Officer)
 * MISSION: Reconnaissance & Traffic Control
 */

(function() {

    const Lieutenant = {
        name: "Lieutenant (API)",
        general: null,
        patrolTimer: null,
        currentInterval: 30000, 
        requirements: "basic,chain,timestamp",
        
        // --- ADDED: API KEY STORAGE ---
        apiKey: null, 

        init: function(General) {
            this.general = General;
            
            // Try to load API key (You can change this logic later)
            this.apiKey = localStorage.getItem('WAR_API_KEY');

            General.signals.listen('SITREP_UPDATE', (sitrep) => {
                this.adjustTactics(sitrep);
            });
            
            console.log(`👁 [LIEUTENANT] Starting patrol loop...`);
            this.performRecon();
        },

        // --- ADDED: MISSING FUNCTION ---
        hasCredentials: function() {
            // Returns true if we have a key, false if not
            return this.apiKey && this.apiKey.length > 0;
        },

        // --- ADDED: MISSING FUNCTION ---
        request: function(selection) {
            return new Promise((resolve, reject) => {
                if (!this.hasCredentials()) {
                    reject("No API Key");
                    return;
                }

                // REAL API CALL
                const url = `https://api.torn.com/user/?selections=${selection}&key=${this.apiKey}`;
                
                // We use the General's window context or GM_xmlhttpRequest if available
                // For now, using standard fetch for simplicity
                fetch(url)
                    .then(res => res.json())
                    .then(data => {
                        if (data.error) reject(data.error.error);
                        else resolve(data);
                    })
                    .catch(err => reject(err));
            });
        },

        performRecon: function() {
            // Now this function exists, so it won't crash!
            if (!this.general.intel.hasCredentials()) {
                console.log("👁 [LIEUTENANT] No Credentials found. Pausing.");
                this.scheduleNext(10000); // Check again in 10s
                return;
            }

            this.general.intel.request(this.requirements)
                .then(data => {
                    this.general.signals.dispatch('RAW_INTEL', data);
                })
                .catch(err => {
                    console.warn(`👁 [LIEUTENANT] Recon failed: ${err}`);
                })
                .finally(() => {
                    this.scheduleNext(this.currentInterval);
                });
        },

        scheduleNext: function(ms) {
            if (this.patrolTimer) clearTimeout(this.patrolTimer);
            this.patrolTimer = setTimeout(() => this.performRecon(), ms);
        },

        adjustTactics: function(sitrep) {
            let targetInterval = 30000; 

            if (sitrep.isPanic) {
                targetInterval = 2000; 
            } else if (sitrep.chainActive) {
                targetInterval = 5000; 
            }

            if (targetInterval !== this.currentInterval) {
                this.currentInterval = targetInterval;
            }
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Lieutenant", Lieutenant);

})();
