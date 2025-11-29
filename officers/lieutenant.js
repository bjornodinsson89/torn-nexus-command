// lieutenant.js 

////////////////////////////////////////////////////////////
// LIEUTENANT — INTEL ACQUISITION ENGINE
// Responsible for:
//  - Adaptive heartbeat based on chain pressure
//  - Safe API usage
//  - Pulls all major intel from Torn API v2, falls back to v1 only where needed.
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

    init(G) {
        this.general = G;

        WARDBG("Lieutenant v8.3 (API v2-first) ready.");

        // Heartbeat — every 1s, adaptive
        setInterval(() => {
            if (!this.general.intel.hasCredentials()) return;

            this.tick++;
            const rate = this.getRate();

            if (this.tick >= rate) {
                this.tick = 0;
                this.fetchIntel();
            }
        }, 1000);
    },

    // Adaptive polling speed
    getRate() {
        if (this.chainActive && this.chainTimeout < 45) return 1;
        if (this.chainActive) return 3;
        return 12;
    },

    // -------------------------
    // MASTER INTEL FETCH (API v2)
    // -------------------------
    async fetchIntel() {
        try {
            const RAW = await this.pullAllIntel();
            this.general.signals.dispatch("RAW_INTEL", RAW);
        } catch (err) {
            WARDBG("Lieutenant ERROR: " + err);
        }
    },

    // -------------------------
    // MASTER INTEL ROUTINE
    // -------------------------
    async pullAllIntel() {

        // -- PARALLEL USER v2 CALLS --
        const [
            userBasic,           // /v2/user/basic
            userStats,           // /v2/user/battlestats
            userBars,            // /v2/user/bars
            userState,           // /v2/user/status
            userChain,           // /v2/user/chain
            userAttacks,         // /v2/user/attacks
            userFaction          // /v2/user/faction
        ] = await Promise.all([
            this.v2("/user/basic"),
            this.v2("/user/battlestats"),
            this.v2("/user/bars"),
            this.v2("/user/status"),
            this.v2("/user/chain"),
            this.v2("/user/attacks"),
            this.v2("/user/faction")
        ]);

        const factionId = userFaction.faction?.faction_id || null;

        // -- PULL OWN FACTION —
        let factionBasic = null;
        let factionMembers = null;
        let factionWars = null;
        let factionChain = null;

        if (factionId) {
            [factionBasic, factionMembers, factionWars, factionChain] = await Promise.all([
                this.v2(`/faction/${factionId}/basic`),
                this.v2(`/faction/${factionId}/members`),
                this.v2(`/faction/${factionId}/wars`),
                this.v2(`/faction/${factionId}/chain`)
            ]);
        }

        // -- Identify enemy factions in wars --
        const enemies = [];

        if (factionWars?.wars) {
            for (const wid in factionWars.wars) {
                const war = factionWars.wars[wid];
                const enemyId = war.enemy_faction || war.opponent || null;

                if (!enemyId) continue;

                const enemyMembers = await this.v2(`/faction/${enemyId}/members`)
                    .catch(() => null);

                enemies.push({
                    id: enemyId,
                    name: enemyMembers?.name || "Unknown",
                    members: enemyMembers?.members || {}
                });
            }
        }

        // -- Supplemental v1 calls (minimal) --
        // Only pull what v2 *cannot* provide natively:
        const supplemental = await this.general.intel.requestUser("networth")
            .catch(() => ({ networth: null }));

        // Update internal chain state (affects polling)
        const c = userChain?.chain || {};
        this.chainActive = c.hits > 0;
        this.chainTimeout = c.timeout || 0;

        // Build RAW_INTEL
        return {
            timestamp: Date.now(),

            user: {
                id: userBasic?.user_id,
                name: userBasic?.name,
                level: userBasic?.level,
                gender: userBasic?.gender,
                status: userState?.status,
                last_action: userState?.last_action,
                hp: userState?.hp?.current,
                max_hp: userState?.hp?.maximum,
                bars: userBars?.bars,
                stats: userStats?.battlestats
            },

            chain: {
                hits: c.hits,
                timeout: c.timeout,
                cooldown: c.cooldown,
                modifiers: c.modifiers || {},
                full: c
            },

            faction: {
                id: factionId,
                name: factionBasic?.name,
                founder: factionBasic?.founder,
                respect: factionBasic?.respect,
                members: factionMembers?.members || {},
                chain: factionChain?.chain || {},
                wars: factionWars?.wars || {}
            },

            enemies,

            attacks: userAttacks?.attacks || [],
            supplemental
        };
    },

    // -------------------------
    // v2 API helper
    // -------------------------
    async v2(path, params = {}) {
        return this.general.intel.requestV2(path, params);
    }
};

if (typeof WAR_GENERAL !== "undefined") {
    WAR_GENERAL.register("Lieutenant", Lieutenant);
}

})();
