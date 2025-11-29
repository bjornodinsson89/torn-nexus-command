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

(function() {
    "use strict";

    const Lieutenant = {
        general: null,
        interval: null,
        tick: 0,
        chainActive: false,
        chainTimeout: 0,
        lastError: null,

        init(G) {
            this.general = G;

            // Heartbeat: every 1s, decide if we should fetch
            this.interval = setInterval(() => {
                if (!this.general.intel.hasCredentials()) return;

                this.tick++;
                const rate = this.getRate(); // seconds between pulls

                if (this.tick >= rate) {
                    this.tick = 0;
                    this.requestIntel();
                }
            }, 1000);
        },

        // Dynamic polling based on chain status
        getRate() {
            if (this.chainActive && this.chainTimeout < 45) return 1;  // high tension
            if (this.chainActive) return 3;                             // active chain
            return 15;                                                  // peace
        },

        requestIntel() {
            // Selections tuned for Colonel + Major:
            // basic, profile, chain, faction, territory, war
            this.general.intel.request("basic,profile,chain,faction,territory,war")
                .then(d => {
                    this.lastError = null;
                    const intel = this.normalize(d);
                    this.general.signals.dispatch("RAW_INTEL", intel);
                })
                .catch(err => {
                    this.lastError = err;
                    if (typeof WARDBG === "function") {
                        WARDBG("Lieutenant INTEL ERROR: " + err);
                    }
                });
        },

        normalize(d) {
            const chain = d.chain || {};
            const profile = d.profile || {};
            const faction = d.faction || {};
            const war = d.war || {};

            // Maintain internal chain status for rate logic
            this.chainActive = (chain.current || 0) > 0;
            this.chainTimeout = chain.timeout || 0;

            return {
                user: {
                    id: profile.player_id,
                    name: profile.name,
                    level: profile.level,
                    hp: profile.life?.current,
                    max_hp: profile.life?.maximum,
                    status: profile.status?.state,
                    status_description: profile.status?.description,
                    last_action: {
                        relative: profile.last_action?.relative,
                        timestamp: profile.last_action?.timestamp
                    }
                },
                chain: {
                    hits: chain.current || 0,
                    timeLeft: chain.timeout || 0,
                    log: Array.isArray(chain.log) ? chain.log : []
                },
                faction: {
                    id: faction.faction_id,
                    name: faction.name,
                    members: faction.members || {},
                    rank: faction.rank,
                    chain_report: faction.chain_report || null
                },
                war: {
                    state: war.war?.status || "PEACE",
                    faction: war.war?.faction || {},
                    enemy: war.war?.enemy_faction || {},
                    enemyMembers: war.war?.enemy_faction?.members || {}
                }
            };
        }
    };

    if (typeof WAR_GENERAL !== "undefined") {
        WAR_GENERAL.register("Lieutenant", Lieutenant);
    } else if (typeof WARDBG === "function") {
        WARDBG("Lieutenant failed to register: WAR_GENERAL missing");
    }

})();
