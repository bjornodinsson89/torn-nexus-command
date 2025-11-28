// === WAR_COLONEL vΩ — NEXUS STRATEGIC AI ===

(function() {
    const Colonel = {
        general: null,
        lastUpdate: 0,
        ai: {
            threat: 0,
            risk: 0,
            aggression: 0,
            instability: 0,
            prediction: { drop: 0, nextHit: 0 },
            topTargets: [],
            notes: []
        },
        state: {
            user: {},
            chain: {},
            faction: {},
            enemyMembers: {},
            targets: { personal: [], war: [], shared: [] }
        },

        init(G) {
            this.general = G;
            this.listen("RAW_INTEL", d => this.ingest(d));
        },

        listen(ev, fn) {
            this.general.signals.listen(ev, fn);
        },

        ingest(d) {
            this.state.user = d.user || {};
            this.state.chain = d.chain || {};
            this.state.faction = d.faction || {};
            this.state.enemyMembers = d.war?.enemyMembers || {};
            this.computeAI();
            this.dispatchSitrep();
        },

        computeAI() {
            const u = this.state.user;
            const c = this.state.chain;
            const e = Object.values(this.state.enemyMembers);
            const now = Date.now();

            let threat = 0;
            let risk = 0;
            let aggression = 0;
            let instability = 0;

            const online = e.filter(m => (now - (m.last_seen || 0)) < 600000).length;
            const hosp = e.filter(m => (m.status || "").toLowerCase().includes("hospital")).length;

            threat += Math.min(0.7, online * 0.04);
            threat += hosp < e.length * 0.5 ? 0.1 : 0;
            if (c.hits > 0) threat += 0.15;

            if (c.timeLeft < 20) risk += 0.7;
            else if (c.timeLeft < 60) risk += 0.4;

            if ((u.status || "").toLowerCase().includes("hospital")) risk += 0.2;

            aggression = (c.hits || 0) / Math.max(1, (now - this.lastUpdate) / 1000);
            instability = Math.abs((c.timeLeft || 0) - 30) / 60;

            const predictionDrop = c.timeLeft < 120 ? (120 - c.timeLeft) / 2 : 0;
            const predictionHit = online > 0 ? Math.round(online * threat * 3) : 0;

            this.ai.threat = Math.min(1, threat);
            this.ai.risk = Math.min(1, risk);
            this.ai.aggression = Math.min(1, aggression);
            this.ai.instability = Math.min(1, instability);
            this.ai.prediction = {
                drop: Math.max(0, predictionDrop),
                nextHit: predictionHit
            };

            this.ai.topTargets = this.scoreTargets(e).slice(0, 8);
            this.ai.notes = this.buildNotes();

            this.lastUpdate = now;
        },

        scoreTargets(list) {
            return list.map(m => {
                let s = 0;
                s += (m.level || 1) * 2;
                if ((m.status || "").toLowerCase().includes("hospital")) s -= 25;
                if ((m.status || "").toLowerCase().includes("jail")) s -= 30;
                if ((m.status || "").toLowerCase().includes("travel")) s -= 15;
                if ((m.last_seen || 0) > Date.now() - 300000) s += 15;
                return { ...m, score: Math.max(0, s) };
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

        dispatchSitrep() {
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
                onlineState: ((Date.now() - (x.last_action?.timestamp || 0)) < 600000) ? "online" : "offline",
                days: x.days_in_faction
            }));
        },

        formatEnemies() {
            return this.ai.topTargets.map(x => ({
                id: x.ID,
                name: x.name,
                level: x.level,
                status: x.status,
                onlineState: ((Date.now() - (x.last_seen || 0)) < 600000) ? "online" : "offline"
            }));
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Colonel", Colonel);
})();
