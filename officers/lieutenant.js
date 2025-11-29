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
            if (this.interval) clearInterval(this.interval);
            this.interval = setInterval(() => {
                if (!this.general.intel.hasCredentials()) return;

                this.tick++;
                const rate = this.getRate(); // seconds between pulls

                if (this.tick >= rate) {
                    this.tick = 0;
                    this.requestIntel();
                }
            }, 1000);

            if (typeof WARDBG === "function") {
                WARDBG("Lieutenant online (v7.6)");
            }
        },

        // Dynamic polling based on chain status
        getRate() {
            if (this.chainActive && this.chainTimeout < 45) return 1;  // high tension
            if (this.chainActive) return 3;                             // active chain
            return 15;                                                  // peace
        },

        requestIntel() {
            // Selections tuned for Colonel + Major + Sergeant:
            // basic, profile, chain, faction, war
            this.general.intel.request("basic,profile,chain,faction,war")
                .then(d => {
                    this.lastError = null;
                    const intel = this.normalize(d);

                    // Broadcast normalized RAW_INTEL to Colonel + Sergeant
                    this.general.signals.dispatch("RAW_INTEL", intel);

                    if (typeof WARDBG === "function") {
                        WARDBG("Lieutenant: RAW_INTEL dispatched");
                    }
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
            const basic = d.basic || {};

            // Maintain internal chain status for rate logic
            this.chainActive = (chain.current || 0) > 0;
            this.chainTimeout = chain.timeout || 0;

            // --- USER ---
            const user = {
                id: profile.player_id,
                name: profile.name,
                level: profile.level,
                faction_id: profile.faction || null,
                hp: profile.life?.current,
                max_hp: profile.life?.maximum,
                status: profile.status?.state,
                status_description: profile.status?.description,
                last_action: {
                    relative: profile.last_action?.relative,
                    timestamp: profile.last_action?.timestamp
                }
            };

            // --- CHAIN ---
            const chainObj = {
                hits: chain.current || 0,
                timeLeft: chain.timeout || 0,
                type: chain.type || null,
                respect: chain.respect || 0,
                max: chain.max || 0,
                started: chain.start || null,
                cooldown: chain.cooldown || 0,
                log: Array.isArray(chain.log) ? chain.log : []
            };

            // --- FACTION (as OBJECT MAP for members) ---
            const membersMap = faction.members || {};
            const factionObj = {
                id: faction.faction_id,
                name: faction.name,
                tag: faction.tag,
                rank: faction.rank,
                territory_count: faction.territory?.length || 0,
                members: membersMap,
                chain_report: faction.chain_report || null
            };

            // --- WAR / ENEMY FACTION ---
            const warRoot = war.war || {};
            const enemyFaction = warRoot.enemy_faction || {};
            const enemyMembers = enemyFaction.members || {};

            const warObj = {
                state: warRoot.status || "PEACE",
                faction: warRoot.faction || {},
                enemy: enemyFaction,
                enemyMembers: enemyMembers
            };

            return {
                user,
                chain: chainObj,
                faction: factionObj,
                war: warObj,
                timestamp: Date.now()
            };
        }
    };

    // Register with General if available
    if (typeof WAR_GENERAL !== "undefined") {
        WAR_GENERAL.register("Lieutenant", Lieutenant);
    } else if (typeof WARDBG === "function") {
        WARDBG("Lieutenant failed to register: WAR_GENERAL missing");
    }

})();
