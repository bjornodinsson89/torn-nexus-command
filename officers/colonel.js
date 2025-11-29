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
        war: {},       // Active/Ranked wars
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

Colonel.ingestIntel = function(d){
    if (!d || !d.user) return;

    this.state.user = d.user || {};
    this.state.faction = d.faction || {};
    this.state.factionMembers = d.faction?.members || {};
    this.state.chain = d.chain || {};
    // Ensure war data is robust
    this.state.war = d.faction?.wars || d.war || {}; 
    
    // Flatten enemies
    const enemyMembers = {};
    if (d.enemies && Array.isArray(d.enemies)) {
        for (const ef of d.enemies) {
            if (ef.members) {
                for (const id in ef.members) {
                    const em = ef.members[id];
                    enemyMembers[id] = {
                        id: Number(id),
                        name: em.name || "Unknown",
                        level: em.level || 0,
                        status: em.status?.state || "",
                        last_action: em.last_action?.timestamp || 0,
                        online: em.status?.state === "Online",
                        ...em
                    };
                }
            }
        }
    } else if (d.enemyMembersFlat) {
        Object.assign(enemyMembers, d.enemyMembersFlat);
    }

    this.state.enemyMembers = enemyMembers;
    this.state.enemyFaction = d.enemies || [];
    this.lastIntelTs = d.timestamp || Date.now();

    this.learnFromIntel();
    this.recomputeAI();
    this.pushSitrep();
};

Colonel.learnFromIntel = function(){
    const now = Date.now();
    
    // Prune old enemies (>24h)
    if(this.memory.enemy){
        for(const k in this.memory.enemy){
            if(now - this.memory.enemy[k].lastSeen > 86400000) delete this.memory.enemy[k];
        }
    }

    const enemyList = Object.values(this.state.enemyMembers);
    for (const e of enemyList){
        const id = e.id;
        if (!this.memory.enemy[id]){
            this.memory.enemy[id] = { onlineTrend: [], hospTrend: [], lastSeen: 0 };
        }
        const mem = this.memory.enemy[id];
        mem.lastSeen = now;
        
        if (e.online) mem.onlineTrend.push(now);
        if ((e.status || "").toLowerCase().includes("hospital")) mem.hospTrend.push(now);
        
        if (mem.onlineTrend.length > 500) mem.onlineTrend.splice(0, 200);
    }

    const chain = this.state.chain || {};
    const timeLeft = chain.timeLeft ?? chain.timeout ?? 0;
    
    if (typeof chain.hits === "number" && chain.hits > 0){
        this.memory.chain.pace.push({ ts: now, hits: chain.hits, timeLeft: timeLeft });
        if(this.memory.chain.pace.length > 400) this.memory.chain.pace.splice(0, 200);
    }

    if (now - this.memory.lastSync > 60000){
        this.memory.lastSync = now;
        this.syncMemoryToFirebase();
    }
};

Colonel.syncMemoryToFirebase = function(){
    if (!this.state.faction.id) return;
    const path = `factions/${this.state.faction.id}/ai_memory`;
    this.nexus.events.emit("AI_MEMORY_WRITE", { path, payload: this.memory });
};

Colonel.recomputeAI = function(){
    const weights = this.memory.weights[this.mode.toLowerCase()] || this.memory.weights.hybrid;
    const enemyList = Object.values(this.state.enemyMembers);
    
    const online = enemyList.filter(e => e.online).length;
    const threat = Math.min(1, (online * 0.05 * weights.activity));

    const chain = this.state.chain || {};
    const timeLeft = chain.timeLeft ?? chain.timeout ?? 0;
    let risk = 0;

    if (timeLeft < 30) risk = 0.9;
    else if (timeLeft < 60) risk = 0.5;
    else if (timeLeft < 120) risk = 0.2;
    
    const summary = [];
    if(threat > 0.5) summary.push("HEAVY ENEMY RESISTANCE");
    if(risk > 0.6) summary.push("CHAIN CRITICAL - STABILIZE");
    if(chain.hits > 50) summary.push("MOMENTUM ESTABLISHED");
    if(summary.length === 0) summary.push("SECTOR QUIET - AWAITING ORDERS");

    this.ai = {
        threat,
        risk,
        aggression: (chain.hits > 10 ? 0.7 : 0.2),
        instability: risk,
        prediction: { nextHit: 0, drop: 0 },
        topTargets: this.scoreEnemies(enemyList, weights).slice(0, 10),
        summary,
        mode: this.mode
    };
};

Colonel.scoreEnemies = function(list, weights){
    if(!list) return [];
    return list.map(e => {
        let score = (e.level || 1) * weights.vulnerability;
        if (e.online) score += 50;
        if ((e.status||"").toLowerCase().includes("hospital")) score = 0;
        if ((e.status||"").toLowerCase().includes("travel")) score *= 0.1; // Hard to hit
        return { ...e, score: Math.round(score) };
    }).sort((a, b) => b.score - a.score);
};

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

Colonel.answerAI = function(payload){
    const q = (payload.question || "").toLowerCase();
    let answer = "UNKNOWN COMMAND. TYPE 'HELP'.";
    
    if (q.includes("status")) {
        answer = `SYSTEMS ONLINE. MODE: ${this.mode}. THREAT: ${(this.ai.threat*100).toFixed(0)}%.`;
    }
    else if (q.includes("target")) {
        const top = this.ai.topTargets[0];
        answer = top ? `PRIMARY TARGET: ${top.name} [Lv${top.level}]` : "NO VIABLE TARGETS.";
    }
    else if (q.includes("war")) {
        const warCount = Object.keys(this.state.war || {}).length;
        answer = warCount > 0 ? `${warCount} CONFLICTS DETECTED.` : "NO ACTIVE CONFLICTS.";
    }
    else if (q.includes("chain")) {
        answer = `LINK STATUS: ${this.state.chain.hits || 0} HITS. TIMEOUT: ${this.state.chain.timeout || 0}s.`;
    }
    else if (q.includes("help")) {
        answer = "COMMANDS: STATUS, TARGET, WAR, CHAIN, REPORT";
    }
    else if (q.includes("report")) {
        answer = this.ai.summary.join(" ") || "NOTHING TO REPORT.";
    }
    
    this.nexus.events.emit("ASK_COLONEL_RESPONSE", { answer });
};

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Colonel", module: Colonel });

})();
