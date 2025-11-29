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
    nexus: null,
    tick: 0,
    chainActive: false,
    chainTimeout: 0,
    interval: null,
    init(nexus) {
        this.nexus = nexus;
        this.start();
    },
    start() {
        this.interval = setInterval(() => {
            if (!this.nexus.intel.hasCredentials()) return;
            this.tick++;
            const rate = this.getRate();
            if (this.tick >= rate) {
                this.tick = 0;
                this.fetchAllIntel();
            }
        }, 1000);
    },
    getRate() {
        if (this.chainActive && this.chainTimeout < 45) return 1;
        if (this.chainActive) return 3;
        return 12;
    },
    async fetchAllIntel() {
        try {
            const raw = await this.pullIntel();
            this.nexus.events.emit("RAW_INTEL", raw);
        } catch(e) {
            this.nexus.log("Lieutenant ERROR: " + e);
        }
    },
    async pullIntel() {
        const userBasic = this.nexus.intel.requestV2("/user/basic");
        const userStats = this.nexus.intel.requestV2("/user/battlestats");
        const userBars = this.nexus.intel.requestV2("/user/bars");
        const userStatus = this.nexus.intel.requestV2("/user/status");
        const userChain = this.nexus.intel.requestV2("/user/chain");
        const userFaction = this.nexus.intel.requestV2("/user/faction");
        const userAttacks = this.nexus.intel.requestV2("/user/attacks");

        const [
            basic,
            stats,
            bars,
            state,
            chain,
            factionEntry,
            attacks
        ] = await Promise.all([
            userBasic,
            userStats,
            userBars,
            userStatus,
            userChain,
            userFaction,
            userAttacks
        ]);

        const factionId = factionEntry?.faction?.faction_id || null;

        let factionBasic = null;
        let factionMembers = null;
        let factionWars = null;
        let factionChain = null;

        if (factionId) {
            const fb = this.nexus.intel.requestV2(`/faction/${factionId}/basic`);
            const fm = this.nexus.intel.requestV2(`/faction/${factionId}/members`);
            const fw = this.nexus.intel.requestV2(`/faction/${factionId}/wars`);
            const fc = this.nexus.intel.requestV2(`/faction/${factionId}/chain`);
            const result = await Promise.all([fb, fm, fw, fc]);
            factionBasic = result[0];
            factionMembers = result[1];
            factionWars = result[2];
            factionChain = result[3];
        }

        const enemies = [];
        if (factionWars?.wars) {
            for (const wid in factionWars.wars) {
                const war = factionWars.wars[wid];
                const enemyId = war.enemy_faction || war.opponent || null;
                if (!enemyId) continue;
                const enemy = await this.nexus.intel.requestV2(`/faction/${enemyId}/members`).catch(()=>null);
                enemies.push({
                    id: enemyId,
                    name: enemy?.name || "Unknown",
                    members: enemy?.members || {}
                });
            }
        }

        let supplemental = {};
        try {
            // PATCH: use existing V1 helper instead of nonexistent requestUserV1
            supplemental = await this.nexus.intel.requestV1("user", "networth");
        } catch(e) {
            supplemental = {};
        }

        const c = chain?.chain || {};
        this.chainActive = !!c.hits;
        this.chainTimeout = c.timeout || 0;

        return {
            timestamp: Date.now(),
            user: {
                id: basic?.user_id || null,
                name: basic?.name || "",
                level: basic?.level || 0,
                gender: basic?.gender || "",
                status: state?.status || "",
                last_action: state?.last_action || {},
                hp: state?.hp?.current || 0,
                max_hp: state?.hp?.maximum || 0,
                bars: bars?.bars || {},
                stats: stats?.battlestats || {}
            },
            chain: {
                hits: c.hits || 0,
                timeout: c.timeout || 0,
                cooldown: c.cooldown || 0,
                modifiers: c.modifiers || {},
                full: c
            },
            faction: {
                id: factionId,
                name: factionBasic?.name || "",
                founder: factionBasic?.founder || "",
                respect: factionBasic?.respect || 0,
                members: factionMembers?.members || {},
                chain: factionChain?.chain || {},
                wars: factionWars?.wars || {}
            },
            enemies,
            attacks: attacks?.attacks || [],
            supplemental
        };
    }
};

/* BLOCK: SELF REGISTRATION */

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Lieutenant", module: Lieutenant });

})();
