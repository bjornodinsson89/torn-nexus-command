(function(){
"use strict";

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

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

const Lieutenant = {
    nexus: null,

    lastFullIntelTs: 0,
    fullIntelCache: null,
    drawerOpen: false,

    chainTimer: null,
    enemyTimer: null,
    chainPollFunc: null,
    enemyPollFunc: null
};

Lieutenant.init = function(nexus){
    this.nexus = nexus;

    this.nexus.events.on("UI_DRAWER_OPENED", () => {
        this.drawerOpen = true;
        this.runFullIntelIfNeeded();
    });

    setTimeout(() => this.runLightIntel(), 1000);

    this.startChainPolling();
    this.startEnemyPolling();
};

/* ------------------------------------------------------------ */
/* LIGHT INTEL                                                   */
/* ------------------------------------------------------------ */

Lieutenant.runLightIntel = async function(){
    const api = this.nexus.intel;
    this.nexus.log("Running Light Intel...");

    const basic = await safeGet(() => api.requestV2("/user/basic"));
    const bars  = await safeGet(() => api.requestV2("/user/bars"));

    if (!basic) return;

    const profile = basic.profile || {};
    const barsObj = bars?.bars || {};
    const life    = barsObj.life || {};
    const chain   = barsObj.chain || {};

    if (!this.fullIntelCache) this.fullIntelCache = { timestamp: Date.now() };

    this.fullIntelCache.user = {
        id: profile.id || null,
        name: profile.name || "Unknown",
        level: profile.level || 0,
        gender: profile.gender || "",
        status: profile.status?.description || profile.status?.state || "",
        last_action: {}, // not provided by v2 basic
        hp: life.current || 0,
        max_hp: life.maximum || 0,
        bars: barsObj,
        stats: {}
    };

    this.fullIntelCache.chain = {
        hits: chain.current || 0,
        timeout: chain.timeout || 0,
        modifier: chain.modifier || 1.0,
        cooldown: chain.cooldown || 0,
        full: chain
    };

    if(!this.fullIntelCache.faction) this.fullIntelCache.faction = {};
    if(!this.fullIntelCache.enemies) this.fullIntelCache.enemies = [];
    if(!this.fullIntelCache.enemyMembersFlat) this.fullIntelCache.enemyMembersFlat = {};

    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
    this.nexus.log("Light Intel Pushed");
};

/* ------------------------------------------------------------ */
/* FULL INTEL                                                    */
/* ------------------------------------------------------------ */

Lieutenant.runFullIntelIfNeeded = async function(){
    const now = Date.now();

    if (this.fullIntelCache && this.fullIntelCache.timestamp &&
        (now - this.lastFullIntelTs) < 60000){
        this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
        return;
    }

    const fresh = await this.pullFullIntel();
    if (fresh){
        this.fullIntelCache = fresh;
        this.lastFullIntelTs = Date.now();
        this.nexus.events.emit("RAW_INTEL", fresh);
    }
};

Lieutenant.pullFullIntel = async function(){
    const api = this.nexus.intel;
    const intel = {};

    // USER V2
    intel.basic  = await safeGet(() => api.requestV2("/user/basic"));
    if (!intel.basic){
        this.nexus.log("Basic User API Failed. Aborting full intel pull.");
        return null;
    }

    intel.bars   = await safeGet(() => api.requestV2("/user/bars"));

    // Optional / high-permission – will be null with your key, that’s fine
    intel.stats  = await safeGet(() => api.requestV2("/user/stats"));
    intel.chain  = await safeGet(() => api.requestV2("/user/chain"));
    // intel.status endpoint does not exist in v2; status is in basic.profile.status

    intel.faction = await safeGet(() => api.requestV2("/user/faction"));
    intel.attacks = await safeGet(() => api.requestV2("/user/attacks")); // may error with low perms

    // V1 supplemental (networth etc)
    intel.supplemental = await safeGet(() => api.requestV1("user", "networth"));

    const factionInfo = intel.faction?.faction || {};
    const factionId = factionInfo.id || null;
    intel.factionId = factionId;

    // FACTION DATA
    if (factionId){
        intel.faction_basic   = await safeGet(() => api.requestV2(`/faction/${factionId}/basic`));
        intel.faction_members = await safeGet(() => api.requestV2(`/faction/${factionId}/members`));
        intel.faction_wars    = await safeGet(() => api.requestV2(`/faction/${factionId}/wars`));
        // no distinct chain endpoint in v2 faction; chain info is in user.bars.chain
    } else {
        intel.faction_basic   = {};
        intel.faction_members = { members: [] };
        intel.faction_wars    = { wars: {} };
    }

    // ENEMY DATA (v2 wars structure does not expose enemy IDs directly)
    intel.enemies = []; // keep empty until there’s a v2 enemy source

    return this.composeRawIntel(intel);
};

/* ------------------------------------------------------------ */
/* COMPOSE RAW INTEL                                             */
/* ------------------------------------------------------------ */

Lieutenant.composeRawIntel = function(intel){
    const profile = intel.basic?.profile || {};
    const barsObj = intel.bars?.bars || {};
    const life    = barsObj.life || {};
    const chainBars = barsObj.chain || {};
    const factionInfo = intel.faction?.faction || {};
    const factionId = factionInfo.id || intel.factionId || null;

    // chain: prefer bars.chain, fall back to /user/chain if ever available
    const c = chainBars || intel.chain?.chain || intel.chain || {};
    
    // faction members: v2 returns array; normalize to object keyed by ID
    let factionMembersObj = {};
    const fm = intel.faction_members?.members;
    if (Array.isArray(fm)){
        fm.forEach(m => {
            if (!m || m.id == null) return;
            factionMembersObj[m.id] = m;
        });
    } else if (fm && typeof fm === "object"){
        factionMembersObj = fm;
    }

    const enemiesOut = [];
    const flatEnemyMembers = {};

    // (no enemy factions from v2 wars yet; keep structures consistent)
    if (intel.enemies){
        for (const ef of intel.enemies){
            const eid = ef.id;
            if (!eid) continue;

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
            id: profile.id || null,
            name: profile.name || "Unknown",
            level: profile.level || 0,
            gender: profile.gender || "",
            status: profile.status?.description || profile.status?.state || "",
            last_action: {}, // v2 basic doesn’t supply this
            hp: life.current || 0,
            max_hp: life.maximum || 0,
            bars: barsObj,
            stats: intel.stats?.battlestats || {}
        },

        chain: {
            hits: c.current || c.hits || 0,
            timeout: c.timeout || c.timeLeft || 0,
            modifier: c.modifier || 1.0,
            cooldown: c.cooldown || 0,
            full: c
        },

        faction: {
            id: factionId,
            name: intel.faction_basic?.basic?.name || factionInfo.name || "",
            members: factionMembersObj,
            chain: {}, // no faction chain from v2 yet
            wars: intel.faction_wars?.wars || {}
        },

        enemies: enemiesOut,
        enemyMembersFlat: flatEnemyMembers,

        attacks: intel.attacks?.attacks || [],
        supplemental: intel.supplemental || {}
    };
};

/* ------------------------------------------------------------ */
/* CHAIN POLLING                                                 */
/* ------------------------------------------------------------ */

Lieutenant.startChainPolling = function(){
    const api = this.nexus.intel;

    const poll = async () => {
        try {
            const bars = await safeGet(() => api.requestV2("/user/bars"));
            const chain = bars?.bars?.chain || {};

            if (chain && this.fullIntelCache && this.fullIntelCache.chain){
                this.fullIntelCache.chain.hits = chain.current || 0;
                this.fullIntelCache.chain.timeout = chain.timeout || 0;
                this.fullIntelCache.chain.modifier = chain.modifier || 1.0;
                this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            }

            const hits = chain.current || 0;
            this.restartChainTimer(hits > 0 ? 5000 : 120000);
        } catch(e){
            this.restartChainTimer(120000);
        }
    };

    this.chainPollFunc = poll;
    this.restartChainTimer(10000);
};

Lieutenant.restartChainTimer = function(ms){
    if (this.chainTimer) clearTimeout(this.chainTimer);
    this.chainTimer = setTimeout(() => this.chainPollFunc(), ms);
};

/* ------------------------------------------------------------ */
/* ENEMY/WAR POLLING (v2 wars → just detects changes)           */
/* ------------------------------------------------------------ */

Lieutenant.startEnemyPolling = function(){
    const api = this.nexus.intel;

    const poll = async () => {
        if (!this.fullIntelCache){
            await this.runFullIntelIfNeeded();
            this.restartEnemyTimer(15000);
            return;
        }

        if (!this.fullIntelCache.faction || !this.fullIntelCache.faction.id){
            await this.runFullIntelIfNeeded();
            this.restartEnemyTimer(15000);
            return;
        }

        const fid = this.fullIntelCache.faction.id;

        try {
            const wars = await safeGet(() => api.requestV2(`/faction/${fid}/wars`));

            if (wars){
                const before = JSON.stringify(this.fullIntelCache.faction.wars || {});
                const after  = JSON.stringify(wars.wars || wars);
                if (before !== after){
                    this.fullIntelCache.faction.wars = wars.wars || wars || {};
                    this.lastFullIntelTs = Date.now();
                    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
                }
            }

            const hasWars = wars && wars.wars && (
                wars.wars.ranked || (wars.wars.raids || []).length || (wars.wars.territory || []).length
            );
            this.restartEnemyTimer(hasWars ? 90000 : 180000);
        } catch(e){
            this.restartEnemyTimer(180000);
        }
    };

    this.enemyPollFunc = poll;
    this.restartEnemyTimer(15000);
};

Lieutenant.restartEnemyTimer = function(ms){
    if (this.enemyTimer) clearTimeout(this.enemyTimer);
    this.enemyTimer = setTimeout(() => this.enemyPollFunc(), ms);
};

/* ------------------------------------------------------------ */
/* REGISTER                                                      */
/* ------------------------------------------------------------ */

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Lieutenant", module: Lieutenant });

})();
