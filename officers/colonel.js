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

        ai: {
            threat: 0,
            risk: 0,
            aggression: 0,
            instability: 0,
            prediction: { drop: 0, nextHit: 0 },
            topTargets: [],
            notes: []
        },

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
            this.dispatchSITREP();
        },

        updateAI() {
            const now = Date.now();
            const chain = this.state.chain;
            const enemies = Object.values(this.state.enemiesRaw);

            const active = enemies.filter(m =>
                (now - (m.last_action?.timestamp || 0)) < 600000
            ).length;

            let threat = active * 0.04;
            let risk = chain.timeLeft < 20 ? 0.7 : (chain.timeLeft < 60 ? 0.4 : 0);
            let instability = Math.abs((chain.timeLeft || 0) - 30) / 60;

            this.ai.threat = Math.min(1, threat);
            this.ai.risk = Math.min(1, risk);
            this.ai.aggression = Math.min(1, chain.hits / 100);
            this.ai.instability = Math.min(1, instability);

            this.ai.prediction = {
                drop: Math.max(0, chain.timeLeft < 120 ? (120 - chain.timeLeft) / 2 : 0),
                nextHit: Math.round(active * threat * 3)
            };

            this.ai.topTargets = this.scoreTargets(enemies).slice(0, 10);
            this.ai.notes = this.buildNotes();

            this.lastUpdate = now;
        },

        scoreTargets(list) {
            return list.map(m => {
                let score = (m.level || 1) * 2;

                const st = (m.status || "").toLowerCase();
                if (st.includes("hospital")) score -= 25;
                if (st.includes("jail")) score -= 30;

                if ((m.last_action?.timestamp || 0) > Date.now() - 300000)
                    score += 15;

                return { ...m, score };
            }).sort((a, b) => b.score - a.score);
        },

        buildNotes() {
            const n = [];
            const a = this.ai;
            const c = this.state.chain;

            if (a.threat > 0.7) n.push("High enemy activity.");
            if (a.risk > 0.7) n.push("Chain risk critical.");
            if (c.hits > 0) n.push("Chain engagement ongoing.");
            if (a.prediction.nextHit > 0) n.push("Enemy movement predicted.");

            return n;
        },

        dispatchSITREP() {
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

    if (window.WAR_GENERAL) {
        WARDBG("Colonel registering with WAR_GENERAL");
        window.WAR_GENERAL.register("Colonel", Colonel);
    } else {
        WARDBG("ERROR: window.WAR_GENERAL missing during Colonel registration.");
    }
}

NEXUS_COLONEL_MODULE();
