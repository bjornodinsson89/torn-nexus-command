WARDBG("[OFFICER RAW LOAD] Colonel.js");

function NEXUS_COLONEL_MODULE() {

WARDBG("[OFFICER START] Colonel.js");

const Colonel = {
    general: null,
    state: {
        user: {},
        chain: {},
        faction: [],
        enemiesRaw: {},
        targets: { personal: [], war: [], shared: [] }
    },
    ai: {},
    lastUpdate: 0,

    init(G) {
        this.general = G;
        WARDBG("Colonel init()");
        this.general.signals.listen("RAW_INTEL", d => this.ingest(d));
    },

    ingest(d) {
        this.state.user = d.user || {};
        this.state.chain = d.chain || {};
        this.state.faction = d.factionMembers || [];
        this.state.enemiesRaw = d.enemyFactionMembers || {};
        this.state.targets = d.targets || this.state.targets;

        this.updateAI();
        this.pushSITREP();
    },

    updateAI() {
        const chain = this.state.chain;

        const enemies = Object.values(this.state.enemiesRaw).map(e => {
            return {
                ...e,
                lastActive: (Date.now() - (e.last_action?.timestamp * 1000 || 0)) < 600000
            };
        });

        const active = enemies.filter(e => e.lastActive).length;

        this.ai.threat = Math.min(1, active * 0.04);
        this.ai.risk = chain.timeLeft < 60 ? 0.5 : 0.1;
        this.ai.instability = Math.min(1, Math.abs((chain.timeLeft || 0) - 30) / 60);

        this.ai.prediction = {
            drop: Math.max(0, 120 - (chain.timeLeft || 0)),
            nextHit: active * 3
        };

        this.ai.topTargets = this.scoreTargets(enemies).slice(0, 10);
    },

    scoreTargets(list) {
        return list.map(m => {
            let score = (m.level || 1) * 2;

            const st = (m.status || "").toLowerCase();
            if (st.includes("hospital")) score -= 25;
            if (st.includes("jail")) score -= 30;

            if (m.lastActive) score += 15;

            return { ...m, score };
        }).sort((a, b) => b.score - a.score);
    },

    pushSITREP() {
        this.general.signals.dispatch("SITREP_UPDATE", {
            user: this.state.user,
            chain: this.state.chain,
            factionMembers: this.state.faction,
            enemyFactionMembers: this.ai.topTargets,
            targets: this.state.targets,
            ai: this.ai
        });
    }
};

WARDBG("[OFFICER END] Colonel.js");

if (window.WAR_GENERAL)
    window.WAR_GENERAL.register("Colonel", Colonel);

}

NEXUS_COLONEL_MODULE();
