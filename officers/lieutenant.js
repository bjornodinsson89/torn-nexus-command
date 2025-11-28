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

const Lieutenant = {

    general: null,
    tick: 0,
    mode: "idle",  // "idle", "active", "critical"
    lastFetch: 0,
    errorCount: 0,

    // rolling windows
    chainSamples: [],

    init(general){
        this.general = general;
        WARDBG("Lieutenant online (Adaptive Intel Engine)");

        // Begin heartbeat
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
        // Without API key—do nothing
        if (!this.general.intel.hasCredentials()) return 30;

        // Default 15 seconds
        let interval = 15;

        const latest = this.chainSamples[this.chainSamples.length - 1];
        const hits = latest?.hits || 0;
        const timeout = latest?.timeLeft || 0;

        // If chain active
        if (hits > 0){
            this.mode = "active";
            interval = 5;

            // Critical mode — if timeout short
            if (timeout <= 45){
                this.mode = "critical";
                interval = 1;
            }
        } else {
            this.mode = "idle";
        }

        // If many errors—slow down
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

                // Dispatch to Colonel & Sergeant
                WAR_SANDBOX.signals.dispatch("RAW_INTEL", intel);
            })
            .catch(err => {
                this.errorCount++;
                WARDBG("Lieutenant fetch error: " + err);
            });
    },

    ////////////////////////////////////////////////////////
    // CHAIN STABILITY MODELING
    ////////////////////////////////////////////////////////

    trackChain(chain){
        this.chainSamples.push(chain);
        if (this.chainSamples.length > 60) this.chainSamples.shift();
    },

    ////////////////////////////////////////////////////////
    // NORMALIZATION — builds the intel package
    ////////////////////////////////////////////////////////

    normalizeIntel(data){
        const profile = data.profile || {};
        const chain = data.chain || {};
        const faction = data.faction || {};
        const war = data.war || {};

        const friendlyMembers = [];
        const enemyMembers = [];

        // Friendly faction members
        for (const id in faction.members || {}){
            const m = faction.members[id];
            friendlyMembers.push({
                id,
                name: m.name,
                level: m.level,
                status: m.status?.state || "",
                last_action: m.last_action?.timestamp || 0,
                factionPosition: m.position,
                statusDetail: m.status || {},
            });
        }

        // Enemy faction members
        const enemy = war?.war?.enemy_faction || {};
        for (const id in enemy.members || {}){
            const m = enemy.members[id];
            enemyMembers.push({
                id,
                name: m.name,
                level: m.level,
                status: m.status?.state || "",
                last_action: m.last_action?.timestamp || 0,
                factionPosition: m.position,
                statusDetail: m.status || {},
            });
        }

        // Chain metrics
        const chainModel = {
            hits: chain.current || 0,
            timeLeft: chain.timeout || 0,
            momentum: this.computeChainMomentum(chain),
            collapseRisk: this.computeCollapseRisk(chain),
        };

        return {
            user: {
                id: profile.player_id,
                name: profile.name,
                level: profile.level,
                hp: profile.life?.current || 0,
                max_hp: profile.life?.maximum || 1,
                status: profile.status?.state || "",
                last_action: profile.last_action?.timestamp || 0,
            },

            friendlyFaction: {
                id: faction.faction_id,
                name: faction.name,
                respect: faction.respect || 0,
                members: friendlyMembers
            },

            enemyFaction: {
                id: enemy.faction_id || 0,
                name: enemy.name || "Unknown",
                respect: enemy.respect || 0,
                territory: enemy.territory || [],
                members: enemyMembers
            },

            friendlyMembers,
            enemyMembers,
            chain: chainModel
        };
    },

    ////////////////////////////////////////////////////////
    // CHAIN MOMENTUM & COLLAPSE AI
    ////////////////////////////////////////////////////////

    computeChainMomentum(chain){
        const hits = chain.current || 0;
        const t = chain.timeout || 0;

        // Simple model: how many hits in last N samples
        const window = this.chainSamples.slice(-10);
        const totalHits = window.reduce((sum, c) => sum + (c.hits || 0), 0);

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
    },
};

return Lieutenant;

})());
