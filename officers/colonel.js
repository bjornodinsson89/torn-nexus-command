// colonel.js — Maximum Military Intelligence AI

////////////////////////////////////////////////////////////
// COLONEL — MAXIMUM MILITARY INTELLIGENCE ENGINE
// Responsibilities:
//   - Full threat modeling
//   - Predictive enemy activity
//   - Chain stability analysis
//   - Attack viability scoring
//   - Online/offline pattern recognition
//   - Enemy faction threat matrix
//   - SITREP generation (full D-class package)
//   - Rolling activity windows (for Major graph)
//   - Integration with Sergeant shared intel
////////////////////////////////////////////////////////////

(function() {
    "use strict";

    const Colonel = {
        general: null,
        lastUpdate: 0,

        state: {
            user: {},
            chain: {},
            faction: {},
            enemiesRaw: {},
            targets: {
                personal: [],
                war: [],
                shared: []
            }
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
            this.general.signals.listen("RAW_INTEL", d => this.ingest(d));
            this.general.signals.listen("ASK_COLONEL", d => this.answerAI(d));
        },

        // ------------------------------------------------------------------
        // INGEST RAW INTEL → UPDATE STATE → UPDATE AI → DISPATCH SITREP
        // ------------------------------------------------------------------
        ingest(d) {
            this.state.user = d.user || {};
            this.state.chain = d.chain || {};
            this.state.faction = d.faction || {};
            this.state.enemiesRaw = d.war?.enemyMembers || {};

            this.updateAI();
            this.dispatchSITREP();
        },

        // ------------------------------------------------------------------
        // AI ENGINE CORE
        // ------------------------------------------------------------------
        updateAI() {
            const now = Date.now();
            const user = this.state.user;
            const chain = this.state.chain;
            const enemyList = Object.values(this.state.enemiesRaw);

            // Basic stats
            const online = enemyList.filter(
                m => (now - (m.last_action?.timestamp || 0)) < 600000
            ).length;

            const hosp = enemyList.filter(m => {
                const st = (m.status?.state || "").toLowerCase();
                return st.includes("hospital");
            }).length;

            // Threat (enemy activity + chain movement)
            let threat = 0;
            threat += Math.min(0.7, online * 0.04);
            if (hosp < enemyList.length * 0.5) threat += 0.1;
            if ((chain.hits || 0) > 0) threat += 0.15;

            // Risk (chain collapse danger)
            let risk = 0;
            if (chain.timeLeft < 20) risk += 0.7;
            else if (chain.timeLeft < 60) risk += 0.4;
            if ((user.status || "").toLowerCase().includes("hospital"))
                risk += 0.2;

            // Aggression (pace of hits)
            let aggression = 0;
            if (this.lastUpdate > 0) {
                const dt = (now - this.lastUpdate) / 1000;
                aggression = (chain.hits || 0) / Math.max(1, dt);
            }

            // Instability (volatility)
            let instability = Math.abs((chain.timeLeft || 0) - 30) / 60;

            // Prediction
            const drop = chain.timeLeft < 120 ? (120 - chain.timeLeft) / 2 : 0;
            const nextHit = online > 0 ? Math.round(online * threat * 3) : 0;

            this.ai.threat = Math.min(1, threat);
            this.ai.risk = Math.min(1, risk);
            this.ai.aggression = Math.min(1, aggression);
            this.ai.instability = Math.min(1, instability);
            this.ai.prediction = { drop: Math.max(0, drop), nextHit };

            // Score enemies
            this.ai.topTargets = this.scoreTargets(enemyList).slice(0, 10);

            // Build notes
            this.ai.notes = this.buildNotes();

            this.lastUpdate = now;
        },

        // ------------------------------------------------------------------
        // ENEMY SCORING
        // ------------------------------------------------------------------
        scoreTargets(list) {
            const now = Date.now();

            return list.map(m => {
                let score = 0;

                score += (m.level || 1) * 2;

                const st = (m.status?.state || "").toLowerCase();
                if (st.includes("hospital")) score -= 25;
                if (st.includes("jail")) score -= 30;
                if (st.includes("travel")) score -= 15;

                if ((m.last_action?.timestamp || 0) > now - 300000)
                    score += 15;

                return { ...m, score: Math.max(0, score) };
            }).sort((a, b) => b.score - a.score);
        },

        // ------------------------------------------------------------------
        // STRATEGIC NOTES FOR MAJOR OVERVIEW
        // ------------------------------------------------------------------
        buildNotes() {
            const notes = [];
            const a = this.ai;
            const c = this.state.chain;

            if (a.threat > 0.7) notes.push("High enemy activity detected.");
            if (a.risk > 0.7) notes.push("Chain stability critical.");
            if (c.hits > 0) notes.push("Chain engagement active.");
            if (a.prediction.nextHit > 0)
                notes.push("Enemy movement likely.");
            if (a.instability > 0.5)
                notes.push("Volatile battlefield conditions.");

            return notes;
        },

        // ------------------------------------------------------------------
        // SITREP BUILDER
        // ------------------------------------------------------------------
        formatFactionMembers() {
            const now = Date.now();
            const m = this.state.faction?.members || {};
            return Object.values(m).map(x => ({
                id: x.ID,
                name: x.name,
                level: x.level,
                status: x.status?.state || "",
                online: ((now - (x.last_action?.timestamp || 0)) < 600000),
                last_action: x.last_action?.relative
            }));
        },

        formatEnemyMembers() {
            const now = Date.now();
            return this.ai.topTargets.map(x => ({
                id: x.ID,
                name: x.name,
                level: x.level,
                status: x.status?.state || "",
                online: ((now - (x.last_action?.timestamp || 0)) < 600000),
                score: x.score
            }));
        },

        dispatchSITREP() {
            this.general.signals.dispatch("SITREP_UPDATE", {
                user: this.state.user,
                chain: this.state.chain,
                factionMembers: this.formatFactionMembers(),
                enemyFactionMembers: this.formatEnemyMembers(),
                targets: this.state.targets,
                ai: this.ai
            });
        },

        // ------------------------------------------------------------------
        // AI CONSOLE (Major → Colonel)
        // ------------------------------------------------------------------
        answerAI(payload) {
            const question = payload?.question || "";
            if (!question.trim()) return;

            let response = "I don't understand.";

            const a = this.ai;
            const c = this.state.chain;

            if (question.includes("threat"))
                response = `Threat level is ${Math.round(a.threat * 100)}%.`;

            else if (question.includes("risk"))
                response = `Chain collapse risk at ${Math.round(a.risk * 100)}%.`;

            else if (question.includes("next hit"))
                response = `Estimated next enemy action: ${a.prediction.nextHit} units.`;

            else if (question.includes("chain"))
                response = `Chain at ${c.hits} hits with ${c.timeLeft}s remaining.`;

            else if (question.includes("targets"))
                response = `Top hostile: ${this.ai.topTargets[0]?.name || "None"}.`;

            this.general.signals.dispatch("ASK_COLONEL_RESPONSE", {
                answer: response
            });
        }
    };

    if (typeof WAR_GENERAL !== "undefined") {
        WAR_GENERAL.register("Colonel", Colonel);
    } else if (typeof WARDBG === "function") {
        WARDBG("Colonel failed to register: WAR_GENERAL missing");
    }

})();
