WARDBG("[OFFICER RAW LOAD] Lieutenant.js");

function NEXUS_LIEUTENANT_MODULE() {

WARDBG("[OFFICER START] Lieutenant.js");

const Lieutenant = {
    general: null,
    tick: 0,
    chainActive: false,
    chainTimeout: 0,

    init(G) {
        this.general = G;
        WARDBG("Lieutenant init()");
        this.startHeartbeat();
    },

    startHeartbeat() {
        WARDBG("Lieutenant heartbeat started.");
        setInterval(() => {
            if (!this.general.intel.hasCredentials()) return;

            this.tick++;
            const rate = this.getRate();
            if (this.tick >= rate) {
                this.tick = 0;
                this.fetch();
            }
        }, 1000);
    },

    getRate() {
        if (this.chainActive && this.chainTimeout < 45) return 1;
        if (this.chainActive) return 3;
        return 15;
    },

    fetch() {
        this.general.intel
            .request("basic,profile,chain,faction,territory,war")
            .then(d => this.process(d))
            .catch(err => WARDBG("Lieutenant error: " + err));
    },

    process(d) {
        const chain = d.chain || {};
        const profile = d.profile || {};
        const faction = d.faction || {};
        const war = d.war || {};

        this.chainActive = chain.current > 0;
        this.chainTimeout = chain.timeout || 0;

        this.general.signals.dispatch("RAW_INTEL", {
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
            factionMembers: faction.members || {},
            enemyFactionMembers: war.war?.enemy_faction?.members || {},
            targets: {}
        });
    }
};

WARDBG("[OFFICER END] Lieutenant.js");

if (window.WAR_GENERAL)
    window.WAR_GENERAL.register("Lieutenant", Lieutenant);

}

NEXUS_LIEUTENANT_MODULE();
