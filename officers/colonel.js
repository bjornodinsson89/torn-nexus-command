(function() {
    WARDBG("[OFFICER START] colonel.js");
    const Colonel = {
        general: null,
        lastUpdate: 0,
        state: {
            user: {},
            chain: {},
            faction: {},
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

        init(G) {
            this.general = G;
            WARDBG("Colonel init()");
            this.general.signals.listen("RAW_INTEL", d => this.ingest(d));
        },

        ingest(d) {
            this.state.user = d.user || {};
            this.state.chain = d.chain || {};
            this.state.faction = d.faction || {};
            this.state.enemiesRaw = d.war?.enemyMembers || {};
            this.updateAI();
            this.dispatchSITREP();
        },

        updateAI() {
            const user = this.state.user;
            const chain = this.state.chain;
            const members = Object.values(this.state.enemiesRaw);
            const now = Date.now();

            const online = members.filter(m => (now - (m.last_action?.timestamp || 0)) < 600000).length;
            const hosp = members.filter(m => (m.status || "").toLowerCase().includes("hospital")).length;

            let t = 0, r = 0, g = 0, s = 0;

            t += Math.min(0.7, online * 0.04);
            t += hosp < members.length * 0.5 ? 0.1 : 0;
            if (chain.hits > 0) t += 0.15;

            if (chain.timeLeft < 20) r += 0.7;
            else if (chain.timeLeft < 60) r += 0.4;

            if ((user.status || "").toLowerCase().includes("hospital")) r += 0.2;

            g = (chain.hits || 0) / Math.max(1, (now - this.lastUpdate) / 1000);
            s = Math.abs((chain.timeLeft || 0) - 30) / 60;

            const drop = chain.timeLeft < 120 ? (120 - chain.timeLeft) / 2 : 0;
            const nextHit = online > 0 ? Math.round(online * t * 3) : 0;

            this.ai.threat = Math.min(1, t);
            this.ai.risk = Math.min(1, r);
            this.ai.aggression = Math.min(1, g);
            this.ai.instability = Math.min(1, s);
            this.ai.prediction = { drop: Math.max(0, drop), nextHit };

            this.ai.topTargets = this.scoreTargets(members).slice(0, 10);
            this.ai.notes = this.buildNotes();

            this.lastUpdate = now;
        },

        scoreTargets(list) {
            return list.map(m => {
                let score = 0;
                score += (m.level || 1) * 2;

                const st = (m.status || "").toLowerCase();
                if (st.includes("hospital")) score -= 25;
                if (st.includes("jail")) score -= 30;
                if (st.includes("travel")) score -= 15;

                if ((m.last_action?.timestamp || 0) > Date.now() - 300000) score += 15;

                return { ...m, score: Math.max(0, score) };
            }).sort((a, b) => b.score - a.score);
        },

        buildNotes() {
            const a = this.ai;
            const c = this.state.chain;
            const n = [];

            if (a.threat > 0.7) n.push("High enemy activity detected.");
            if (a.risk > 0.7) n.push("Chain stability critical.");
            if (c.hits > 0) n.push("Chain engagement active.");
            if (a.prediction.nextHit > 0) n.push("Enemy movement likely.");
            if (a.instability > 0.5) n.push("Volatile battlefield conditions.");

            return n;
        },

        dispatchSITREP() {
            this.general.signals.dispatch("SITREP_UPDATE", {
                user: this.state.user,
                chain: this.state.chain,
                factionMembers: this.formatFaction(),
                enemyFactionMembers: this.formatEnemies(),
                targets: this.state.targets,
                ai: this.ai
            });
        },

        formatFaction() {
            const m = this.state.faction?.members || {};
            return Object.values(m).map(x => ({
                id: x.ID,
                name: x.name,
                level: x.level,
                status: x.status?.state || "",
                onlineState: ((Date.now() - (x.last_action?.timestamp || 0)) < 600000) ? "online" : "offline"
            }));
        },

        formatEnemies() {
            return this.ai.topTargets.map(x => ({
                id: x.ID,
                name: x.name,
                level: x.level,
                status: x.status,
                onlineState: ((Date.now() - (x.last_action?.timestamp || 0)) < 600000) ? "online" : "offline"
            }));
        }
    };
    WARDBG("[OFFICER END] colonel.js");

    if (window.WAR_GENERAL) WAR_GENERAL.register("Colonel", Colonel);
})();
