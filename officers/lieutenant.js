// lieutenant.js — INTEL 

(function(){
"use strict";

/* ------------------------------------------------------------ */
/* UTILITIES                                                    */
/* ------------------------------------------------------------ */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// Safe wrapper to prevent failures from halting the pipeline
async function safeGet(fn){
    try {
        const r = await fn();
        await sleep(450);
        return r;
    } catch(e){
        console.warn("Nexus API Fail (Recovered):", e);
        return null;
    }
}

/* ------------------------------------------------------------ */
/* LIEUTENANT CORE                                               */
/* ------------------------------------------------------------ */
const Lieutenant = {
    nexus: null,
    
    lastFullIntelTs: 0,
    fullIntelCache: null,
    drawerOpen: false,

    chainTimer: null,
    enemyTimer: null,
    chainPollFunc: null,
    enemyPollFunc: null,

    init(nexus){
        this.nexus = nexus;

        // Listen for drawer
        this.nexus.events.on("UI_DRAWER_OPENED", () => {
            this.drawerOpen = true;
            this.runFullIntelIfNeeded();
        });

        // Boot light intel
        setTimeout(() => this.runLightIntel(), 1000);

        // Start loops
        this.startChainPolling();
        this.startEnemyPolling();
    },

    /* ------------------------------------------------------------ */
    /* LIGHT INTEL                                                   */
    /* ------------------------------------------------------------ */

    async runLightIntel(){
        const api = this.nexus.intel;
        this.nexus.log("Running Light Intel...");

        const basic  = await safeGet(() => api.requestV2("/user/basic"));
        const chain  = await safeGet(() => api.requestV2("/user/chain"));
        const status = await safeGet(() => api.requestV2("/user/status"));

        if(basic && chain){
            if(!this.fullIntelCache) this.fullIntelCache = { timestamp: Date.now() };

            // user
            this.fullIntelCache.user = {
                id: basic.user_id,
                name: basic.name,
                level: basic.level,
                status: status?.status || "",
                hp: status?.hp?.current || 0,
                max_hp: status?.hp?.maximum || 0,
                bars: {},
                stats: {}
            };

            // chain
            this.fullIntelCache.chain = {
                hits: chain.chain?.hits || 0,
                timeout: chain.chain?.timeout || 0,
                modifier: chain.chain?.modifier || 1.0,
                full: chain.chain
            };

            // Ensure containers
            if(!this.fullIntelCache.faction) this.fullIntelCache.faction = {};
            if(!this.fullIntelCache.enemies) this.fullIntelCache.enemies = [];
            if(!this.fullIntelCache.enemyMembersFlat) this.fullIntelCache.enemyMembersFlat = {};

            this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            this.nexus.log("Light Intel Pushed");
        }
    },

    /* ------------------------------------------------------------ */
    /* FULL INTEL                                                    */
    /* ------------------------------------------------------------ */

    async runFullIntelIfNeeded(){
        const now = Date.now();

        if (this.fullIntelCache && this.fullIntelCache.timestamp &&
            (now - this.lastFullIntelTs) < 60000){
            this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            return;
        }

        const fresh = await this.pullFullIntel();
        if(fresh){
            this.fullIntelCache = fresh;
            this.lastFullIntelTs = Date.now();
            this.nexus.events.emit("RAW_INTEL", fresh);
        }
    },

    async pullFullIntel(){
        const api = this.nexus.intel;
        const intel = {};

        // USER DATA
        intel.basic  = await safeGet(() => api.requestV2("/user/basic"));
        if(!intel.basic) {
            this.nexus.log("Basic User API Failed. Aborting full intel pull.");
            return null;
        }
        intel.stats  = await safeGet(() => api.requestV2("/user/stats"));  // FIXED
        intel.bars   = await safeGet(() => api.requestV2("/user/bars"));
        intel.status = await safeGet(() => api.requestV2("/user/status"));
        intel.chain  = await safeGet(() => api.requestV2("/user/chain"));
        intel.faction= await safeGet(() => api.requestV2("/user/faction"));
        intel.attacks= await safeGet(() => api.requestV2("/user/attacks"));

        // V1 supplemental
        intel.supplemental = await safeGet(() => api.requestV1("user", "networth"));

        // FACTION DATA
        const factionId = intel.faction?.faction?.faction_id || null;
        intel.factionId = factionId;

        if (factionId){
            intel.faction_basic   = await safeGet(() => api.requestV2(`/faction/${factionId}/basic`));
            intel.faction_members = await safeGet(() => api.requestV2(`/faction/${factionId}/members`));
            intel.faction_wars    = await safeGet(() => api.requestV2(`/faction/${factionId}/wars`));
            intel.faction_chain   = await safeGet(() => api.requestV2(`/faction/${factionId}/chain`));
        } else {
            // ensure containers exist to avoid breakage
            intel.faction_basic = {};
            intel.faction_members = { members: {} };
            intel.faction_wars = { wars: {} };
            intel.faction_chain = { chain: {} };
        }

        // ENEMY DATA
        const warsObj = intel.faction_wars?.wars || {};
        const hasWar = Boolean(Object.keys(warsObj).length > 0);

        intel.enemies = [];

        // Always allow enemy fetching — but throttle if war is active
        if (factionId){
            for (const wid in warsObj){
                const war = warsObj[wid];
                const enemyId = war.enemy_faction || war.opponent || null;
                if (!enemyId) continue;

                // If war active → throttle enemy pulls, but still pull
                const basic = await safeGet(() => api.requestV2(`/faction/${enemyId}/basic`));
                const members = await safeGet(() => api.requestV2(`/faction/${enemyId}/members`));

                if (basic){
                    intel.enemies.push({
                        id: enemyId,
                        name: basic?.name || "Unknown",
                        basic,
                        members: members?.members || {}
                    });
                }
            }
        }

        return this.composeRawIntel(intel);
    },

    /* ------------------------------------------------------------ */
    /* COMPOSE RAW INTEL                                             */
    /* ------------------------------------------------------------ */

    composeRawIntel(intel){
        const c = intel.chain?.chain || intel.chain || {};
        const factionId = intel.factionId;

        const enemiesOut = [];
        const flatEnemyMembers = {};

        if (intel.enemies){
            for (const ef of intel.enemies){
                const eid = ef.id;
                const members = ef.members || {};

                enemiesOut.push({
                    id: eid,
                    name: ef.basic?.name || "Unknown",
                    members
                });

                for (const mid in members){
                    const m = members[mid];
                    flatEnemyMembers[mid] = {
                        id: Number(mid),
                        name: m.name || "Unknown",
                        level: m.level || 0,
                        status: m.status?.state || "",
                        last_action: m.last_action?.timestamp || 0,
                        online: m.status?.state === "Online",
                        ...m
                    };
                }
            }
        }

        return {
            timestamp: Date.now(),
            user: {
                id: intel.basic?.user_id || null,
                name: intel.basic?.name || "Unknown",
                level: intel.basic?.level || 0,
                gender: intel.basic?.gender || "",
                status: intel.status?.status || "",
                last_action: intel.status?.last_action || {},
                hp: intel.status?.hp?.current || 0,
                max_hp: intel.status?.hp?.maximum || 0,
                bars: intel.bars?.bars || {},
                stats: intel.stats?.battlestats || {}
            },
            chain: {
                hits: c.hits || 0,
                timeout: c.timeout || c.timeLeft || 0,
                modifier: c.modifier || 1.0,     // FIXED for Major
                cooldown: c.cooldown || 0,
                full: c
            },
            faction: {
                id: factionId,
                name: intel.faction_basic?.name || "",
                members: intel.faction_members?.members || {},
                chain: intel.faction_chain?.chain || {},
                wars: intel.faction_wars?.wars || {}   // FIXED for Colonel & Major
            },
            enemies: enemiesOut,
            enemyMembersFlat: flatEnemyMembers,
            attacks: intel.attacks?.attacks || [],
            supplemental: intel.supplemental || {}
        };
    },

    /* ------------------------------------------------------------ */
    /* POLLING: CHAIN                                                */
    /* ------------------------------------------------------------ */

    startChainPolling(){
        const api = this.nexus.intel;

        const poll = async () => {
            try {
                const chain = await safeGet(() => api.requestV2("/user/chain"));

                if(chain && this.fullIntelCache && this.fullIntelCache.chain){
                    this.fullIntelCache.chain.hits = chain.chain?.hits || 0;
                    this.fullIntelCache.chain.timeout = chain.chain?.timeout || 0;
                    this.fullIntelCache.chain.modifier = chain.chain?.modifier || 1.0;

                    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
                }

                const hits = chain?.chain?.hits || 0;
                this.restartChainTimer(hits > 0 ? 5000 : 120000);
            } catch(e){
                this.restartChainTimer(120000);
            }
        };

        this.chainPollFunc = poll;
        this.restartChainTimer(10000);
    },

    restartChainTimer(ms){
        if (this.chainTimer) clearTimeout(this.chainTimer);
        this.chainTimer = setTimeout(() => this.chainPollFunc(), ms);
    },

    /* ------------------------------------------------------------ */
    /* POLLING: ENEMY                                                */
    /* ------------------------------------------------------------ */

    startEnemyPolling(){
        const api = this.nexus.intel;

        const poll = async () => {

            // Fix: Recover if cache corrupted
            if (!this.fullIntelCache){
                await this.runFullIntelIfNeeded();
                this.restartEnemyTimer(15000);
                return;
            }

            // Fix: recover if faction undefined
            if (!this.fullIntelCache.faction || !this.fullIntelCache.faction.id){
                await this.runFullIntelIfNeeded();
                this.restartEnemyTimer(15000);
                return;
            }

            const fid = this.fullIntelCache.faction.id;

            try {
                const wars = await safeGet(() => api.requestV2(`/faction/${fid}/wars`));

                // if wars changed, refresh immediately
                if (wars?.wars){
                    const before = JSON.stringify(this.fullIntelCache.faction.wars || {});
                    const after  = JSON.stringify(wars.wars);
                    if (before !== after){
                        const fresh = await this.pullFullIntel();
                        if (fresh){
                            this.fullIntelCache = fresh;
                            this.lastFullIntelTs = Date.now();
                            this.nexus.events.emit("RAW_INTEL", fresh);
                        }
                    }
                }

                // Throttle enemy polling depending on war state
                const activeWar = wars?.wars && Object.keys(wars.wars).length > 0;
                this.restartEnemyTimer(activeWar ? 90000 : 180000);   // 1.5–3 mins
            } catch(e){
                this.restartEnemyTimer(180000);
            }
        };

        this.enemyPollFunc = poll;
        this.restartEnemyTimer(15000);
    },

    restartEnemyTimer(ms){
        if (this.enemyTimer) clearTimeout(this.enemyTimer);
        this.enemyTimer = setTimeout(() => this.enemyPollFunc(), ms);
    }
};

// Register
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Lieutenant", module: Lieutenant });

})();
