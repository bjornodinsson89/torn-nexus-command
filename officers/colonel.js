(function(){
"use strict";

/* ============================================================
   COLONEL — AI COMMAND & THREAT ENGINE
   Persona: C (full AI persona).
   Natural-language parsing enabled.
   ============================================================ */

const Colonel = {
    nexus: null,
    mode: "HYBRID",      // offensive / defensive / hybrid
    nlMode: true,        // natural language ON

    /* AI Memory Structure (persisted via Sergeant)
       memory.enemy[id] = {
           totalEstimate: number,
           strRatio: number,
           defRatio: number,
           spdRatio: number,
           dexRatio: number,
           confidence: number  (0–1)
           lastUpdated: timestamp,
           attackHistory: [...]
       }
    */
    memory: {
        enemy: {},
        chain: { pace: [] },
        weights: {
            offensive: { activity: 1.3, vulnerability: 0.9, window: 1.4 },
            defensive: { activity: 0.8, vulnerability: 1.3, window: 0.7 },
            hybrid:    { activity: 1.0, vulnerability: 1.0, window: 1.0 }
        },
        lastSync: 0
    },

    state: {
        user: {},
        faction: {},
        factionMembers: {},
        chain: {},
        war: {},
        enemyMembers: {},
        enemyFactions: []
    },

    ai: {
        topTargets: [],
        summary: [],
        threat: 0,
        risk: 0,
        instability: 0,
        prediction: {},
        mode: "HYBRID"
    }
};

/* ============================================================
   INIT
   ============================================================ */
Colonel.init = function(nexus){
    this.nexus = nexus;

    // Intel events
    this.nexus.events.on("RAW_INTEL", d => this.ingestIntel(d));

    // AI memory update from Sergeant
    this.nexus.events.on("AI_MEMORY_UPDATE", m => { if (m) this.memory = m; });

    // Manual mode toggle
    this.nexus.events.on("SET_AI_MODE", mode => { 
        this.mode = mode;
        this.ai.mode = mode;
        this.recomputeAI();
    });

    // NL Queries
    this.nexus.events.on("ASK_COLONEL", q => this.answerQuery(q));
};


/* ============================================================
   INGEST INTEL
   ============================================================ */
Colonel.ingestIntel = function(d){
    if (!d || !d.user) return;

    try {
        this.state.user = d.user;
        this.state.faction = d.faction || {};
        this.state.factionMembers = d.faction.members || {};
        this.state.chain = d.chain || {};
        this.state.war = d.war || {};
        this.state.enemyFactions = d.enemyFaction || [];

        const enemyMap = {};
        for (const ef of d.enemyFaction){
            const members = ef.members || {};
            for (const mid in members) enemyMap[mid] = members[mid];
        }
        for (const mid in d.enemyMembersFlat){
            enemyMap[mid] = d.enemyMembersFlat[mid];
        }
        this.state.enemyMembers = enemyMap;

        this.learn(d);
        this.recomputeAI();
        this.pushSitrep();
    } catch(e){
        this.log("ERROR ingestIntel: "+e);
    }
};


/* ============================================================
   LEARNING ENGINE
   ============================================================ */
Colonel.learn = function(d){
    const now = Date.now();

    // Track all enemies
    for (const eId in this.state.enemyMembers){
        const e = this.state.enemyMembers[eId];
        if (!e) continue;

        if (!this.memory.enemy[eId]){
            this.memory.enemy[eId] = {
                totalEstimate: null,
                strRatio: null,
                defRatio: null,
                spdRatio: null,
                dexRatio: null,
                confidence: 0.25,
                lastUpdated: now,
                attackHistory: []
            };
        }
        this.memory.enemy[eId].lastUpdated = now;
    }

    // Learn from fights
    for (const atk of d.attacks || []){
        if (!atk) continue;
        const you = this.state.user.id;
        const isYou = atk.attacker === you;
        const opp = isYou ? atk.defender : atk.attacker;

        if (!this.memory.enemy[opp]) continue;
        this.learnFromFight(atk, opp);
    }

    // Chain pace
    const hits = d.chain?.hits || 0;
    const timeout = d.chain?.timeout || 0;
    this.memory.chain.pace.push({ ts: now, hits, timeout });
    if (this.memory.chain.pace.length > 500)
        this.memory.chain.pace.splice(0, 200);

    if (now - this.memory.lastSync > 60000){
        this.memory.lastSync = now;
        this.syncMemory();
    }
};


/* ============================================================
   LEARN FROM FIGHT — Fair Fight Reverse Solver
   ============================================================ */
Colonel.learnFromFight = function(atk, enemyId){
    const mem = this.memory.enemy[enemyId];
    if (!mem) return;

    const userStats = this.state.user.stats || {};
    const userTotal = userStats.total || (
        (userStats.strength||0) +
        (userStats.speed||0) +
        (userStats.dexterity||0) +
        (userStats.defense||0)
    );
    if (!userTotal) return;

    const ff = atk.modifier || atk.respect_gain || null;
    if (!ff) return;

    // Clamp
    const F = Math.max(0.01, Math.min(ff, 0.99));

    // Solve:
    // F = 1 - (U/E)^0.366  →  E = U / (1-F)^(1/0.366)
    const enemyTotal = userTotal / Math.pow((1 - F), (1/0.366));

    if (!mem.totalEstimate){
        mem.totalEstimate = enemyTotal;
        mem.confidence = 0.40;
    } else {
        mem.totalEstimate = (mem.totalEstimate * (mem.confidence*2) + enemyTotal) /
                            (mem.confidence*2 + 1);
        mem.confidence = Math.min(1.0, mem.confidence + 0.04);
    }
};


/* ============================================================
   ESTIMATE ENEMY DISTRIBUTION — Model C: Learning
   ============================================================ */
Colonel.estimateDistribution = function(id){
    const mem = this.memory.enemy[id];
    if (!mem) return { str:0.45, def:0.20, spd:0.25, dex:0.10 };

    // Prefer learned ratios
    if (mem.strRatio && mem.defRatio && mem.spdRatio && mem.dexRatio){
        const s = mem.strRatio + mem.defRatio + mem.spdRatio + mem.dexRatio;
        return {
            str: mem.strRatio/s,
            def: mem.defRatio/s,
            spd: mem.spdRatio/s,
            dex: mem.dexRatio/s
        };
    }

    // Default meta distribution
    return { str:0.45, def:0.20, spd:0.25, dex:0.10 };
};


/* ============================================================
   AI ENGINE
   ============================================================ */
Colonel.recomputeAI = function(){
    const enemies = Object.values(this.state.enemyMembers);
    const weights = this.memory.weights[this.mode.toLowerCase()] || this.memory.weights.hybrid;
    const userTotal = this.state.user.stats?.total || 1;

    const scored = enemies.map(e=>{
        const id = e.id;
        const mem = this.memory.enemy[id];

        let estTotal = mem?.totalEstimate;
        if (!estTotal){
            estTotal = this.estimateBaseline(e);
        }

        const online = e.online ? 1 : 0;
        const vuln = userTotal / (estTotal || 1);

        let score = 0;
        score += online * 40;
        score += vuln * 20 * weights.vulnerability;

        if ((e.status||"").toLowerCase().includes("hospital")) score = 0;
        if ((e.status||"").toLowerCase().includes("travel")) score *= 0.2;

        return {
            ...e,
            estimatedTotal: Math.round(estTotal),
            score: Math.round(score)
        };
    });

    scored.sort((a,b)=>b.score - a.score);

    const online = enemies.filter(e=>e.online).length;
    const threat = Math.min(1, online * 0.04);

    const timeLeft = this.state.chain.timeout || 0;
    const risk = timeLeft < 30 ? 0.85 : timeLeft < 60 ? 0.5 : 0.2;

    const summary = [];
    if (threat > 0.5) summary.push("High enemy activity detected.");
    if (risk > 0.6) summary.push("Chain approaching critical window.");
    if (!summary.length) summary.push("Situation stable.");

    this.ai = {
        topTargets: scored.slice(0,10),
        summary,
        mode: this.mode,
        threat,
        risk,
        instability: risk,
        prediction: {}
    };
};


/* ============================================================
   BASELINE STAT ESTIMATION
   ============================================================ */
Colonel.estimateBaseline = function(e){
    // Balanced baseline (Option 2)
    const lvl = e.level || 1;
    const K = 1800;
    return (lvl * lvl) * K;
};


/* ============================================================
   SITREP
   ============================================================ */
Colonel.pushSitrep = function(){
    this.nexus.events.emit("SITREP_UPDATE", {
        user: this.state.user,
        faction: this.state.faction,
        factionMembers: Object.values(this.state.factionMembers),
        chain: this.state.chain,
        war: this.state.war,
        enemyFaction: this.state.enemyFactions,
        enemyMembers: Object.values(this.state.enemyMembers),
        ai: this.ai
    });
};


/* ============================================================
   MEMORY SYNC
   ============================================================ */
Colonel.syncMemory = function(){
    if (!this.state.faction?.id) return;
    this.nexus.events.emit("AI_MEMORY_WRITE", {
        path:`factions/${this.state.faction.id}/ai_memory`,
        payload:this.memory
    });
};


/* ============================================================
   NATURAL LANGUAGE ENGINE
   ============================================================ */
Colonel.answerQuery = function(payload){
    const q = (payload.question || "").trim();
    if (!q){ 
        this.respond("I didn’t catch that. What do you need?");
        return;
    }

    const lower = q.toLowerCase();
    const words = lower.split(/\s+/);

    // Quick pattern routing
    if (lower.includes("who") && lower.includes("attack")){
        return this.respondTargetSuggestion();
    }
    if (lower.includes("strong") && lower.includes("enemy")){
        return this.respondStrongestEnemy();
    }
    if (lower.includes("weak") && lower.includes("enemy")){
        return this.respondWeakEnemies();
    }
    if (lower.includes("threat")){
        return this.respondThreat();
    }
    if (lower.includes("chain") && lower.includes("status")){
        return this.respondChainStatus();
    }
    if (lower.includes("war") && (lower.includes("status") || lower.includes("situation"))){
        return this.respondWarStatus();
    }
    if (lower.includes("expand")){
        return this.respondExpanded();
    }
    if (lower.includes("help")){
        return this.respondHelp();
    }
    if (lower.startsWith("target ")){
        const n = q.substring(7).trim();
        return this.respondTargetSpecific(n);
    }

    // Fallback
    return this.respond("I’m here. Clarify your request.");
};


/* ============================================================
   RESPONSES (short-by-default, expandable)
   ============================================================ */
Colonel.respond = function(text){
    this.nexus.events.emit("ASK_COLONEL_RESPONSE", { answer: text });
};
Colonel.respondHelp = function(){
    this.respond("Commands: who should I attack | chain status | war status | enemy threats | expand");
};

Colonel.respondExpanded = function(){
    const t = this.ai.topTargets;
    if (!t.length) return this.respond("No enemy intel available.");

    let str = "Extended Target Analysis:<br>";
    for (const e of t){
        str += `• ${e.name} (Lv ${e.level}) – Est ~${e.estimatedTotal} total stats<br>`;
    }
    this.respond(str);
};

Colonel.respondTargetSuggestion = function(){
    const t = this.ai.topTargets[0];
    if (!t) return this.respond("No viable targets detected.");
    this.respond(`Recommend engaging ${t.name}. Risk minimal.`);
};

Colonel.respondStrongestEnemy = function(){
    const arr = Object.values(this.state.enemyMembers);
    if (!arr.length) return this.respond("No enemies detected.");

    arr.sort((a,b)=>b.level - a.level);
    const top = arr[0];
    this.respond(`${top.name} appears strongest by level profile.`);
};

Colonel.respondWeakEnemies = function(){
    const arr = this.ai.topTargets.slice(-3);
    if (!arr.length) return this.respond("No weak targets detected.");
    const names = arr.map(e=>e.name).join(", ");
    this.respond(`Potential weak targets: ${names}`);
};

Colonel.respondThreat = function(){
    const t = Math.round(this.ai.threat*100);
    this.respond(`Enemy activity at ${t}%.`);
};

Colonel.respondChainStatus = function(){
    const c = this.state.chain;
    this.respond(`Chain at ${c.hits} hits. Timeout ${c.timeout}s.`);
};

Colonel.respondWarStatus = function(){
    const w = this.state.war;
    if (!w || !Object.keys(w).length) return this.respond("No active war.");
    this.respond("War active. Multiple conflicts detected.");
};

Colonel.respondTargetSpecific = function(name){
    name = name.toLowerCase();
    const e = Object.values(this.state.enemyMembers)
        .find(x => x.name.toLowerCase().includes(name));
    if (!e) return this.respond("No match found.");
    this.respond(`${e.name}: Level ${e.level}, status ${e.status}.`);
};


/* ============================================================
   LOG
   ============================================================ */
Colonel.log = function(x){ 
    this.nexus.log("[COLONEL] "+x);
};


/* ============================================================
   REGISTER MODULE
   ============================================================ */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name:"Colonel", module:Colonel });

})();
