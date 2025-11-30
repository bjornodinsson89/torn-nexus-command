(function(){
"use strict";

const Colonel = {
    nexus: null,
    mode: "HYBRID",
    nlMode: true,

    memory: {
        enemy: {},
        chain: { pace: [] },
        weights: {
            hybrid:  { online: 0.6, vuln: 0.4, threat: 0.2 },
            aggro:   { online: 0.8, vuln: 0.2, threat: 0.1 },
            cautious:{ online: 0.3, vuln: 0.7, threat: 0.4 }
        },
        lastSync: 0
    },

    state: {
        user: {},
        faction: {},
        factionMembers: {},
        chain: {},
        war: {},
        enemyFactions: [],
        enemyMembers: {},
        attacks: []
    },

    ai: {
        topTargets: [],
        summary: "",
        mode: "HYBRID",
        threat: "unknown",
        instability: 0,
        prediction:{}
    }
};

/* ============================================================
   INIT / WIRING
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

        // ✅ FIX: guard against missing faction on light intel
        const factionObj = this.safeObj(d.faction);

        this.state.user = this.safeObj(d.user);
        this.state.faction = factionObj;
        this.state.factionMembers = this.safeObj(factionObj.members);

        this.state.chain = this.safeObj(d.chain);
        this.state.war   = this.safeObj(d.war);

        const enemyFactions = this.safeArray(d.enemyFaction);
        const enemyFlat     = this.safeObj(d.enemyMembersFlat);

        this.state.enemyFactions = enemyFactions;

        const map = {};
        for (const id in enemyFlat) map[id] = enemyFlat[id];
        this.state.enemyMembers = map;

        this.state.attacks = this.safeArray(d.attacks);

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
    const attacks = this.safeArray(d.attacks);
    const enemyFlat = this.safeObj(d.enemyMembersFlat);

    for (const atk of attacks){
        const targetId = atk.defender?.id;
        if (!targetId) continue;

        if (!this.memory.enemy[targetId]){
            this.memory.enemy[targetId] = {
                id: targetId,
                history: [],
                totalEstimate: null,
                lastKnown: null,
                lastOutcome: null,
                dexRatio: null,
                confidence: 0.25,
                lastUpdated: now,
                attackHistory: []
            };
        }
        this.memory.enemy[targetId].lastUpdated = now;
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
   FIGHT LEARNING
   ============================================================ */
Colonel.learnFromFight = function(atk){
    try {
        if (!atk || !atk.defender || !atk.attacker) return;
        const defId = atk.defender.id;
        if (!defId) return;

        const mem = this.memory.enemy[defId] || (this.memory.enemy[defId] = {
            id: defId,
            history: [],
            totalEstimate: null,
            lastKnown: null,
            lastOutcome: null,
            dexRatio: null,
            confidence: 0.25,
            lastUpdated: Date.now(),
            attackHistory: []
        });

        mem.attackHistory.push({
            ts: atk.ended || atk.started || Date.now(),
            result: atk.result || "",
            respect_gain: atk.respect_gain || 0,
            chain: atk.chain || 0
        });

        if (mem.attackHistory.length > 50)
            mem.attackHistory.splice(0, 25);

        const dmg = atk.modifiers?.damage || 0;
        if (dmg > 0){
            mem.totalEstimate = (mem.totalEstimate || dmg) * 0.7 + dmg * 0.3;
            mem.confidence = Math.min(1, mem.confidence + 0.05);
        }

    } catch(e){
        this.log("learnFromFight error: "+e);
    }
};

/* ============================================================
   AI COMPUTATION
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
        const threat = (estTotal || 1) / Math.max(userTotal,1);

        score += online * (weights.online || 0.5);
        score += vuln   * (weights.vuln   || 0.4);
        score -= threat * (weights.threat || 0.2);

        return {
            id:e.id,
            name:e.name,
            level:e.level,
            online:e.online,
            estTotal,
            score,
            mem
        };
    });

    scored.sort((a,b)=>b.score - a.score);

    this.ai.topTargets = scored;

    const threat = this.computeThreatSummary(scored);
    const risk = threat.risk || 0;

    const summary = [];
    if (!enemies.length) summary.push("No enemies detected.");
    if (enemies.length && scored[0]){
        summary.push(`Primary: ${scored[0].name} (est ${ (scored[0].estTotal||0).toLocaleString() } stats).`);
    }
    if (this.state.chain.hits > 0)
        summary.push(`Chain at ${this.state.chain.hits} hits, timeout ${this.state.chain.timeout}s.`);
    if (risk > 0.7) summary.push("High instability in current war.");

    if (!summary.length) summary.push("Situation stable.");

    this.ai.summary = summary.join(" ");
    this.ai.threat = threat.label || "unknown";
    this.ai.instability = risk;
    this.ai.prediction = {};
};

/* ============================================================
   THREAT SUMMARY
   ============================================================ */
Colonel.computeThreatSummary = function(scored){
    if (!scored.length) return { label:"none", risk:0 };

    let avg = 0;
    for (const t of scored){
        avg += (t.mem?.totalEstimate || t.estTotal || 0);
    }
    avg /= scored.length || 1;

    const userTotal = this.state.user.stats?.total || 1;
    const ratio = avg / Math.max(userTotal,1);

    if (ratio < 0.5) return { label:"favorable", risk:0.2 };
    if (ratio < 1.2) return { label:"balanced", risk:0.5 };
    if (ratio < 2.5) return { label:"dangerous", risk:0.7 };
    return { label:"overwhelming", risk:0.9 };
};

/* ============================================================
   STAT BASELINE ESTIMATION
   ============================================================ */
Colonel.estimateBaseline = function(e){
    const level = e.level || 1;
    return Math.pow(level, 2.2) * 5000;
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
   ANSWER CHAT QUERIES
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
    arr.sort((a,b)=> (b.stats?.total||0) - (a.stats?.total||0));
    const top = arr[0];
    this.respond(`Strongest enemy: ${top.name}, level ${top.level}.`);
};

Colonel.cmdThreat = function(){
    this.respond(`Current threat: ${this.ai.threat} (instability ${(this.ai.instability*100).toFixed(0)}%).`);
};

Colonel.cmdChainStatus = function(){
    const c = this.state.chain || {};
    this.respond(`Chain: ${c.hits||0} hits, timeout ${c.timeout||0}s, modifier x${c.modifier||1}.`);
};

Colonel.cmdWarStatus = function(){
    const w = this.state.war || {};
    const factions = (w.factions||[]).map(f=>f.name).join(" vs ");
    this.respond(`War status: ${factions || "No active war."}`);
};

Colonel.cmdExpanded = function(){
    this.respond(this.ai.summary || "No intel yet.");
};

Colonel.cmdListTargets = function(){
    const arr = this.ai.topTargets.slice(0,5);
    if (!arr.length) return this.respond("No viable targets.");
    const text = arr.map(t=>`${t.name} (score ${t.score.toFixed(2)})`).join("<br>");
    this.respond(text);
};

Colonel.cmdListEnemies = function(){
    const arr = Object.values(this.state.enemyMembers);
    if (!arr.length) return this.respond("No enemy data available.");
    const text = arr.map(t=>`${t.name} (lvl ${t.level})`).join(", ");
    this.respond(text);
};

Colonel.cmdPredict = function(){
    this.respond("Prediction system not implemented yet, but instability is "+(this.ai.instability*100).toFixed(0)+"%.");
};

Colonel.cmdCompare = function(L){
    this.respond("Comparison mode is experimental. Use explicit stats for now.");
};

Colonel.cmdTargetSpecific = function(nameFrag){
    const L = nameFrag.toLowerCase().trim();
    const arr = Object.values(this.state.enemyMembers);
    const match = arr.find(e=>e.name.toLowerCase().includes(L));
    if (!match) return this.respond("No matching enemy found.");
    const mem = this.memory.enemy[match.id];
    const estimate = mem?.totalEstimate || this.estimateBaseline(match);
    this.respond(`Target ${match.name}: estimated ${estimate.toLocaleString()} total stats.`);
};

/* ============================================================
   LOG
   ============================================================ */
Colonel.log = function(x){
    this.nexus.log("[COLONEL] "+x);
};

/* ============================================================
   EXPORT
   ============================================================ */
window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name:"Colonel", module:Colonel });

})();
