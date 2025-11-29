// lieutenant.js — Adaptive Torn Intel Engine

WAR_SANDBOX.register("Lieutenant", (function(){

////////////////////////////////////////////////////////////
// LIEUTENANT — INTEL ACQUISITION ENGINE
// Responsible for:
//  - Adaptive heartbeat based on chain pressure
//  - Safe API usage (no 429 errors)
//  - Intel normalization
//  - Chain momentum and collapse prediction
//  - Feeding Colonel + Sergeant + Major with raw intel
////////////////////////////////////////////////////////////

(function(){

WARDBG("Lieutenant file loaded.");

const Lieutenant = {

    general: null,
    tick: 0,
    mode: "idle",
    lastFetch: 0,
    errorCount: 0,
    chainSamples: [],

    init(general){
        this.general = general;
        WARDBG("Lieutenant online (Adaptive Intel Engine)");
        this.startHeartbeat();
    },

    ////////////////////////////////////////////////////////
    // HEARTBEAT ENGINE
    ////////////////////////////////////////////////////////

    startHeartbeat(){
        setInterval(() => {
            this.tick++;

            const delay = this.computeHeartbeatInterval();
            if (this.tick >= delay){
                this.tick = 0;
                this.fetchIntel();
            }

        }, 1000);
    },

    computeHeartbeatInterval(){
        if (!this.general.intel.hasCredentials()) return 30;

        let interval = 15;

        const latest = this.chainSamples[this.chainSamples.length - 1];
        const hits = latest?.hits || 0;
        const timeout = latest?.timeLeft || 0;

        if (hits > 0){
            this.mode = "active";
            interval = 5;

            if (timeout <= 45){
                this.mode = "critical";
                interval = 1;
            }
        } else {
            this.mode = "idle";
        }

        if (this.errorCount >= 5){
            interval = 30;
        }

        return interval;
    },

    ////////////////////////////////////////////////////////
    // API FETCH + NORMALIZATION
    ////////////////////////////////////////////////////////

    fetchIntel(){
        const selections = "basic,profile,chain,faction,territory,crimes,networth,battlestats,travel,stocks,education,jobpoints,refills,hospital,jail,revives,war";

        this.general.intel.request(selections)
            .then(d => {
                this.errorCount = 0;
                this.lastFetch = Date.now();

                const intel = this.normalizeIntel(d);
                this.trackChain(intel.chain);

                WAR_GENERAL.signals.dispatch("RAW_INTEL", intel);
            })
            .catch(err => {
                this.errorCount++;
                WARDBG("Lieutenant fetch error: " + err);
            });
    },

    ////////////////////////////////////////////////////////
    // CHAIN STABILITY
    ////////////////////////////////////////////////////////

    trackChain(chain){
        this.chainSamples.push(chain);
        if (this.chainSamples.length > 60) this.chainSamples.shift();
    },

    ////////////////////////////////////////////////////////
    // INTEL NORMALIZATION
    ////////////////////////////////////////////////////////

    normalizeIntel(data){
        const profile = data.profile || {};
        const chain = data.chain || {};
        const faction = data.faction || {};
        const war = data.war || {};

        const friendlyMembers = [];
        const enemyMembers = [];

        for (const id in faction.members || {}){
            const m = faction.members[id];
            friendlyMembers.push({
                id: id,
                name: m.name,
                level: m.level,
                status: m.status?.state || "",
                last_action: (m.last_action?.timestamp || 0) * 1000,
                factionPosition: m.position,
                statusDetail: m.status || {}
            });
        }

        const enemyFaction = war?.war?.enemy_faction || {};
        for (const id in enemyFaction.members || {}){
            const m = enemyFaction.members[id];
            enemyMembers.push({
                id: id,
                name: m.name,
                level: m.level,
                status: m.status?.state || "",
                last_action: (m.last_action?.timestamp || 0) * 1000,
                factionPosition: m.position,
                statusDetail: m.status || {}
            });
        }

        const chainPackage = {
            hits: chain.current || 0,
            timeLeft: chain.timeout || 0,
            momentum: this.computeChainMomentum(chain),
            collapseRisk: this.computeCollapseRisk(chain)
        };

        return {
            user: {
                id: profile.player_id,
                name: profile.name,
                level: profile.level,
                hp: profile.life?.current || 0,
                max_hp: profile.life?.maximum || 1,
                status: profile.status?.state || "",
                last_action: (profile.last_action?.timestamp || 0) * 1000
            },

            friendlyFaction: {
                id: faction.faction_id,
                name: faction.name,
                respect: faction.respect || 0,
                members: friendlyMembers
            },

            enemyFaction: {
                id: enemyFaction.faction_id || 0,
                name: enemyFaction.name || "Unknown",
                respect: enemyFaction.respect || 0,
                members: enemyMembers,
                territory: enemyFaction.territory || []
            },

            friendlyMembers,
            enemyMembers,
            chain: chainPackage
        };
    },

    ////////////////////////////////////////////////////////
    // MOMENTUM + COLLAPSE AI
    ////////////////////////////////////////////////////////

    computeChainMomentum(chain){
        const hits = chain.current || 0;
        const window = this.chainSamples.slice(-10);
        const totalHits = window.reduce((sum,c)=> sum + (c.hits || 0), 0);
        return Math.round((totalHits / (10 * (hits || 1))) * 100);
    },

    computeCollapseRisk(chain){
        const t = chain.timeout || 0;
        if (t > 90) return 0;
        if (t > 60) return 10;
        if (t > 45) return 25;
        if (t > 30) return 40;
        if (t > 15) return 70;
        return 90;
    }
};

WAR_GENERAL.register("Lieutenant", Lieutenant);

})();
