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
/* UTILITIES                                                    */
/* ------------------------------------------------------------ */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// Safe wrapper for API calls to prevent one failure from killing the whole batch
async function safeGet(fn){
    try {
        const result = await fn();
        await sleep(450); // Rate limit safety (>400ms)
        return result;
    } catch (e) {
        console.warn("Nexus API Fail (Recovered):", e);
        return null; // Return null instead of throwing
    }
}

/* ------------------------------------------------------------ */
/* LIEUTENANT CORE                                               */
/* ------------------------------------------------------------ */
const Lieutenant = {
    nexus: null,
    
    /* Cache State */
    lastFullIntelTs: 0,
    fullIntelCache: null, // Starts null, populated by pulls
    drawerOpen: false,

    /* Timers */
    chainTimer: null,
    enemyTimer: null,

    init(nexus){
        this.nexus = nexus;

        /* 1. Listener: Drawer Trigger */
        this.nexus.events.on("UI_DRAWER_OPENED", () => {
            this.drawerOpen = true;
            this.runFullIntelIfNeeded();
        });

        /* 2. Boot: Immediate Light Intel Pull */
        // Gets you online immediately without waiting for the drawer
        // Small delay to ensure Nexus Core is ready
        setTimeout(() => this.runLightIntel(), 1000);

        /* 3. Start Background Loops */
        this.startChainPolling();
        this.startEnemyPolling();
    },

    /* ------------------------------------------------------------ */
    /* LOGIC: INTELLIGENCE GATHERING                                */
    /* ------------------------------------------------------------ */
    
    // Quick pull for boot-up (User + Chain only)
    async runLightIntel(){
        const api = this.nexus.intel;
        this.nexus.log("Running Light Intel...");

        const basic = await safeGet(() => api.requestV2("/user/basic"));
        const chain = await safeGet(() => api.requestV2("/user/chain"));
        const status = await safeGet(() => api.requestV2("/user/status"));

        if(basic && chain){
            // Create a temporary cache structure if one doesn't exist
            if(!this.fullIntelCache) {
                this.fullIntelCache = { timestamp: Date.now() };
            }
            
            // Merge data manually into the cache structure
            this.fullIntelCache.user = {
                id: basic.user_id,
                name: basic.name,
                level: basic.level,
                status: status?.status || "",
                hp: status?.hp?.current || 0,
                max_hp: status?.hp?.maximum || 0,
                // Add empty defaults for safe access
                bars: {},
                stats: {}
            };

            this.fullIntelCache.chain = {
                hits: chain.chain?.hits || 0,
                timeout: chain.chain?.timeout || 0,
                full: chain.chain
            };

            // Ensure other objects exist to prevent UI crashes
            if(!this.fullIntelCache.faction) this.fullIntelCache.faction = {};
            if(!this.fullIntelCache.enemies) this.fullIntelCache.enemies = [];

            // Send what we have immediately
            this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            this.nexus.log("Light Intel Pushed");
        }
    },

    async runFullIntelIfNeeded(){
        const now = Date.now();
        // Cache valid for 60s
        if (this.fullIntelCache && this.fullIntelCache.timestamp && (now - this.lastFullIntelTs) < 60000){
            this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            return;
        }
        
        try {
            const fresh = await this.pullFullIntel();
            if(fresh) {
                this.fullIntelCache = fresh;
                this.lastFullIntelTs = Date.now();
                this.nexus.events.emit("RAW_INTEL", fresh);
            }
        } catch(e) {
            console.error("Full Intel Failed:", e);
        }
    },

    async pullFullIntel(){
        const api = this.nexus.intel;
        const intel = {};

        // 1. User Data
        intel.basic   = await safeGet(() => api.requestV2("/user/basic"));
        
        // Critical: If basic user data fails, we can't do anything. Abort.
        if(!intel.basic) {
            this.nexus.log("Basic User API Failed. Aborting pull.");
            return null;
        }

        intel.stats   = await safeGet(() => api.requestV2("/user/battlestats"));
        intel.bars    = await safeGet(() => api.requestV2("/user/bars"));
        intel.status  = await safeGet(() => api.requestV2("/user/status"));
        intel.chain   = await safeGet(() => api.requestV2("/user/chain"));
        intel.faction = await safeGet(() => api.requestV2("/user/faction"));
        intel.attacks = await safeGet(() => api.requestV2("/user/attacks"));

        // 2. Supplemental (V1 API)
        intel.supplemental = await safeGet(() => api.requestV1("user", "networth"));

        // 3. Faction Data
        const factionId = intel.faction?.faction?.faction_id || null;
        intel.factionId = factionId;

        if (factionId){
            intel.faction_basic   = await safeGet(() => api.requestV2(`/faction/${factionId}/basic`));
            intel.faction_members = await safeGet(() => api.requestV2(`/faction/${factionId}/members`));
            intel.faction_wars    = await safeGet(() => api.requestV2(`/faction/${factionId}/wars`));
            intel.faction_chain   = await safeGet(() => api.requestV2(`/faction/${factionId}/chain`));
        }

        // 4. Enemy Data (Option D)
        const warActive = Boolean(intel.faction_wars?.wars && Object.keys(intel.faction_wars.wars).length > 0);
        intel.enemies = [];

        // Only pull enemies if not in active war (save API calls) OR if needed
        if (!warActive && factionId && intel.faction_wars?.wars){
            for (const wid in intel.faction_wars.wars){
                const war = intel.faction_wars.wars[wid];
                const enemyId = war.enemy_faction || war.opponent || null;
                if (!enemyId) continue;

                const basic = await safeGet(() => api.requestV2(`/faction/${enemyId}/basic`));
                const members = await safeGet(() => api.requestV2(`/faction/${enemyId}/members`));

                if(basic) {
                    intel.enemies.push({
                        id: enemyId,
                        basic,
                        members: members?.members || {}
                    });
                }
            }
        }

        return this.composeRawIntel(intel);
    },

    // Normalizes the API data into the standard structure Colonel expects
    composeRawIntel(intel){
        const c = intel.chain?.chain || intel.chain || {};
        const factionId = intel.factionId;

        /* flatten enemy members */
        const enemiesOut = [];
        const flatEnemyMembers = {};

        if (intel.enemies){
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
                cooldown: c.cooldown || 0,
                modifiers: c.modifiers || {},
                full: c
            },
            faction: {
                id: factionId,
                name: intel.faction_basic?.name || "",
                members: intel.faction_members?.members || {},
                chain: intel.faction_chain?.chain || {},
                wars: intel.faction_wars?.wars || {}
            },
            enemies: enemiesOut,
            enemyMembersFlat: flatEnemyMembers,
            attacks: intel.attacks?.attacks || [],
            supplemental: intel.supplemental || {}
        };
    },

    /* ------------------------------------------------------------ */
    /* POLLING                                                      */
    /* ------------------------------------------------------------ */
    startChainPolling(){
        const api = this.nexus.intel;
        
        const poll = async () => {
            try {
                const chain = await safeGet(() => api.requestV2("/user/chain"));
                
                // Update the cache if we have one
                if(chain && this.fullIntelCache && this.fullIntelCache.chain){
                    this.fullIntelCache.chain.hits = chain.chain?.hits || 0;
                    this.fullIntelCache.chain.timeout = chain.chain?.timeout || 0;
                    
                    // Push the update to Colonel/Major
                    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
                }
                
                // Adjust polling speed based on activity
                const hits = chain?.chain?.hits || 0;
                this.restartChainTimer(hits > 0 ? 5000 : 120000);
            } catch(e){
                this.restartChainTimer(120000);
            }
        };
        
        this.restartChainTimer(10000); // Initial delay
        this.chainPollFunc = poll;
    },

    restartChainTimer(ms){
        if (this.chainTimer) clearTimeout(this.chainTimer);
        this.chainTimer = setTimeout(() => this.chainPollFunc(), ms);
    },

    startEnemyPolling(){
        const api = this.nexus.intel;
        
        const poll = async () => {
            // FIX: Don't poll if we don't have base data yet or no faction
            if (!this.fullIntelCache || !this.fullIntelCache.faction || !this.fullIntelCache.faction.id) {
                this.restartEnemyTimer(10000);
                return;
            }

            try {
                const fid = this.fullIntelCache.faction.id;
                const wars = await safeGet(() => api.requestV2(`/faction/${fid}/wars`));
                
                // If we are in a war, we might want to trigger a full refresh or target poll here
                // For now, we just keep the connection alive
                if(wars?.wars && Object.keys(wars.wars).length > 0){
                    // Logic to poll specific enemies can go here in future V2 updates
                }
                
                this.restartEnemyTimer(120000);
            } catch(e){
                this.restartEnemyTimer(120000);
            }
        };
        
        this.restartEnemyTimer(15000); // Initial delay
        this.enemyPollFunc = poll;
    },

    restartEnemyTimer(ms){
        if (this.enemyTimer) clearTimeout(this.enemyTimer);
        this.enemyTimer = setTimeout(() => this.enemyPollFunc(), ms);
    }
};

// Register module
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Lieutenant", module: Lieutenant });

})();
