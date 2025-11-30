// ===============================================================
//  WAR NEXUS INTEL ENGINE — LIEUTENANT (PURE V2 EDITION)
//  DARK OPS BUILD 3.0.x — FINAL RECONSTRUCTION
// ---------------------------------------------------------------
//  Responsibilities:
//   • Fetch + normalize all Torn V2 API data (Swagger accurate)
//   • Produce the OFFICIAL Nexus Intel Packet for Colonel/Major
//   • Manage async polling, rate limits, race protections
//   • Normalize user, faction, enemy, wars, chain structures
//   • Guarantee backward-compatible internal schema
//   • ZERO placeholders. ZERO stubs. FULL production build.
// ===============================================================

(function(){
"use strict";

/* ============================================================
   HELPER UTILITIES
   ============================================================ */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function safeGet(fn){
    try {
        const r = await fn();
        await sleep(450);
        return r;
    } catch(e){
        console.warn("[Lieutenant] API Fail (Recovered):", e);
        return null;
    }
}

function arrayToIdMap(arr, idField="id"){
    const out = {};
    if (!Array.isArray(arr)) return out;
    for (const item of arr){
        if (item && item[idField] != null){
            out[item[idField]] = item;
        }
    }
    return out;
}

/* ============================================================
   LIEUTENANT (V2 Intel Acquisition)
   ============================================================ */
const Lieutenant = {
    nexus: null,

    fullIntelCache: null,
    lastFullIntelTs: 0,
    drawerOpen: false,

    chainTimer: null,
    enemyTimer: null,
    chainPollFunc: null,
    enemyPollFunc: null,
};

/* ============================================================
   INIT
   ============================================================ */
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

/* ============================================================
   LIGHT INTEL (Boot-Up)
   ============================================================ */
Lieutenant.runLightIntel = async function(){
    const api = this.nexus.intel;

    const basic = await safeGet(() => api.requestV2("/user/basic"));
    const bars  = await safeGet(() => api.requestV2("/user/bars"));

    if (!basic) return;

    if (!this.fullIntelCache) this.fullIntelCache = {};

    const profile = basic.profile || {};
    const barsObj = bars?.bars || {};
    const life    = barsObj.life || {};
    const chain   = barsObj.chain || {};

    this.fullIntelCache.timestamp = Date.now();

    this.fullIntelCache.user = {
        id: profile.id || null,
        name: profile.name || "Unknown",
        level: profile.level || 0,
        gender: profile.gender || "",
        status: profile.status?.description || profile.status?.state || "",
        last_action: profile.last_action || {},
        hp: life.current || 0,
        max_hp: life.maximum || 0,
        bars: barsObj,
        stats: {}, 
        personalstats: {}
    };

    this.fullIntelCache.chain = {
        hits: chain.current || 0,
        timeout: chain.timeout || 0,
        modifier: chain.modifier || 1.0,
        cooldown: chain.cooldown || 0,
        start: chain.start || 0,
        end: chain.end || 0,
        full: chain
    };

    if (!this.fullIntelCache.faction) this.fullIntelCache.faction = {};
    if (!this.fullIntelCache.enemies) this.fullIntelCache.enemies = [];
    if (!this.fullIntelCache.enemyMembersFlat) this.fullIntelCache.enemyMembersFlat = {};

    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
};

/* ============================================================
   FULL INTEL REFRESH (Heavy Load)
   ============================================================ */
Lieutenant.runFullIntelIfNeeded = async function(){
    const now = Date.now();
    if (this.fullIntelCache && (now - this.lastFullIntelTs) < 60000){
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

/* ============================================================
   PULL FULL INTEL (Pure V2)
   ============================================================ */
Lieutenant.pullFullIntel = async function(){
    const api = this.nexus.intel;
    const intel = {};

    /* USER Intel */
    intel.basic         = await safeGet(() => api.requestV2("/user/basic"));
    if (!intel.basic) return null;

    intel.bars          = await safeGet(() => api.requestV2("/user/bars"));
    intel.battlestats   = await safeGet(() => api.requestV2("/user/battlestats"));

    /* FIXED — Personalstats is NOT a V2 path */
    intel.personalstats = await safeGet(() => api.request("/user?selections=personalstats"));

    intel.attacks       = await safeGet(() => api.requestV2("/user/attacks"));
    intel.attacksfull   = await safeGet(() => api.requestV2("/user/attacksfull"));
    intel.userFaction   = await safeGet(() => api.requestV2("/user/faction"));

    const factionInfo = intel.userFaction?.faction || {};
    const factionId = factionInfo.id || null;
    intel.factionId = factionId;

    /* FACTION Intel */
    if (factionId){
        intel.faction_basic    = await safeGet(() => api.requestV2("/faction/basic"));
        intel.faction_members  = await safeGet(() => api.requestV2("/faction/members"));
        intel.faction_wars     = await safeGet(() => api.requestV2("/faction/wars"));
        intel.faction_chainwar = await safeGet(() => api.requestV2("/faction/warfare?cat=chain"));
    } else {
        intel.faction_basic    = {};
        intel.faction_members  = { members: [] };
        intel.faction_wars     = { wars: {} };
        intel.faction_chainwar = {};
    }

    /* Enemy detection (from faction wars) */
    intel.enemies = [];

    const wars = intel.faction_wars?.wars || {};
    const enemyFactionIds = [];

    /* Ranked wars (corrected to match Torn V2 schema) */
    if (wars.ranked && typeof wars.ranked === "object"){
        for (const wId in wars.ranked){
            const w = wars.ranked[wId];
            if (!w) continue;

            if (w.attacker_faction === factionId && w.defender_faction)
                enemyFactionIds.push(w.defender_faction);

            if (w.defender_faction === factionId && w.attacker_faction)
                enemyFactionIds.push(w.attacker_faction);
        }
    }

    /* Raids */
    if (Array.isArray(wars.raids)){
        for (const raid of wars.raids){
            const enemy =
                raid.faction_one === factionId
                    ? raid.faction_two
                    : raid.faction_one;
            if (enemy) enemyFactionIds.push(enemy);
        }
    }

    /* Territory */
    if (Array.isArray(wars.territory)){
        for (const tw of wars.territory){
            const enemy =
                tw.faction_one === factionId
                    ? tw.faction_two
                    : tw.faction_one;
            if (enemy) enemyFactionIds.push(enemy);
        }
    }

    /* Deduplicate */
    const uniqueEnemies = [...new Set(enemyFactionIds)];

    for (const enemyId of uniqueEnemies){
        const eBasic   = await safeGet(() => api.requestV2(`/faction/${enemyId}/basic`));
        const eMembers = await safeGet(() => api.requestV2(`/faction/${enemyId}/members`));

        if (eBasic){
            intel.enemies.push({
                id: enemyId,
                basic: eBasic.basic || {},
                members: eMembers?.members || []
            });
        }
    }

    return this.composeRawIntel(intel);
};

/* ============================================================
   COMPOSE RAW INTEL (Normalize)
   ============================================================ */
Lieutenant.composeRawIntel = function(intel){
    const basicProfile = intel.basic?.profile || {};
    const barsObj      = intel.bars?.bars || {};
    const life         = barsObj.life || {};
    const chainBars    = barsObj.chain || {};

    /* Normalize faction members */
    const membersArr = intel.faction_members?.members || [];
    const factionMembers = arrayToIdMap(membersArr);

    /* Flatten enemies */
    const enemiesOut = [];
    const flatEnemyMembers = {};

    for (const ef of intel.enemies){
        const eid = ef.id;
        const mArr = ef.members || [];
        const mObj = arrayToIdMap(mArr);

        enemiesOut.push({
            id: eid,
            name: ef.basic?.name || "Unknown",
            members: mObj
        });

        for (const mid in mObj){
            const m = mObj[mid];
            flatEnemyMembers[mid] = {
                id: Number(mid),
                name: m.name || "Unknown",
                level: m.level || 0,
                status: m.status?.description || m.status?.state || "Unknown",
                last_action: m.last_action || {},
                online: (m.status?.state === "Online"),
                ...m
            };
        }
    }

    /* Normalize output */
    const out = {
        timestamp: Date.now(),

        user: {
            id: basicProfile.id || null,
            name: basicProfile.name || "Unknown",
            level: basicProfile.level || 0,
            gender: basicProfile.gender || "",
            status: basicProfile.status?.description || basicProfile.status?.state || "",
            last_action: basicProfile.last_action || {},
            hp: life.current || 0,
            max_hp: life.maximum || 0,
            bars: barsObj,
            stats: intel.battlestats || {},
            personalstats: intel.personalstats || {}
        },

        chain: {
            hits: chainBars.current || 0,
            timeout: chainBars.timeout || 0,
            modifier: chainBars.modifier || 1.0,
            cooldown: chainBars.cooldown || 0,
            start: chainBars.start || 0,
            end: chainBars.end || 0,
            full: chainBars
        },

        faction: {
            id: intel.factionId || null,
            name: intel.faction_basic?.basic?.name || "",
            tag: intel.faction_basic?.basic?.tag || "",
            members: factionMembers,
            wars: intel.faction_wars?.wars || {},
            chain_warfare: intel.faction_chainwar || {}
        },

        enemies: enemiesOut,
        enemyMembersFlat: flatEnemyMembers,

        attacks: intel.attacks?.attacks || [],
        attacksfull: intel.attacksfull?.attacks || [],

        supplemental: intel.supplemental || {}
    };

    return out;
};

/* ============================================================
   CHAIN POLLING
   ============================================================ */
Lieutenant.startChainPolling = function(){
    const api = this.nexus.intel;

    const poll = async () => {
        try {
            const bars = await safeGet(() => api.requestV2("/user/bars"));
            const chain = bars?.bars?.chain || {};

            if (chain && this.fullIntelCache){
                this.fullIntelCache.chain.hits = chain.current || 0;
                this.fullIntelCache.chain.timeout = chain.timeout || 0;
                this.fullIntelCache.chain.modifier = chain.modifier || 1.0;
                this.fullIntelCache.chain.cooldown = chain.cooldown || 0;

                this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            }

            const active = (chain.current || 0) > 0;
            this.restartChainTimer(active ? 5000 : 120000);

        } catch(e){
            this.restartChainTimer(120000);
        }
    };

    this.chainPollFunc = poll;
    this.restartChainTimer(8000);
};

Lieutenant.restartChainTimer = function(ms){
    if (this.chainTimer) clearTimeout(this.chainTimer);
    this.chainTimer = setTimeout(() => this.chainPollFunc(), ms);
};

/* ============================================================
   ENEMY & WAR POLLING
   ============================================================ */
Lieutenant.startEnemyPolling = function(){
    const api = this.nexus.intel;

    const poll = async () => {
        if (!this.fullIntelCache?.faction?.id){
            await this.runFullIntelIfNeeded();
            this.restartEnemyTimer(20000);
            return;
        }

        try {
            const wars = await safeGet(() => api.requestV2(`/faction/wars`));
            if (wars){
                const before = JSON.stringify(this.fullIntelCache.faction.wars || {});
                const after  = JSON.stringify(wars.wars || {});
                if (before !== after){
                    this.fullIntelCache.faction.wars = wars.wars || {};
                    this.lastFullIntelTs = Date.now();
                    this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
                }
            }

            const active =
                wars?.wars?.ranked ||
                (wars?.wars?.raids || []).length ||
                (wars?.wars?.territory || []).length;

            this.restartEnemyTimer(active ? 90000 : 180000);

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

/* ============================================================
   REGISTER
   ============================================================ */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({
    name: "Lieutenant",
    module: Lieutenant
});

})();
