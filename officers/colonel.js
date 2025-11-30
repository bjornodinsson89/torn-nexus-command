(function(){
"use strict";

/* ============================================================
   COLONEL — DARK OPS AI COMMAND MODULE (Revised + Hardened)
   ============================================================ */

const Colonel = {
    nexus: null,
    mode: "HYBRID",
    nlMode: true,

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
Colonel.init = function(nx){
    this.nexus = nx;

    nx.events.on("RAW_INTEL", d => this.ingestIntel(d));
    nx.events.on("AI_MEMORY_UPDATE", m => { if(m) this.memory = m; });
    nx.events.on("SET_AI_MODE", mode => {
        this.mode = mode;
        this.ai.mode = mode;
        this.recomputeAI();
    });
    nx.events.on("ASK_COLONEL", q => this.answerQuery(q));
};

/* ============================================================
   SAFE NORMALIZATION HELPERS
   ============================================================ */
Colonel.safeArray = function(x){
    return Array.isArray(x) ? x : [];
};
Colonel.safeObj = function(x){
    return (x && typeof x === "object") ? x : {};
};

/* ============================================================
   INGEST INTEL — FULLY SAFETY-HARDENED
   ============================================================ */
Colonel.ingestIntel = function(d){
    try {
        d = this.safeObj(d);

        this.state.user = this.safeObj(d.user);
        this.state.faction = this.safeObj(d.faction);
        this.state.factionMembers = this.safeObj(d.faction.members);

        this.state.chain = this.safeObj(d.chain);
        this.state.war = this.safeObj(d.war);

        const enemyFactions = this.safeArray(d.enemyFaction);
        const enemyFlat = this.safeObj(d.enemyMembersFlat);

        this.state.enemyFactions = enemyFactions;

        const map = {};

        // Faction-grouped lists
        for (const ef of enemyFactions){
            const members = this.safeObj(ef.members);
            for (const id in members) map[id] = members[id];
        }

        // Flat list
        for (const id in enemyFlat) map[id] = enemyFlat[id];

        this.state.enemyMembers = map;

        this.learn(d);
        this.recomputeAI();
        this.pushSitrep();

    } catch(e){
        this.log("ERROR ingestIntel: "+e);
    }
};

/* ============================================================
   LEARNING ENGINE — Updated & Safer
   ============================================================ */
Colonel.learn = function(d){
    const now = Date.now();

    // Ensure every enemy gets a memory slot
    for (const id in this.state.enemyMembers){
        if (!this.memory.enemy[id]){
            this.memory.enemy[id] = {
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
        this.memory.enemy[id].lastUpdated = now;
    }

    // Track chain pace
    const hits = this.state.chain.hits || 0;
    const timeout = this.state.chain.timeout || 0;
    this.memory.chain.pace.push({ ts:now, hits, timeout });
    if (this.memory.chain.pace.length > 1000)
        this.memory.chain.pace.splice(0, 500);

    // Learn from fights
    for (const atk of this.safeArray(d.attacks)){
        this.learnFromFight(atk);
    }

    if (now - this.memory.lastSync > 60000){
        this.memory.lastSync = now;
        this.syncMemory();
    }
};

/* ============================================================
   LEARN FROM SINGLE FIGHT — Using FF reverse solver
   ============================================================ */
Colonel.learnFromFight = function(atk){
    if (!atk) return;

    const you = this.state.user.id;
    const enemyId = atk.attacker === you ? atk.defender : atk.attacker;

    const mem = this.memory.enemy[enemyId];
    if (!mem) return;

    const userStats = this.safeObj(this.state.user.stats);
    const userTotal = userStats.total || (
        (userStats.strength||0) +
        (userStats.speed||0) +
        (userStats.dexterity||0) +
        (userStats.defense||0)
    );
    if (!userTotal) return;

    const ff = atk.modifier || atk.respect_gain;
    if (!ff) return;

    const F = Math.max(0.01, Math.min(ff, 0.99));
    const enemyTotal = userTotal / Math.pow((1-F),(1/0.366));

    if (!mem.totalEstimate){
        mem.totalEstimate = enemyTotal;
        mem.confidence = 0.40;
    } else {
        mem.totalEstimate =
            (mem.totalEstimate*(mem.confidence*2) + enemyTotal) /
            (mem.confidence*2 + 1);
        mem.confidence = Math.min(1.0, mem.confidence + 0.05);
    }

    mem.attackHistory.push({ ts:Date.now(), ff, enemyTotal });
    if (mem.attackHistory.length > 50)
        mem.attackHistory.splice(0, 25);
};

/* ============================================================
   ESTIMATED DISTRIBUTION
   ============================================================ */
Colonel.estimateDistribution = function(id){
    const mem = this.memory.enemy[id];
    if (!mem) return { str:0.45, def:0.20, spd:0.25, dex:0.10 };

    if (mem.strRatio != null){
        const total = mem.strRatio + mem.defRatio + mem.spdRatio + mem.dexRatio;
        return {
            str: mem.strRatio/total,
            def: mem.defRatio/total,
            spd: mem.spdRatio/total,
            dex: mem.dexRatio/total
        };
    }

    return { str:0.45, def:0.20, spd:0.25, dex:0.10 };
};

/* ============================================================
   BASELINE FALLBACK MODEL
   ============================================================ */
Colonel.estimateBaseline = function(e){
    const lvl = e.level||1;
    return lvl*lvl*1800;
};

/* ============================================================
   AI RECOMPUTE — Smarter Threat Logic
   ============================================================ */
Colonel.recomputeAI = function(){
    const enemies = Object.values(this.state.enemyMembers);
    const userTotal = this.state.user.stats?.total || 1;

    const weights = this.memory.weights[this.mode.toLowerCase()] ||
                    this.memory.weights.hybrid;

    const scored = enemies.map(e=>{
        const mem = this.memory.enemy[e.id];

        const estTotal = mem?.totalEstimate || this.estimateBaseline(e);

        let score = 0;
        const online = e.online ? 1 : 0;
        const vuln = userTotal / Math.max(estTotal,1);

        score += online * 40;
        score += vuln * 20 * weights.vulnerability;

        if ((e.status||"").toLowerCase().includes("hospital")) score = 0;
        if ((e.status||"").toLowerCase().includes("travel")) score *= 0.25;

        return {
            ...e,
            estimatedTotal: Math.round(estTotal),
            score: Math.round(score)
        };
    });

    scored.sort((a,b)=>b.score - a.score);

    const onlineCount = enemies.filter(e=>e.online).length;
    const threat = Math.min(1, onlineCount * 0.035);

    const timeout = this.state.chain.timeout||0;
    const risk = timeout < 30 ? 0.85 :
                 timeout < 60 ? 0.5 : 0.2;

    const summary = [];
    if (threat > 0.5) summary.push("High enemy activity.");
    if (risk > 0.6) summary.push("Chain is in critical condition.");
    if (!summary.length) summary.push("Situation nominal.");

    this.ai = {
        topTargets: scored.slice(0,10),
        summary,
        mode: this.mode,
        threat,
        risk,
        instability: risk,
        prediction:{}
    };
};

/* ============================================================
   SITREP
   ============================================================ */
Colonel.pushSitrep = function(){
    this.nexus.events.emit("SITREP_UPDATE", {
        user:this.state.user,
        faction:this.state.faction,
        factionMembers:Object.values(this.state.factionMembers),
        chain:this.state.chain,
        war:this.state.war,
        enemyFaction:this.state.enemyFactions,
        enemyMembers:Object.values(this.state.enemyMembers),
        ai:this.ai
    });
};

/* ============================================================
   MEMORY SYNC
   ============================================================ */
Colonel.syncMemory = function(){
    if (!this.state.faction.id) return;
    this.nexus.events.emit("AI_MEMORY_WRITE", {
        path:`factions/${this.state.faction.id}/ai_memory`,
        payload:this.memory
    });
};

/* ============================================================
   NATURAL LANGUAGE ENGINE — Upgraded
   ============================================================ */
Colonel.answerQuery = function(payload){
    const q = (payload.question||"").trim();
    if (!q) return this.respond("What do you need?");

    const L = q.toLowerCase();

    // Expanded NLP routing
    if (/who.*attack/.test(L)) return this.cmdRecommendTarget();
    if (/best.*target/.test(L)) return this.cmdRecommendTarget();
    if (/weak.*enemy/.test(L)) return this.cmdWeakEnemies();
    if (/strong.*enemy/.test(L)) return this.cmdStrongestEnemy();
    if (/threat/.test(L)) return this.cmdThreat();
    if (/chain.*status/.test(L)) return this.cmdChainStatus();
    if (/war.*status/.test(L)) return this.cmdWarStatus();
    if (/expand|details|full/.test(L)) return this.cmdExpanded();
    if (/list.*targets/.test(L)) return this.cmdListTargets();
    if (/enemy.*list/.test(L)) return this.cmdListEnemies();
    if (/predict/.test(L)) return this.cmdPredict();
    if (/compare (.+) to (.+)/.test(L)) return this.cmdCompare(L);

    // Target by name
    const targetMatch = L.match(/target (.+)/);
    if (targetMatch){
        return this.cmdTargetSpecific(targetMatch[1]);
    }

    // Unknown
    return this.respond("Clarify your request. Say 'help' for options.");
};

/* ============================================================
   COMMAND RESPONSES
   ============================================================ */
Colonel.respond = function(text){
    this.nexus.events.emit("ASK_COLONEL_RESPONSE", { answer:text });
};

Colonel.cmdRecommendTarget = function(){
    const t = this.ai.topTargets[0];
    if (!t) return this.respond("No valid targets detected.");
    this.respond(`Primary target: <b>${t.name}</b> — estimated ${t.estimatedTotal.toLocaleString()} stats.`);
};

Colonel.cmdWeakEnemies = function(){
    const arr = this.ai.topTargets.slice(-3);
    if (!arr.length) return this.respond("No weak targets available.");
    const names = arr.map(e=>e.name).join(", ");
    this.respond(`Weakest viable targets: ${names}.`);
};

Colonel.cmdStrongestEnemy = function(){
    const arr = Object.values(this.state.enemyMembers);
    if (!arr.length) return this.respond("No enemies detected.");
    arr.sort((a,b)=>b.level - a.level);
    const t = arr[0];
    this.respond(`Strongest enemy observed: ${t.name} (Lv ${t.level}).`);
};

Colonel.cmdListTargets = function(){
    const arr = this.ai.topTargets;
    if (!arr.length) return this.respond("No enemy profiles.");
    let text = "<b>Top Targets:</b><br>";
    for (const e of arr){
        text += `• ${e.name} — Score ${e.score}, est ${e.estimatedTotal.toLocaleString()}<br>`;
    }
    this.respond(text);
};

Colonel.cmdListEnemies = function(){
    const arr = Object.values(this.state.enemyMembers);
    if (!arr.length) return this.respond("No enemies detected.");
    let text = "<b>Enemy Roster:</b><br>";
    for (const e of arr.slice(0,40)){
        text += `• ${e.name} (Lv ${e.level}) — ${e.status}<br>`;
    }
    this.respond(text);
};

Colonel.cmdThreat = function(){
    const t = Math.round(this.ai.threat*100);
    this.respond(`Threat level: ${t}%.`);
};

Colonel.cmdChainStatus = function(){
    const c = this.state.chain;
    this.respond(`Chain: ${c.hits||0} hits — timeout ${c.timeout||0}s.`);
};

Colonel.cmdWarStatus = function(){
    if (!Object.keys(this.state.war).length)
        return this.respond("No active war.");
    this.respond("War active. Monitoring conflict.");
};

Colonel.cmdExpanded = function(){
    const arr = this.ai.topTargets;
    if (!arr.length) return this.respond("No intel.");
    let t = "<b>Extended Target Analysis:</b><br>";
    for (const e of arr){
        t += `• ${e.name}: est ${e.estimatedTotal.toLocaleString()}, score ${e.score}<br>`;
    }
    this.respond(t);
};

Colonel.cmdPredict = function(){
    const pace = this.memory.chain.pace;
    if (pace.length < 5) return this.respond("Insufficient chain data for prediction.");
    const latest = pace[pace.length-1];
    const prev = pace[pace.length-5];
    const rate = (latest.hits - prev.hits) / ((latest.ts - prev.ts)/1000);
    const ratePerMin = Math.round(rate*60);
    this.respond(`Projected chain pace: ${ratePerMin} hits/min.`);
};

Colonel.cmdCompare = function(txt){
    const m = txt.match(/compare (.+) to (.+)/);
    if (!m) return this.respond("Could not parse comparison.");
    const a = m[1].trim();
    const b = m[2].trim();

    const e1 = this.findEnemy(a);
    const e2 = this.findEnemy(b);

    if (!e1 || !e2) return this.respond("Unable to find one or both enemies.");

    const diff = e1.estimatedTotal - e2.estimatedTotal;
    const word = diff > 0 ? "stronger" : "weaker";
    this.respond(`${e1.name} is ~${Math.abs(diff).toLocaleString()} stats ${word} than ${e2.name}.`);
};

Colonel.cmdTargetSpecific = function(name){
    const e = this.findEnemy(name);
    if (!e) return this.respond("No matching enemy.");
    this.respond(`${e.name}: Level ${e.level}, est ~${e.estimatedTotal.toLocaleString()}, status ${e.status}.`);
};

Colonel.findEnemy = function(name){
    const n = name.toLowerCase();
    return Object.values(this.state.enemyMembers).find(x => x.name.toLowerCase().includes(n));
};

/* ============================================================
   LOG
   ============================================================ */
Colonel.log = function(x){
    this.nexus.log("[COLONEL] "+x);
};

/* ============================================================
   REGISTER
   ============================================================ */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name:"Colonel", module:Colonel });

})();
