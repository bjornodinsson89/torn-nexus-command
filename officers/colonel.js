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
//   - WAR NEXUS LEARNING AI OFFICER
////////////////////////////////////////////////////////////

(function(){
"use strict";

/* BLOCK: STATE */

const Colonel = {
    nexus: null,
    mode: "HYBRID",
    lastIntelTs: 0,

    state: {
        user: {},
        faction: {},
        factionMembers: {},
        chain: {},
        war: {},
        enemyFaction: {},
        enemyMembers: {}
    },

    ai: {
        threat: 0,
        risk: 0,
        aggression: 0,
        instability: 0,
        prediction: { nextHit: 0, drop: 0 },
        topTargets: [],
        summary: [],
        mode: "HYBRID"
    },

    memory: {
        enemy: {},
        chain: {
            pace: [],
            drops: [],
            timestamps: []
        },
        war: {
            aggression: [],
            retaliation: [],
            timestamps: []
        },
        weights: {
            offensive: { activity: 1.3, vulnerability: 0.9, window: 1.4 },
            defensive: { activity: 0.8, vulnerability: 1.3, window: 0.7 },
            hybrid:    { activity: 1.0, vulnerability: 1.0, window: 1.0 }
        },
        lastSync: 0
    }
};

/* BLOCK: INIT */

Colonel.init = function(nexus){
    this.nexus = nexus;

    this.nexus.events.on("RAW_INTEL", data => {
        this.ingestIntel(data);
    });

    this.nexus.events.on("SET_AI_MODE", mode => {
        this.mode = mode;
        this.ai.mode = mode;
        this.recomputeAI();
    });

    this.nexus.events.on("AI_MEMORY_UPDATE", mem => {
        if (mem) this.memory = mem;
    });
};

/* BLOCK: INGEST INTEL */

Colonel.ingestIntel = function(d){
    this.state.user = d.user || {};
    this.state.faction = d.faction || {};
    this.state.factionMembers = d.factionMembers || {};
    this.state.chain = d.chain || {};
    this.state.war = d.war || {};
    this.state.enemyFaction = d.enemyFaction || {};
    this.state.enemyMembers = d.enemyMembers || {};

    this.lastIntelTs = d.ts || Date.now();

    this.learnFromIntel();
    this.recomputeAI();
    this.pushSitrep();
};

/* BLOCK: LEARNING ENGINE */

Colonel.learnFromIntel = function(){
    const now = Date.now();

    const enemyList = Object.values(this.state.enemyMembers);
    for (const e of enemyList){
        const id = e.id;
        if (!this.memory.enemy[id]){
            this.memory.enemy[id] = {
                onlineTrend: [],
                hospTrend: [],
                attackWindows: [],
                lastSeen: 0
            };
        }

        const mem = this.memory.enemy[id];
        mem.lastSeen = now;

        if (e.online === true){
            mem.onlineTrend.push(now);
        }

        const st = (e.status || "").toLowerCase();
        if (st.includes("hospital")){
            mem.hospTrend.push(now);
        }
    }

    const chain = this.state.chain || {};
    if (typeof chain.hits === "number" && typeof chain.timeLeft === "number"){
        this.memory.chain.pace.push({
            ts: now,
            hits: chain.hits,
            timeLeft: chain.timeLeft
        });

        if (chain.timeLeft < 20){
            this.memory.chain.drops.push(now);
        }
    }

    const war = this.state.war || {};
    if (war && war.status){
        this.memory.war.aggression.push({
            ts: now,
            status: war.status
        });
    }

    if (now - this.memory.lastSync > 60000){
        this.memory.lastSync = now;
        this.syncMemoryToFirebase();
    }
};

/* BLOCK: FIREBASE SYNC */

Colonel.syncMemoryToFirebase = function(){
    if (!this.state.faction.id) return;

    const path = `factions/${this.state.faction.id}/ai_memory`;
    const payload = this.memory;

    this.nexus.events.emit("AI_MEMORY_WRITE", {
        path,
        payload
    });
};

/* BLOCK: AI RECOMPUTE */

Colonel.recomputeAI = function(){
    const mode = this.mode;
    const weights = this.memory.weights[mode.toLowerCase()] || this.memory.weights.hybrid;

    const enemyList = Object.values(this.state.enemyMembers);
    const now = Date.now();

    let threat = 0;
    let risk = 0;
    let aggression = 0;
    let instability = 0;

    const online = enemyList.filter(e => e.online).length;
    const hosp = enemyList.filter(e => (e.status || "").toLowerCase().includes("hospital")).length;

    threat += online * 0.05 * weights.activity;
    if (hosp < enemyList.length * 0.5) threat += 0.1 * weights.vulnerability;

    const chain = this.state.chain || {};
    if (chain.hits > 0) aggression += (chain.hits / 10) * weights.window;

    if (chain.timeLeft < 20) risk += 0.7;
    else if (chain.timeLeft < 60) risk += 0.3;

    const sf = this.state.factionMembers || {};
    const userObj = this.state.user || {};
    if (userObj.status && userObj.status.toLowerCase().includes("hospital")){
        risk += 0.2;
    }

    instability = Math.abs((chain.timeLeft || 0) - 30) / 60;

    const avgPace = this.estimateChainPace();

    const nextHit = Math.round((online * threat * weights.window) + avgPace);
    const drop = chain.timeLeft < 120 ? (120 - chain.timeLeft) / 1.5 : 0;

    threat = Math.min(1, threat);
    risk = Math.min(1, risk);
    aggression = Math.min(1, aggression);
    instability = Math.min(1, instability);

    const scored = this.scoreEnemies(enemyList, weights);

    this.ai = {
        threat,
        risk,
        aggression,
        instability,
        prediction: { nextHit, drop },
        topTargets: scored.slice(0, 10),
        summary: this.buildSummary(),
        mode
    };
};

/* BLOCK: CHAIN PACE ESTIMATION */

Colonel.estimateChainPace = function(){
    const arr = this.memory.chain.pace;
    if (arr.length < 2) return 0;

    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];

    const dt = (last.ts - prev.ts) / 1000;
    if (dt <= 0) return 0;

    const dh = last.hits - prev.hits;
    if (dh <= 0) return 0;

    return dh / dt;
};

/* BLOCK: ENEMY SCORING */

Colonel.scoreEnemies = function(list, weights){
    const now = Date.now();

    return list.map(e => {
        let score = 0;

        score += (e.level || 1) * 2 * weights.vulnerability;

        if ((e.last_action || 0) > (now - 300000)){
            score += 15 * weights.window;
        }

        if ((e.status || "").toLowerCase().includes("hospital")){
            score -= 25 * weights.vulnerability;
        }

        return { ...e, score: Math.max(0, score) };
    }).sort((a, b) => b.score - a.score);
};

/* BLOCK: SUMMARY GENERATOR */

Colonel.buildSummary = function(){
    const out = [];
    if (this.ai.threat > 0.7) out.push("High enemy activity detected.");
    if (this.ai.risk > 0.6) out.push("Chain stability is low.");
    if (this.ai.aggression > 0.5) out.push("Aggressive pacing underway.");
    if (this.ai.instability > 0.5) out.push("Chain volatility detected.");

    return out;
};

/* BLOCK: SITREP DISPATCH */

Colonel.pushSitrep = function(){
    this.nexus.events.emit("SITREP_UPDATE", {
        user: this.state.user,
        faction: this.state.faction,
        factionMembers: Object.values(this.state.factionMembers),
        chain: this.state.chain,
        war: this.state.war,
        enemyFaction: this.state.enemyFaction,
        enemyMembers: Object.values(this.state.enemyMembers),
        ai: this.ai
    });
};

/* BLOCK: NATURAL LANGUAGE ENGINE */

Colonel.parseQuestion = function(q){
    const s = q.toLowerCase();

    if (s.includes("threat")) return "THREAT";
    if (s.includes("risk")) return "RISK";
    if (s.includes("chain")) return "CHAIN";
    if (s.includes("best")) return "BEST";
    if (s.includes("target")) return "BEST";
    if (s.includes("status")) return "STATUS";
    if (s.includes("explain")) return "EXPLAIN";
    if (s.includes("overview")) return "OVERVIEW";

    return "UNKNOWN";
};

Colonel.answerAI = function(payload){
    const q = payload.question || "";
    const type = this.parseQuestion(q);

    let answer = "I need more information.";

    const a = this.ai;
    const c = this.state.chain;

    if (type === "THREAT"){
        answer = `Threat level is ${Math.round(a.threat * 100)}%.`;
    }
    else if (type === "RISK"){
        answer = `Chain risk is ${Math.round(a.risk * 100)}%.`;
    }
    else if (type === "CHAIN"){
        answer = `Chain at ${c.hits || 0} hits with ${c.timeLeft || 0}s remaining.`;
    }
    else if (type === "BEST"){
        answer = `Best target: ${a.topTargets[0]?.name || "None"} (${a.topTargets[0]?.score || 0} score).`;
    }
    else if (type === "STATUS"){
        answer = `Mode: ${a.mode}. Threat ${Math.round(a.threat*100)}%, Risk ${Math.round(a.risk*100)}%, Aggression ${Math.round(a.aggression*100)}%.`;
    }
    else if (type === "EXPLAIN"){
        answer = a.summary.join(" ") || "Conditions stable.";
    }
    else if (type === "OVERVIEW"){
        answer = `Threat ${Math.round(a.threat*100)}%. Risk ${Math.round(a.risk*100)}%. Next hit estimate ${a.prediction.nextHit}.`;
    }

    this.nexus.events.emit("ASK_COLONEL_RESPONSE", { answer });
};

/* BLOCK: FINAL REGISTRATION */

if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];

window.__NEXUS_OFFICERS.push({
    name: "Colonel",
    module: Colonel
});

})();
