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

        init: function(General) {
            this.general = General;
            
            General.signals.listen('SITREP_UPDATE', (sitrep) => {
                this.adjustTactics(sitrep);
            });
            
            console.log(`👁 [LIEUTENANT] Starting patrol loop...`);
            this.performRecon();
        },

        performRecon: function() {
            if (!this.general.intel.hasCredentials()) {
                this.scheduleNext(5000); 
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
