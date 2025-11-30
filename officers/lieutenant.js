// ============================================================================
//  WAR NEXUS — LIEUTENANT (INTEL ENGINE FRONTLINE OPERATOR)
//  Version: 3.0.5 (Fully Repaired, Full V2 Compliance + V1 Fallback)
//  Author: Bjorn
// ============================================================================

(function(){
"use strict";

const Lieutenant = {
    nexus: null,

    capabilities: {
        v2_chain: false,
        v2_stats: false,
        v2_battlestats: false,
        v2_attacks: false,
        v2_attacksfull: false
    },

    pollInterval: 15000,
    lastPoll: 0,

    // Dynamically discovered on first successful /basic call
    userId: null
};

/* ============================================================================
   INIT
   ============================================================================ */
Lieutenant.init = function(nexus){
    this.nexus = nexus;

    // Begin API capability detection
    this.detectCapabilities().then(() => {
        this.nexus.log("Lieutenant: API capabilities ready");
        this.nexus.events.emit("API_CAPABILITIES_READY", this.capabilities);

        this.startPolling();
    });
};

/* ============================================================================
   BASIC SAFE WRAPPER
   ============================================================================ */
Lieutenant.safe = async function(fn){
    try {
        const r = await fn();
        return r || null;
    } catch {
        return null;
    }
};

/* ============================================================================
   TEST V2 ENDPOINT
   ============================================================================ */
Lieutenant.testV2 = async function(path){
    try {
        const r = await this.nexus.intel.requestV2(path);
        return !!r;
    } catch {
        return false;
    }
};

/* ============================================================================
   CAPABILITY DETECTION
   ============================================================================ */
Lieutenant.detectCapabilities = async function(){
    const tests = {
        v2_chain: "/user/0/chain",
        v2_stats: "/user/0/stats",
        v2_battlestats: "/user/0/battlestats",
        v2_attacks: "/user/0/attacks",
        v2_attacksfull: "/user/0/attacksfull"
    };

    for (const key in tests){
        const ok = await this.testV2(tests[key]);
        this.capabilities[key] = ok;
        this.nexus.log(`Capability ${key}: ${ok ? "✔" : "❌"}`);
    }
};

/* ============================================================================
   BEGIN POLLING
   ============================================================================ */
Lieutenant.startPolling = function(){
    setInterval(()=>this.poll(), this.pollInterval);
    this.poll();
};

/* ============================================================================
   MAIN POLL CYCLE
   ============================================================================ */
Lieutenant.poll = async function(){
    const now = Date.now();
    if (now - this.lastPoll < this.pollInterval * 0.5) return;
    this.lastPoll = now;

    const intel = {};

    /* ------------------------------------------------------------------------
       STEP 1 — GET BARS (does NOT require user ID)
       ------------------------------------------------------------------------ */
    intel.bars = await this.safe(() => this.nexus.intel.requestV2("/user/bars"));

    /* ------------------------------------------------------------------------
       STEP 2 — DISCOVER USER ID
       /basic MUST be called as /user/{id}/basic — so we need to learn the ID
       ------------------------------------------------------------------------ */
    if (!this.userId){
        // Fallback: extract userId from bars
        const fallback = intel.bars?.bars?.chain?.id;
        if (fallback && fallback > 0) this.userId = fallback;

        // Last-resort fallback: use V1 /basic to get ID
        if (!this.userId){
            const basicV1 = await this.safe(() => this.nexus.intel.requestV1("user","profile"));
            if (basicV1?.profile?.player_id) {
                this.userId = basicV1.profile.player_id;
            }
        }

        if (!this.userId){
            this.nexus.log("Lieutenant: Unable to determine user ID yet.");
            return; // cannot continue without ID
        }
    }

    const UID = this.userId;

    /* ------------------------------------------------------------------------
       STEP 3 — CORE USER INTEL (V2 + fallback)
       ------------------------------------------------------------------------ */
    intel.basic = await this.safe(() => this.nexus.intel.requestV2(`/user/${UID}/basic`));
    if (!intel.basic){
        intel.basic = await this.safe(() => this.nexus.intel.requestV1("user","basic"));
    }

    intel.faction = await this.safe(() => this.nexus.intel.requestV2(`/user/${UID}/faction`));
    if (!intel.faction){
        intel.faction = await this.safe(() => this.nexus.intel.requestV1("user","faction"));
    }

    /* ------------------------------------------------------------------------
       CHAIN
       ------------------------------------------------------------------------ */
    if (this.capabilities.v2_chain){
        intel.chain = await this.safe(() => this.nexus.intel.requestV2(`/user/${UID}/chain`));
    }
    if (!intel.chain){
        // fallback via bars
        intel.chain = intel.bars?.bars?.chain || { id:0, current:0, max:10 };
    }

    /* ------------------------------------------------------------------------
       BATTLESTATS
       ------------------------------------------------------------------------ */
    if (this.capabilities.v2_battlestats){
        intel.battlestats = await this.safe(() => this.nexus.intel.requestV2(`/user/${UID}/battlestats`));
    }
    if (!intel.battlestats){
        intel.battlestats = await this.safe(() => this.nexus.intel.requestV1("user","battlestats"));
    }

    /* ------------------------------------------------------------------------
       STATS
       ------------------------------------------------------------------------ */
    if (this.capabilities.v2_stats){
        intel.stats = await this.safe(() => this.nexus.intel.requestV2(`/user/${UID}/stats`));
    }
    if (!intel.stats){
        intel.stats = intel.battlestats;
    }

    /* ------------------------------------------------------------------------
       ATTACKS
       ------------------------------------------------------------------------ */
    if (this.capabilities.v2_attacks){
        intel.attacks = await this.safe(() => this.nexus.intel.requestV2(`/user/${UID}/attacks`));
    }
    if (!intel.attacks){
        intel.attacks = await this.safe(() => this.nexus.intel.requestV1("user","attacks"));
    }

    /* ------------------------------------------------------------------------
       ATTACKSFULL
       ------------------------------------------------------------------------ */
    if (this.capabilities.v2_attacksfull){
        intel.attacksfull = await this.safe(() => this.nexus.intel.requestV2(`/user/${UID}/attacksfull`));
    }
    if (!intel.attacksfull){
        intel.attacksfull = await this.safe(() => this.nexus.intel.requestV1("user","attacksfull"));
    }

    /* ------------------------------------------------------------------------
       FACTION MEMBERS + WARS (if in faction)
       ------------------------------------------------------------------------ */
    const fid = intel.faction?.faction?.id;
    if (fid){
        intel.faction_basic = await this.safe(() => this.nexus.intel.requestV2(`/faction/${fid}/basic`));
        intel.members       = await this.safe(() => this.nexus.intel.requestV2(`/faction/${fid}/members`));
        intel.wars          = await this.safe(() => this.nexus.intel.requestV2(`/faction/${fid}/wars`));
    }

    /* ------------------------------------------------------------------------
       FINAL — SEND INTEL PACKET
       ------------------------------------------------------------------------ */
    this.nexus.events.emit("RAW_INTEL", intel);
};

/* ============================================================================
   REGISTER OFFICER
   ============================================================================ */
if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name: "Lieutenant",
    module: Lieutenant
});

})();
