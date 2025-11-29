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

const Colonel = {
    nexus: null,
    mode: "HYBRID",
    lastIntelTs: 0,

    state: {
        user: {},
        faction: {},
        factionMembers: {},
        chain: {},
        war: { wars: {} },
        enemyFaction: [],
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
        chain: { pace: [], drops: [], timestamps: [] },
        war: { aggression: [], retaliation: [], timestamps: [] },
        weights: {
            offensive: { activity: 1.3, vulnerability: 0.9, window: 1.4 },
            defensive: { activity: 0.8, vulnerability: 1.3, window: 0.7 },
            hybrid:    { activity: 1.0, vulnerability: 1.0, window: 1.0 }
        },
        lastSync: 0
    }
};

/* ------------------------------------------------------------ */
/* INIT                                                          */
/* ------------------------------------------------------------ */

Colonel.init = function(nexus){
    this.nexus = nexus;

    this.nexus.events.on("RAW_INTEL", data => this.ingestIntel(data));
    this.nexus.events.on("SET_AI_MODE", mode => {
        this.mode = mode;
        this.ai.mode = mode;
        this.recomputeAI();
    });
    this.nexus.events.on("AI_MEMORY_UPDATE", mem => { if (mem) this.memory = mem; });
    this.nexus.events.on("ASK_COLONEL", payload => this.answerAI(payload));
};

/* ------------------------------------------------------------ */
/* INGEST INTEL                                                  */
/* ------------------------------------------------------------ */

Colonel.ingestIntel = function(d){
    if (!d || !d.user) return;

    this.state.user = d.user || {};
    this.state.faction = d.faction || {};
    this.state.factionMembers = d.faction?.members || {};

    // Chain safe fallback
    this.state.chain = d.chain || {};
    if (typeof this.state.chain.hits !== "number") this.state.chain.hits = 0;
    if (typeof this.state.chain.timeout !== "number") this.state.chain.timeout = 0;

    // ========= WAR FIX =========
    // Always enforce war structure as { wars:{} }
    if (d.faction?.wars && typeof d.faction.wars === "object") {
        this.state.war = { wars: d.faction.wars };
    } else if (d.war?.wars) {
        this.state.war = { wars: d.war.wars };
    } else {
        this.state.war = { wars: {} };
    }

    // ========= ENEMY MEMBERS FIX =========
    const enemyMembers = {};

    // Prefer detailed Lieutenant "enemies" array
    if (Array.isArray(d.enemies)){
        for (const ef of d.enemies){
            if (ef.members){
                for (const id in ef.members){
                    const m = ef.members[id];
                    enemyMembers[id] = {
                        id: Number(id),
                        name: m.name || "Unknown",
                        level: m.level || 0,
                        status: m.status?.state || "",
                        last_action: m.last_action?.timestamp || 0,
                        online: m.status?.state === "Online",
                        ...m
                    };
                }
            }
        }
    }

    // Lieutenant always provides flat fallback, use it too:
    if (d.enemyMembersFlat){
        for (const id in d.enemyMembersFlat){
            enemyMembers[id] = d.enemyMembersFlat[id];
        }
    }

    this.state.enemyMembers = enemyMembers;
    this.state.enemyFaction = d.enemies || [];  // still preserve array structure

    this.lastIntelTs = d.timestamp || Date.now();

    this.learnFromIntel();
    this.recomputeAI();
    this.pushSitrep();
};

/* ------------------------------------------------------------ */
/* LEARNING ENGINE                                               */
/* ------------------------------------------------------------ */

Colonel.learnFromIntel = function(){
    const now = Date.now();
    const enemyList = Object.values(this.state.enemyMembers);

    // prune >24h
    for (const k in this.memory.enemy){
        if (now - this.memory.enemy[k].lastSeen > 86400000){
            delete this.memory.enemy[k];
        }
    }

    for (const e of enemyList){
        const id = e.id;
        if (!id) continue;

        if (!this.memory.enemy[id]){
            this.memory.enemy[id] = { onlineTrend: [], hospTrend: [], lastSeen: 0 };
        }
        const mem = this.memory.enemy[id];
        mem.lastSeen = now;

        if (e.online) mem.onlineTrend.push(now);
        if ((e.status || "").toLowerCase().includes("hospital")) mem.hospTrend.push(now);

        if (mem.onlineTrend.length > 500) mem.onlineTrend.splice(0, 200);
    }

    // chain memory
    const chain = this.state.chain || {};
    const timeLeft = chain.timeLeft ?? chain.timeout ?? 0;

    if (typeof chain.hits === "number"){
        this.memory.chain.pace.push({ ts: now, hits: chain.hits, timeLeft });
        if (this.memory.chain.pace.length > 400) this.memory.chain.pace.splice(0, 200);
    }

    // periodic memory sync
    if (now - this.memory.lastSync > 60000){
        this.memory.lastSync = now;
        this.syncMemoryToFirebase();
    }
};

/* ------------------------------------------------------------ */
/* FIREBASE SYNC                                                 */
/* ------------------------------------------------------------ */

Colonel.syncMemoryToFirebase = function(){
    if (!this.state.faction.id) return;
    const path = `factions/${this.state.faction.id}/ai_memory`;
    this.nexus.events.emit("AI_MEMORY_WRITE", { path, payload: this.memory });
};

/* ------------------------------------------------------------ */
/* AI ENGINE                                                     */
/* ------------------------------------------------------------ */

Colonel.recomputeAI = function(){
    const weights = this.memory.weights[this.mode.toLowerCase()] 
        || this.memory.weights.hybrid;

    const enemyList = Object.values(this.state.enemyMembers);

    // Threat = % online × activity weight
    const online = enemyList.filter(e => e.online).length;
    const threat = Math.min(1, online * 0.05 * weights.activity);

    const chain = this.state.chain || {};
    const timeLeft = chain.timeLeft ?? chain.timeout ?? 0;

    // risk scale
    let risk = 0;
    if (timeLeft < 30) risk = 0.9;
    else if (timeLeft < 60) risk = 0.5;
    else if (timeLeft < 120) risk = 0.2;

    const summary = [];
    if (threat > 0.5) summary.push("HEAVY ENEMY RESISTANCE");
    if (risk > 0.6) summary.push("CHAIN CRITICAL - STABILIZE");
    if (chain.hits > 50) summary.push("MOMENTUM ESTABLISHED");
    if (!summary.length) summary.push("SECTOR QUIET - AWAITING ORDERS");

    const scored = this.scoreEnemies(enemyList, weights);

    this.ai = {
        threat,
        risk,
        aggression: chain.hits > 10 ? 0.7 : 0.2,
        instability: risk,
        prediction: { nextHit: 0, drop: 0 },
        topTargets: scored.slice(0, 10),
        summary,
        mode: this.mode
    };
};

Colonel.scoreEnemies = function(list, weights){
    if (!list) return [];
    return list.map(e => {
        let score = (e.level || 1) * weights.vulnerability;

        if (e.online) score += 50;
        if ((e.status||"").toLowerCase().includes("hospital")) score = 0;
        if ((e.status||"").toLowerCase().includes("travel")) score *= 0.1;

        return { ...e, score: Math.round(score) };
    }).sort((a,b) => b.score - a.score);
};

/* ------------------------------------------------------------ */
/* SITREP                                                        */
/* ------------------------------------------------------------ */

Colonel.pushSitrep = function(){
    this.nexus.events.emit("SITREP_UPDATE", {
        user: this.state.user,
        faction: this.state.faction,
        factionMembers: Object.values(this.state.factionMembers),
        chain: this.state.chain,
        war: this.state.war,              // FIXED: consistent { wars:{} }
        enemyFaction: this.state.enemyFaction,
        enemyMembers: Object.values(this.state.enemyMembers),
        ai: this.ai
    });
};

/* ------------------------------------------------------------ */
/* AI TERMINAL RESPONSES                                         */
/* ------------------------------------------------------------ */

Colonel.answerAI = function(payload){
    const q = (payload.question || "").toLowerCase();
    let answer = "UNKNOWN COMMAND. TYPE 'HELP'.";

    if (q.includes("status")){
        answer = `SYSTEMS ONLINE. MODE: ${this.mode}. THREAT: ${(this.ai.threat*100).toFixed(0)}%.`;
    }
    else if (q.includes("target")){
        const top = this.ai.topTargets[0];
        answer = top ? `PRIMARY TARGET: ${top.name} [Lv${top.level}]`
                     : "NO VIABLE TARGETS.";
    }
    else if (q.includes("war")){
        const warCount = Object.keys(this.state.war?.wars || {}).length;
        answer = warCount > 0 ? `${warCount} CONFLICTS DETECTED.` : "NO ACTIVE CONFLICTS.";
    }
    else if (q.includes("chain")){
        answer = `LINK STATUS: ${this.state.chain.hits || 0} HITS. TIMEOUT: ${this.state.chain.timeout || 0}s.`;
    }
    else if (q.includes("help")){
        answer = "COMMANDS: STATUS, TARGET, WAR, CHAIN, REPORT";
    }
    else if (q.includes("report")){
        answer = this.ai.summary.join(" ") || "NOTHING TO REPORT.";
    }

    this.nexus.events.emit("ASK_COLONEL_RESPONSE", { answer });
};

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Colonel", module: Colonel });

})();
