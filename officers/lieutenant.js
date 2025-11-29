// lieutenant.js 

////////////////////////////////////////////////////////////
// LIEUTENANT — INTEL ACQUISITION ENGINE
// Responsible for:
//  - Adaptive heartbeat based on chain pressure
//  - Safe API usage (no 429 errors)
//  - Intel normalization
//  - Chain momentum and collapse prediction
//  - Feeding Colonel + Sergeant + Major with raw intel
//  -(API MANAGER) ===
//  - Decides *when* and *what* to fetch from Torn
////////////////////////////////////////////////////////////

(function(){
"use strict";

const Lieutenant = {

    general: null,
    tick: 0,
    chainActive: false,
    chainTimeout: 0,
    interval: null,

    init(G) {
        this.general = G;

        if (typeof WARDBG === "function")
            WARDBG("Lieutenant online (v8.0 API FIX)");

        // Poll every second → adaptive rate
        this.interval = setInterval(() => {
            if (!this.general.intel.hasCredentials()) return;
            this.tick++;
            if (this.tick >= this.getRate()) {
                this.tick = 0;
                this.fetchIntel();
            }
        }, 1000);
    },

    // Adaptive intelligence polling
    getRate() {
        if (this.chainActive && this.chainTimeout < 45) return 1;
        if (this.chainActive) return 3;
        return 12;
    },

    // -------------------------
    // MAIN API CALL
    // -------------------------
    fetchIntel() {
        const selections =
            "basic,personalstats,battlestats,chain,faction,travel";

        this.general.intel.request(selections)
            .then(raw => this.handleSuccess(raw))
            .catch(err => {
                if (typeof WARDBG === "function")
                    WARDBG("Lieutenant INTEL ERROR: " + err);
            });
    },

    handleSuccess(raw) {
        const chain = raw.chain || {};

        this.chainActive = (chain.current || 0) > 0;
        this.chainTimeout = chain.timeout || 0;

        const intel = this.normalize(raw);
        this.general.signals.dispatch("RAW_INTEL", intel);
    },

    // -------------------------
    // NORMALIZATION
    // -------------------------
    normalize(d) {
        const c = d.chain || {};
        const f = d.faction || {};
        const b = d.basic || {};

        return {
            user: {
                id: b.player_id,
                name: b.name,
                level: b.level,
                status: b.status?.state,
                hp: b.life?.current,
                max_hp: b.life?.maximum,
                last_action: b.last_action
            },

            chain: {
                hits: c.current || 0,
                timeLeft: c.timeout || 0,
                log: c.log || []
            },

            faction: {
                id: f.faction_id,
                name: f.name,
                members: f.members || {}
            },

            // 🔥 No longer provided by Torn API
            war: {
                state: "NO_DATA",
                faction: {},
                enemy: {},
                enemyMembers: {}
            }
        };
    }
};

if (typeof WAR_GENERAL !== "undefined") {
    WAR_GENERAL.register("Lieutenant", Lieutenant);
}

})();
