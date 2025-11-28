(function() {
    WARDBG("[OFFICER START] Lieutenant.js");

    const Lieutenant = {
        general: null,
        interval: null,
        tick: 0,
        chainActive: false,
        chainTimeout: 0,

        init(G) {
            this.general = G;
            WARDBG("Lieutenant init()");
            this.interval = setInterval(() => {
                if (!this.general.intel.hasCredentials()) return;
                this.tick++;
                const rate = this.getRate();
                if (this.tick >= rate) {
                    this.tick = 0;
                    this.requestIntel();
                }
            }, 1000);
        },

        getRate() {
            if (this.chainActive && this.chainTimeout < 45) return 1;
            if (this.chainActive) return 3;
            return 15;
        },

        requestIntel() {
            this.general.intel.request("basic,profile,chain,faction,territory,war")
                .then(d => {
                    const intel = this.normalize(d);
                    this.general.signals.dispatch("RAW_INTEL", intel);
                });
        },

        normalize(d) {
            const chain = d.chain || {};
            const profile = d.profile || {};
            const faction = d.faction || {};
            const war = d.war || {};

            this.chainActive = chain.current > 0;
            this.chainTimeout = chain.timeout || 0;

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

    WARDBG("[OFFICER END] Lieutenant.js");

    if (unsafeWindow.WAR_GENERAL)
        unsafeWindow.WAR_GENERAL.register("Lieutenant", Lieutenant);

})();
