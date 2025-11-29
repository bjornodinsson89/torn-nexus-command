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
    lastUpdateTS: 0,

    // Internal state model
    state: {
        user: {},
        chain: {},
        faction: {},
        enemies: []
    },

    // AI model state
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
        this.general.signals.listen("ASK_COLONEL", q => this.answerAI(q));

        if (typeof WARDBG === "function") WARDBG("Colonel online (v7.6)");
    },

    // -------------------------------------------------------
    //  INGEST RAW INTEL
    // -------------------------------------------------------
    ingest(d) {
        const now = Date.now();

        // Normalize RAW_INTEL into Colonel state
        this.state.user = d.user || {};
        this.state.chain = d.chain || {};
        this.state.faction = d.faction || {};
        this.state.enemies = this.normalizeEnemies(d.war.enemyMembers || {}, now);

        // AI update
        this.updateAI(now);

        // Build SITREP and dispatch
        this.dispatchSITREP();
        this.lastUpdateTS = now;
    },

    // -------------------------------------------------------
    //  NORMALIZE ENEMY MEMBERS (object map → array)
    // -------------------------------------------------------
    normalizeEnemies(obj, now) {
        return Object.values(obj || {}).map(m => ({
            id: m.ID || m.id,
            name: m.name,
            level: m.level,
            status: m.status?.state || "",
            last_action: {
                timestamp: m.last_action?.timestamp || 0,
                relative: m.last_action?.relative || ""
            },
            online: (now - (m.last_action?.timestamp || 0)) < 600000
        }));
    },

    // -------------------------------------------------------
    //  AI MODEL: SCORING, THREAT, RISK, ETC.
    // -------------------------------------------------------
    updateAI(now) {
        const user = this.state.user;
        const chain = this.state.chain;
        const enemies = this.state.enemies;

        //---------------------------------------------------
        // THREAT (enemy activity + chain movement)
        //---------------------------------------------------
        const onlineEnemies = enemies.filter(e => e.online).length;

        let threat = 0;
        threat += Math.min(0.7, onlineEnemies * 0.04);

        const hosp = enemies.filter(e => e.status.toLowerCase().includes("hospital")).length;
        if (hosp < enemies.length * 0.5) threat += 0.1;

        if ((chain.hits || 0) > 0) threat += 0.15;

        //---------------------------------------------------
        // RISK (chain collapse danger)
        //---------------------------------------------------
        let risk = 0;
        if (chain.timeLeft < 20) risk += 0.7;
        else if (chain.timeLeft < 60) risk += 0.4;

        if ((user.status || "").toLowerCase().includes("hospital"))
            risk += 0.2;

        //---------------------------------------------------
        // AGGRESSION (hits per second)
        //---------------------------------------------------
        let aggression = 0;
        if (this.lastUpdateTS > 0) {
            const dt = (now - this.lastUpdateTS) / 1000;
            aggression = (chain.hits || 0) / Math.max(1, dt);
        }

        //---------------------------------------------------
        // INSTABILITY (volatility metric)
        //---------------------------------------------------
        let instability = Math.abs((chain.timeLeft || 0) - 30) / 60;

        //---------------------------------------------------
        // PREDICTIONS
        //---------------------------------------------------
        const drop = chain.timeLeft < 120 ? (120 - chain.timeLeft) / 2 : 0;
        const nextHit = onlineEnemies > 0
            ? Math.round(onlineEnemies * threat * 2)
            : 0;

        //---------------------------------------------------
        // TARGET SCORING
        //---------------------------------------------------
        const topTargets = this.scoreEnemies(enemies, now);

        //---------------------------------------------------
        // APPLY TO AI STATE
        //---------------------------------------------------
        this.ai.threat = Math.min(1, threat);
        this.ai.risk = Math.min(1, risk);
        this.ai.aggression = Math.min(1, aggression);
        this.ai.instability = Math.min(1, instability);
        this.ai.prediction = { drop: Math.max(0, drop), nextHit };
        this.ai.topTargets = topTargets.slice(0, 10);
        this.ai.notes = this.generateNotes();
    },

    // -------------------------------------------------------
    //  SCORING: Returns array sorted by score
    // -------------------------------------------------------
    scoreEnemies(list, now) {
        return list.map(m => {
            let score = 0;

            // Level weight
            score += (m.level || 1) * 2;

            // Status penalties
            const st = m.status.toLowerCase();
            if (st.includes("hospital")) score -= 25;
            if (st.includes("jail")) score -= 30;
            if (st.includes("travel")) score -= 15;

            // Recent activity
            if ((m.last_action.timestamp || 0) > now - 300000)
                score += 15;

            return { ...m, score: Math.max(0, score) };
        }).sort((a, b) => b.score - a.score);
    },

    // -------------------------------------------------------
    //  NOTES FOR MAJOR UI
    // -------------------------------------------------------
    generateNotes() {
        const a = this.ai;
        const c = this.state.chain;

        const notes = [];

        if (a.threat > 0.7) notes.push("High enemy activity detected.");
        if (a.risk > 0.7) notes.push("Chain stability critical.");
        if (c.hits > 0) notes.push("Chain engagement active.");
        if (a.prediction.nextHit > 0) notes.push("Enemy movement likely.");
        if (a.instability > 0.5) notes.push("Volatile battlefield conditions.");

        return notes;
    },

    // -------------------------------------------------------
    //  FORMAT SITREP FOR MAJOR + SERGEANT
    // -------------------------------------------------------
    buildFactionMembers() {
        const members = this.state.faction.members || {};
        return Object.values(members).map(m => ({
            id: m.ID || m.id,
            name: m.name,
            level: m.level,
            status: m.status?.state || "",
            last_action: m.last_action?.relative || "",
            online: ((Date.now() - (m.last_action?.timestamp || 0)) < 600000)
        }));
    },

    buildEnemyMembers() {
        return this.ai.topTargets.map(t => ({
            id: t.id,
            name: t.name,
            level: t.level,
            status: t.status,
            online: t.online,
            score: t.score
        }));
    },

    dispatchSITREP() {
        const sitrep = {
            user: this.state.user,
            chain: this.state.chain,
            factionMembers: this.buildFactionMembers(),
            enemyFactionMembers: this.buildEnemyMembers(),
            targets: {
                personal: [],
                war: [],
                shared: [] // filled by Sergeant
            },
            ai: this.ai
        };

        this.general.signals.dispatch("SITREP_UPDATE", sitrep);

        if (typeof WARDBG === "function") WARDBG("Colonel: SITREP dispatched");
    },

    // -------------------------------------------------------
    //  AI ANSWER BACK TO MAJOR
    // -------------------------------------------------------
    answerAI(payload) {
        const question = payload?.question.toLowerCase() || "";
        let response = "I don't understand.";

        const a = this.ai;
        const c = this.state.chain;

        if (question.includes("threat"))
            response = `Threat level: ${Math.round(a.threat * 100)}%.`;

        else if (question.includes("risk"))
            response = `Collapse risk: ${Math.round(a.risk * 100)}%.`;

        else if (question.includes("next hit"))
            response = `Estimated next hostile action: ${a.prediction.nextHit}.`;

        else if (question.includes("chain"))
            response = `Chain status: ${c.hits} hits, ${c.timeLeft}s remaining.`;

        else if (question.includes("targets"))
            response = `Top hostile: ${this.ai.topTargets[0]?.name || "None"}.`;

        this.general.signals.dispatch("ASK_COLONEL_RESPONSE", { answer: response });
    }
};

// Register with WAR_GENERAL
if (typeof WAR_GENERAL !== "undefined") {
    WAR_GENERAL.register("Colonel", Colonel);
} else if (typeof WARDBG === "function") {
    WARDBG("Colonel failed to register: WAR_GENERAL missing");
}

})();
