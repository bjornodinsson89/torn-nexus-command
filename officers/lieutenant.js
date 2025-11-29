// lieutenant.js — Patched with Drawer-Triggered Polling & Serialized API Queue

////////////////////////////////////////////////////////////
// LIEUTENANT — INTEL ACQUISITION ENGINE (FULL PATCH)
//
// NEW FEATURES:
//   - Drawer-triggered full intel load (ONCE per 60 sec)
//   - Background polling for chain and enemy only
//   - All API calls serialized (no rate limits)
//   - Enemy & war polling separate from full intel
//   - Full intel skips enemy endpoints during war
//   - 60-second cache
////////////////////////////////////////////////////////////

(function(){
"use strict";

/* PATCH: helper sleep for serialization */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

/* PATCH: serialized GET wrapper */
async function serialGet(fn){
    const result = await fn();
    await sleep(450); // ensures >400ms between calls
    return result;
}

const Lieutenant = {
    nexus: null,

    /* PATCH: cache */
    lastFullIntelTs: 0,
    fullIntelCache: null,

    /* PATCH: drawer state */
    drawerOpen: false,

    /* PATCH: background poll timers */
    chainTimer: null,
    enemyTimer: null,

    init(nexus) {
        this.nexus = nexus;

        /* PATCH: listen for drawer open */
        this.nexus.events.on("UI_DRAWER_OPENED", () => {
            this.drawerOpen = true;
            this.runFullIntelIfNeeded();
        });

        /* PATCH: setup background polling */
        this.startChainPolling();
        this.startEnemyPolling();
    },

    /* ------------------------------------------------------------ */
    /* PATCH: MAIN – Drawer-triggered full intel loader with cache */
    /* ------------------------------------------------------------ */
    async runFullIntelIfNeeded(){

        const now = Date.now();
        const age = now - this.lastFullIntelTs;

        // If cache is younger than 60 sec, reuse it
        if (this.fullIntelCache && age < 60000){
            this.nexus.events.emit("RAW_INTEL", this.fullIntelCache);
            return;
        }

        // Load fresh data
        const fresh = await this.pullFullIntel();
        this.fullIntelCache = fresh;
        this.lastFullIntelTs = Date.now();
        this.nexus.events.emit("RAW_INTEL", fresh);
    },

    /* ------------------------------------------------------------ */
    /* PATCH: Full Intel Pull – Serialized, Drawer-triggered */
    /* ------------------------------------------------------------ */
    async pullFullIntel() {
        const intel = {};
        const api = this.nexus.intel;

        /* BASIC USER DATA (always included) */
        intel.basic   = await serialGet(() => api.requestV2("/user/basic"));
        intel.stats   = await serialGet(() => api.requestV2("/user/battlestats"));
        intel.bars    = await serialGet(() => api.requestV2("/user/bars"));
        intel.status  = await serialGet(() => api.requestV2("/user/status"));
        intel.chain   = await serialGet(() => api.requestV2("/user/chain"));
        intel.faction = await serialGet(() => api.requestV2("/user/faction"));
        intel.attacks = await serialGet(() => api.requestV2("/user/attacks"));

        const factionId = intel.faction?.faction?.faction_id || null;
        intel.factionId = factionId;

        /* PATCH: supplemental data */
        try {
            intel.supplemental = await serialGet(() =>
                api.requestV1("user", "networth")
            );
        } catch {
            intel.supplemental = {};
        }

        /* PATCH: faction data (without enemies if during war) */
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

        const warActive = Boolean(intel.faction_wars?.wars &&
             Object.keys(intel.faction_wars.wars).length > 0);

        /* PATCH: If war NOT active, include enemy data */
        if (!warActive && factionId && intel.faction_wars?.wars){
            intel.enemies = [];
            for (const wid in intel.faction_wars.wars){
                const war = intel.faction_wars.wars[wid];
                const enemyId = war.enemy_faction || war.opponent || null;
                if (!enemyId) continue;

                /* Option D: full enemy polling */
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
        } else {
            /* Do not include enemy data in drawer-triggered refresh during war –
               background polling handles it */
            intel.enemies = null;
        }

        /* PATCH: Normalize into RAW_INTEL format Colonel expects */
        return this.composeRawIntel(intel);
    },
