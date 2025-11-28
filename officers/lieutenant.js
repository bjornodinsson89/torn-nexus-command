// === WAR_LIEUTENANT vX — NEXUS EDITION ===

(function() {
    const Lieutenant = {
        general: null,
        interval: null,
        memory: {
            chainActive: false,
            chainHits: 0,
            chainTimeout: 0
        },

        init(G) {
            this.general = G;
            this.start();
        },

        start() {
            this.interval = setInterval(() => {
                if (!this.general.intel.hasCredentials()) return;
                this.poll();
            }, 1000);
        },

        poll() {
            const rate = this.getRate();
            if (!this._tick) this._tick = 0;
            this._tick++;
            if (this._tick < rate) return;
            this._tick = 0;

            this.general.intel.request("chain,faction,war,profile")
                .then(d => {
                    const intel = this.normalize(d);
                    this.general.signals.dispatch("RAW_INTEL", intel);
                });
        },

        getRate() {
            if (this.memory.chainActive && this.memory.chainTimeout < 50) return 1;
            if (this.memory.chainActive) return 3;
            return 15;
        },

        normalize(d) {
            const chain = d.chain || {};
            const faction = d.faction || {};
            const profile = d.profile || {};
            const war = d.war || {};

            this.memory.chainActive = chain.current > 0;
            this.memory.chainHits = chain.current || 0;
            this.memory.chainTimeout = chain.timeout || 0;

            return {
                user: {
                    id: profile.player_id,
                    name: profile.name,
                    level: profile.level,
                    hp: profile.life?.current,
                    max_hp: profile.life?.maximum,
                    status: profile.status?.state,
                    last_action: profile.last_action?.relative
                },
                chain: {
                    hits: chain.current || 0,
                    timeLeft: chain.timeout || 0,
                    log: chain.log || []
                },
                faction: {
                    id: faction.faction_id,
                    name: faction.name,
                    members: faction.members || {}
                },
                war: {
                    state: war.war?.status || "PEACE",
                    faction: war.war?.faction || {},
                    enemy: war.war?.enemy_faction || {},
                    enemyMembers: war.war?.enemy_faction?.members || {}
                }
            };
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Lieutenant", Lieutenant);
})();
