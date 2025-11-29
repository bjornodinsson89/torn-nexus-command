// lieutenant.js
////////////////////////////////////////////////////////////
// LIEUTENANT — INTEL ACQUISITION ENGINE 
//
// NEW FEATURES:
//   - Drawer-triggered full intel load (ONCE per 60 sec)
//   - 60-second cache
//   - Background polling for chain and enemy
//   - Serialized API calls (never rate limits Torn API)
//   - Full intel skips enemy endpoints during war
//   - Full Option D enemy polling in background
//   - Compatible with Colonel, Major, Sergeant
////////////////////////////////////////////////////////////


(function(){
"use strict";

/* ------------------------------------------------------------ */
/* PATCH: Utilities                                              */
/* ------------------------------------------------------------ */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function serialGet(fn){
    const result = await fn();
    await sleep(450); // ensures >400ms before next API call
    return result;
}

/* ------------------------------------------------------------ */
/* LIEUTENANT CORE                                               */
/* ------------------------------------------------------------ */
const Lieutenant = {
    nexus: null,

    /* drawer-triggered full intel caching */
    lastFullIntelTs: 0,
    fullIntelCache: null,
    drawerOpen: false,

    /* background polling timers */
    chainTimer: null,
    enemyTimer: null,

    init(nexus){
        this.nexus = nexus;

        /* drawer opened */
        this.nexus.events.on("UI_DRAWER_OPENED", () => {
            this.drawerOpen = true;
            this.runFullIntelIfNeeded();
        });

        /* start background polling */
        this.startChainPolling();
        this.startEnemyPolling();
    },

    /* ------------------------------------------------------------ */
    /* DRAWER-TRIGGERED FULL INTEL LOADING WITH 60-SEC CACHE        */
    /* ------------------------------------------------------------ */
    async runFullIntelIfNeeded(){
        const now = Date.now();

        if (this.fullIntelCache && (now - this.lastFullIntelTs) < 60000){
            this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            return;
        }

        const fresh = await this.pullFullIntel();
        this.fullIntelCache = fresh;
        this.lastFullIntelTs = Date.now();

        this.nexus.events.emit("RAW_INTEL", fresh);
    },

    /* ------------------------------------------------------------ */
    /* SERIALIZED FULL INTEL PULL                                  */
    /* ------------------------------------------------------------ */
    async pullFullIntel(){
        const api = this.nexus.intel;
        const intel = {};

        /* === BASIC USER DATA === */
        intel.basic   = await serialGet(() => api.requestV2("/user/basic"));
        intel.stats   = await serialGet(() => api.requestV2("/user/battlestats"));
        intel.bars    = await serialGet(() => api.requestV2("/user/bars"));
        intel.status  = await serialGet(() => api.requestV2("/user/status"));
        intel.chain   = await serialGet(() => api.requestV2("/user/chain"));
        intel.faction = await serialGet(() => api.requestV2("/user/faction"));
        intel.attacks = await serialGet(() => api.requestV2("/user/attacks"));

        /* supplemental (networth) */
        try {
            intel.supplemental = await serialGet(() =>
                api.requestV1("user", "networth")
            );
        } catch {
            intel.supplemental = {};
        }

        const factionId = intel.faction?.faction?.faction_id || null;
        intel.factionId = factionId;

        /* === FACTION DATA === */
        if (factionId){
            intel.faction_basic =
                await serialGet(() => api.requestV2(`/faction/${factionId}/basic`));
            intel.faction_members =
                await serialGet(() => api.requestV2(`/faction/${factionId}/members`));
            intel.faction_wars =
                await serialGet(() => api.requestV2(`/faction/${factionId}/wars`));
            intel.faction_chain =
                await serialGet(() => api.requestV2(`/faction/${factionId}/chain`));
        }

        /* PATCH: Safe access to wars */
        const warsObj = intel.faction_wars?.wars ?? {};
        const warActive = Object.keys(warsObj).length > 0;

        /* ------------------------------------------------------------ */
        /* ENEMY DATA — SKIPPED DURING WAR                              */
        /* ------------------------------------------------------------ */
        intel.enemies = [];

        if (!warActive && factionId && warsObj){
            for (const wid in warsObj){
                const war = warsObj[wid];
                const enemyId = war.enemy_faction || war.opponent || null;
                if (!enemyId) continue;

                const basic =
                    await serialGet(() => api.requestV2(`/faction/${enemyId}/basic`));
                const members =
                    await serialGet(() => api.requestV2(`/faction/${enemyId}/members`));

                intel.enemies.push({
                    id: enemyId,
                    basic,
                    members: members?.members || {}
                });
            }
        }

        /* ------------------------------------------------------------ */
        /* NORMALIZE FOR COLONEL                                       */
        /* ------------------------------------------------------------ */
        return this.composeRawIntel(intel);
    },

    /* ------------------------------------------------------------ */
    /* RAW_INTEL NORMALIZATION                                      */
    /* ------------------------------------------------------------ */
    composeRawIntel(intel){
        const c = intel.chain?.chain || intel.chain || {};
        const factionId = intel.factionId;

        /* flatten enemy members (Option D) */
        const enemiesOut = [];
        const flatEnemyMembers = {};

        if (Array.isArray(intel.enemies)){
            for (const ef of intel.enemies){
                const enemyId = ef.id;
                const members = ef.members || {};

                enemiesOut.push({
                    id: enemyId,
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

        const timeout = c.timeout ?? c.timeLeft ?? 0;

        return {
            timestamp: Date.now(),

            user: {
                id: intel.basic?.user_id || null,
                name: intel.basic?.name || "",
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
                timeout,
                cooldown: c.cooldown || 0,
                modifiers: c.modifiers || {},
                full: c
            },

            faction: {
                id: factionId,
                name: intel.faction_basic?.name || "",
                founder: intel.faction_basic?.founder || "",
                respect: intel.faction_basic?.respect || 0,
                members: intel.faction_members?.members || {},
                chain: intel.faction_chain?.chain || {},
                wars: intel.faction_wars?.wars || {}
            },

            enemies: enemiesOut,
            enemyMembersFlat: flatEnemyMembers,

            attacks: intel.attacks?.attacks || [],
            supplemental: intel.supplemental
        };
    },

    /* ------------------------------------------------------------ */
    /* BACKGROUND CHAIN POLLING                                     */
    /* ------------------------------------------------------------ */
    startChainPolling(){
        const api = this.nexus.intel;

        const poll = async () => {
            try {
                const chain = await serialGet(() => api.requestV2("/user/chain"));
                const hits = chain?.chain?.hits || 0;
                const timeout = chain?.chain?.timeout || 0;

                /* PATCH: Ensure fullIntelCache exists before modifying */
                if (this.fullIntelCache){
                    this.fullIntelCache.chain = {
                        hits,
                        timeout,
                        full: chain.chain
                    };
                    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
                }

                /* adjust timer */
                if (hits > 0){
                    this.restartChainTimer(7000);
                } else {
                    this.restartChainTimer(180000);
                }

            } catch(e){
                console.warn("Chain poll error:", e);
            }
        };

        this.restartChainTimer(180000);
        this.chainPollFunc = poll;
    },

    restartChainTimer(ms){
        if (this.chainTimer) clearTimeout(this.chainTimer);
        this.chainTimer = setTimeout(async () => {
            await this.chainPollFunc();
        }, ms);
    },

    /* ------------------------------------------------------------ */
    /* BACKGROUND ENEMY POLLING                                     */
    /* ------------------------------------------------------------ */
    startEnemyPolling(){
        const api = this.nexus.intel;

        const poll = async () => {
            try {
                /* PATCH: Guard against missing cache or missing faction */
                const factionId = this.fullIntelCache?.faction?.id;
                if (!this.fullIntelCache || !factionId){
                    this.restartEnemyTimer(180000);
                    return;
                }

                const wars = await serialGet(() =>
                    api.requestV2(`/faction/${factionId}/wars`)
                );

                const warsObj = wars?.wars ?? {};
                const warActive = Object.keys(warsObj).length > 0;

                const enemiesOut = [];
                const flat = {};

                if (warsObj){
                    for (const wid in warsObj){
                        const war = warsObj[wid];
                        const enemyId = war.enemy_faction || war.opponent;
                        if (!enemyId) continue;

                        const basic = await serialGet(() =>
                            api.requestV2(`/faction/${enemyId}/basic`)
                        );
                        const members = await serialGet(() =>
                            api.requestV2(`/faction/${enemyId}/members`)
                        );

                        enemiesOut.push({
                            id: enemyId,
                            name: basic?.name || "Unknown",
                            members: members?.members || {}
                        });

                        for (const mid in members?.members){
                            const m = members.members[mid];
                            flat[mid] = {
                                id: Number(mid),
                                name: m.name,
                                level: m.level,
                                status: m.status?.state || "",
                                last_action: m.last_action?.timestamp || 0,
                                online: m.status?.state === "Online",
                                ...m
                            };
                        }
                    }
                }

                /* PATCH: Ensure cache exists before writing */
                if (this.fullIntelCache){
                    this.fullIntelCache.enemies = enemiesOut;
                    this.fullIntelCache.enemyMembersFlat = flat;

                    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
                }

                /* adjust timer */
                if (warActive){
                    this.restartEnemyTimer(7000);
                } else {
                    this.restartEnemyTimer(180000);
                }

            } catch(e){
                console.warn("Enemy poll error:", e);
            }
        };

        this.restartEnemyTimer(180000);
        this.enemyPollFunc = poll;
    },

    restartEnemyTimer(ms){
        if (this.enemyTimer) clearTimeout(this.enemyTimer);
        this.enemyTimer = setTimeout(async () => {
            await this.enemyPollFunc();
        }, ms);
    }
};

/* ------------------------------------------------------------ */
/* REGISTRATION                                                  */
/* ------------------------------------------------------------ */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Lieutenant", module: Lieutenant });

})();
