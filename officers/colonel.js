/**
 * CODENAME: WAR_COLONEL
 * RANK: ⭐️⭐️⭐️ (Senior Officer)
 * MISSION: Data Analysis & Strategy
 */

(function() {

    const Colonel = {
        name: "Colonel (Logic)",
        general: null,

        // DEFAULT SETTINGS (If user hasn't touched sliders yet)
        settings: {
            panic: 60,   // Red Alert
            warning: 120 // Orange Alert
        },

        init: function(General) {
            this.general = General;
            this.loadOrders(); // Load from storage

            // 1. Listen for Intel
            General.signals.listen('RAW_INTEL', (data) => this.analyze(data));

            // 2. Listen for New Orders (Slider changes)
            General.signals.listen('CONFIG_UPDATE', () => {
                this.loadOrders();
                // console.log("[COLONEL] New threshold orders received.");
            });

            console.log(`🧠 [COLONEL] Strategic command center online.`);
        },

        loadOrders: function() {
            // Read from LocalStorage (Shared with Major)
            const savedPanic = localStorage.getItem("WAR_CFG_panic");
            const savedWarn = localStorage.getItem("WAR_CFG_warning");

            if (savedPanic) this.settings.panic = parseInt(savedPanic);
            if (savedWarn) this.settings.warning = parseInt(savedWarn);
        },

        analyze: function(raw) {
            if (!raw || raw.error) return;

            // --- CHAIN ANALYSIS ---
            const chain = raw.chain || {};
            const count = chain.current || 0;
            const timeout = chain.timeout || 0;
            const isChainActive = count > 0;

            // Determine Threat Level based on DYNAMIC settings
            let statusColor = "#aaaaaa"; 
            let isPanic = false;

            if (isChainActive) {
                if (timeout < this.settings.panic) {
                    statusColor = "#ff3333"; // RED (Panic)
                    isPanic = true;
                } else if (timeout < this.settings.warning) {
                    statusColor = "#ffaa33"; // ORANGE (Warning)
                } else {
                    statusColor = "#33ff33"; // GREEN (Safe)
                }
            }

            // --- COMPILE SITREP ---
            const sitrep = {
                timestamp: Date.now(),
                chainActive: isChainActive,
                isPanic: isPanic,
                status: {
                    color: statusColor,
                    text: isChainActive ? "ACTIVE" : "PEACE"
                },
                chain: {
                    current: count,
                    max: chain.max || 0,
                    timeout: timeout,
                    modifier: chain.modifier || 1,
                    endTime: Date.now() + (timeout * 1000) 
                },
                user: raw.status ? { state: raw.status.state, until: raw.status.until } : null
            };

            this.general.signals.dispatch('SITREP_UPDATE', sitrep);
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Colonel", Colonel);

})();
