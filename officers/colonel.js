// ============================================================================
//  WAR NEXUS — COLONEL v4.0
//  ANALYTICAL STRATEGIST — FULL TACTICAL INTELLIGENCE ENGINE
// ============================================================================
//
//  THIS MODULE DOES:
//   • Ingest ALL intel from Lieutenant
//   • Build persistent enemy models
//   • Estimate enemy stats using multi-source heuristics
//   • Analyze chain, war, faction, enemy behavior
//   • Provide analytical NL responses in the Major terminal
//   • Generate tactical reports, summaries, predictions
//   • 100% OFFLINE — NO EXTERNAL AI CALLS
//
// ============================================================================

(function(){
"use strict";

const Colonel = {

    nexus: null,

    // === Raw intel fed by Lieutenant ===
    intel: {
        user: {},
        stats: {},
        bars: {},
        chain: {},
        faction: {},
        factionMembers: [],
        enemies: [],
        attacks: [],
        wars: [],
    },

    // === Persistent tactical memory ===
    memory: {

        // enemyId -> model
        enemies: {},

        // chain history over time
        chainHistory: [],

        // war history
        warHistory: [],

        // faction activity logs
        memberActivity: {},

        // general timestamping
        lastUpdate: 0,
    },

    // === Internal flags ===
    ready: false,
};

/* ============================================================================
   INIT
   ============================================================================ */
Colonel.init = function(nexus){
    this.nexus = nexus;

    // Event: new intel arrives
    nexus.events.on("RAW_INTEL", d => this.ingestIntel(d));

    // Event: Major terminal asks a question
    nexus.events.on("ASK_COLONEL", payload => {
        const q = payload?.question || "";
        const response = this.answer(q);
        this.nexus.events.emit("ASK_COLONEL_RESPONSE", { answer: response });
    });

    nexus.log("Colonel v4.0 (Analytical Strategist) initialized");
};

/* ============================================================================
   INTEL INGESTION
   ============================================================================ */
Colonel.ingestIntel = function(d){
    try {
        if (!d) return;

        // === USER PROFILE ===
        this.intel.user = d.basic?.profile || {};
        this.intel.stats = d.stats || d.battlestats || {};
        this.intel.bars  = d.bars?.bars || {};

        // === CHAIN ===
        this.intel.chain = d.chain || {};

        // Record chain history
        this.recordChainHistory();

        // === FACTION (SELF) ===
        this.intel.faction = d.faction?.faction || {};
        this.intel.factionMembers = d.members?.members || [];

        // Track member activity
        this.recordMemberActivity();

        // === ENEMY FACTION MEMBERS ===
        this.intel.enemies = [];
        if (d.faction_basic?.basic?.enemy_factions){
            for (const f of d.faction_basic.basic.enemy_factions){
                if (f.members){
                    for (const m of f.members){
                        this.intel.enemies.push(m);
                    }
                }
            }
        }

        // === ATTACK LOGS ===
        this.intel.attacks = d.attacks?.attacks || [];

        // Update enemy models using attacks
        this.learnFromAttacks();

        // === WARS ===
        this.intel.wars = d.wars?.wars || [];
        this.recordWarHistory();

        this.memory.lastUpdate = Date.now();

    } catch(e){
        this.nexus.log("Colonel ingestIntel ERROR: " + e.message);
    }
};

/* ============================================================================
   CHAIN HISTORY TRACKING
   ============================================================================ */
Colonel.recordChainHistory = function(){
    const c = this.intel.chain;
    if (!c || !c.current) return;

    this.memory.chainHistory.push({
        ts: Date.now(),
        hits: c.current,
        timeout: c.timeout,
        modifier: c.modifier,
    });

    if (this.memory.chainHistory.length > 1000)
        this.memory.chainHistory.splice(0, 300);
};

/* ============================================================================
   FACTION MEMBER ACTIVITY TRACKING
   ============================================================================ */
Colonel.recordMemberActivity = function(){
    const ts = Date.now();
    const members = this.intel.factionMembers;

    for (const m of members){
        const id = m.id;
        if (!this.memory.memberActivity[id]){
            this.memory.memberActivity[id] = [];
        }
        this.memory.memberActivity[id].push({
            ts,
            status: m.status?.state,
            lastAction: m.last_action?.timestamp,
        });

        // prune old logs
        if (this.memory.memberActivity[id].length > 200)
            this.memory.memberActivity[id].splice(0, 80);
    }
};

/* ============================================================================
   WAR HISTORY TRACKING
   ============================================================================ */
Colonel.recordWarHistory = function(){
    const wars = this.intel.wars;
    if (!wars || !wars.length) return;

    const ts = Date.now();

    for (const w of wars){
        this.memory.warHistory.push({
            ts,
            warId: w.war_id,
            respect: w.respect,
            score: w.score,
            chain: w.chain,
        });
    }

    if (this.memory.warHistory.length > 2000)
        this.memory.warHistory.splice(0, 800);
};

/* ============================================================================
   ATTACK-BASED ENEMY LEARNING
   ============================================================================ */
Colonel.learnFromAttacks = function(){

    const userId = this.intel.user?.id;
    if (!userId) return;

    for (const atk of this.intel.attacks){

        const a = atk.attacker;
        const d = atk.defender;

        if (!a || !d) continue;

        const isUserAtk = (a.id === userId);
        const isUserDef = (d.id === userId);

        if (!isUserAtk && !isUserDef) continue;

        const enemy = isUserAtk ? d : a;

        if (!this.memory.enemies[enemy.id]){
            this.memory.enemies[enemy.id] = {
                id: enemy.id,
                name: enemy.name,
                est: 0,
                confidence: 0.15,
                lastSeen: 0,
                dmgGiven: 0,
                dmgTaken: 0,
                fights: 0,
                results: [],
            };
        }

        const mem = this.memory.enemies[enemy.id];

        // Learn from damage
        const dmg = atk.modifiers?.damage || 0;

        if (dmg > 0){
            const prev = mem.est || 1;
            mem.est = Math.round(prev * 0.6 + dmg * 0.4);
            mem.confidence = Math.min(1, mem.confidence + 0.04);
        }

        // Fight record
        mem.lastSeen = Date.now();
        mem.fights++;

        if (atk.result) mem.results.push(atk.result);

        // prune results
        if (mem.results.length > 50)
            mem.results.splice(0, 20);
    }
};

/* ============================================================================
   BASELINE STAT ESTIMATION
   ============================================================================ */
Colonel.estimateByLevel = function(level){
    if (!level) return 1;
    return Math.round(Math.pow(level, 2.25) * 3500);
};

/* ============================================================================
   THREAT ESTIMATION ENGINE
   ============================================================================ */
Colonel.threatScore = function(enemy){
    const mem = this.memory.enemies[enemy.id];
    const est = mem?.est || this.estimateByLevel(enemy.level);
    const userTotal = Number(this.intel.stats?.total) || 1;

    const ratio = est / userTotal;

    if (ratio < 0.3) return {score:1, label:"Trivial"};
    if (ratio < 0.6) return {score:2, label:"Favorable"};
    if (ratio < 1.0) return {score:3, label:"Balanced"};
    if (ratio < 1.6) return {score:4, label:"Dangerous"};
    return {score:5, label:"Severe"};
};

/* ============================================================================
   TARGET EVALUATION ENGINE
   ============================================================================ */
Colonel.evaluateTargets = function(){

    const out = [];
    const userTotal = Number(this.intel.stats?.total) || 1;

    for (const e of this.intel.enemies){

        const mem = this.memory.enemies[e.id];
        const est = mem?.est || this.estimateByLevel(e.level);

        const online = e.status?.state === "Online";

        const vuln = userTotal / est;
        const threat = est / userTotal;

        // Analytical weighting
        let score = 0;
        score += vuln * 25;
        score += (mem?.confidence || 0.1) * 10;
        score -= threat * 15;
        if (online) score += 8;

        out.push({
            id: e.id,
            name: e.name,
            level: e.level,
            est,
            online,
            score,
            threat: this.threatScore(e)
        });
    }

    out.sort((a,b)=>b.score - a.score);
    return out;
};

/* ============================================================================
   NATURAL LANGUAGE RESPONSE ENGINE (Analytical Mode)
   ============================================================================ */
Colonel.answer = function(query){
    if (!query) return "I need a question.";

    const Q = query.toLowerCase();

    // === KEYWORD ROUTING ===
    if (Q.includes("chain")) return this.reportChain();
    if (Q.includes("war")) return this.reportWar();
    if (Q.includes("faction")) return this.reportFaction();
    if (Q.includes("enemy")) return this.reportEnemies();
    if (Q.includes("target")) return this.reportBestTarget();
    if (Q.includes("weak")) return this.reportWeakest();
    if (Q.includes("strong") || Q.includes("danger"))
        return this.reportStrongest();

    // name lookup
    const m = Q.match(/info (.+)/);
    if (m) return this.reportEnemyInfo(m[1]);

    // fallback
    return this.reportSummary();
};
    /* ============================================================================
   SUMMARY / DEFAULT REPORT
   Analytical overview of: chain, war, faction, enemies, top targets
   ============================================================================ */
Colonel.reportSummary = function(){
    const chain = this.reportChain(true);
    const war   = this.reportWar(true);
    const tgt   = this.reportBestTarget(true);

    return (
        "=== SITUATION SUMMARY ===\n\n" +
        chain + "\n\n" +
        war   + "\n\n" +
        tgt   + "\n\n" +
        "Ask: 'chain', 'war', 'enemy', 'target', 'faction', 'info NAME', 'weak', 'strong'\n" +
        "For detailed reports."
    );
};

/* ============================================================================
   CHAIN REPORT
   ============================================================================ */
Colonel.reportChain = function(short=false){
    const c = this.intel.chain;
    if (!c || !c.current){
        return short ? "Chain inactive." : "Chain is currently inactive.";
    }

    const pace = this.memory.chainHistory.slice(-10).map(x=>x.hits);
    const paceAvg = pace.length ? (pace.reduce((a,b)=>a+b,0) / pace.length).toFixed(1) : "n/a";

    if (short){
        return `Chain ${c.current}/${c.max} — timeout ${c.timeout}s — pace ${paceAvg}`;
    }

    return (
`=== CHAIN STATUS ===
Hits:         ${c.current}/${c.max}
Timeout:      ${c.timeout}s
Modifier:     x${c.modifier || 1}
Recent Pace:  ${paceAvg} hits/sample

Recommendation:
${this.chainAdvice(c, paceAvg)}
`
    );
};

Colonel.chainAdvice = function(c, pace){
    if (c.timeout < 10){
        return "⚠️ Timeout critical — hit immediately or chain will break.";
    }
    if (pace < 1){
        return "Chain is slowing. Increase hit frequency.";
    }
    if (c.current > c.max * 0.8){
        return "Approaching max chain. Prepare for bonus windows.";
    }
    return "Chain stable. Maintain current pace.";
};

/* ============================================================================
   WAR REPORT
   ============================================================================ */
Colonel.reportWar = function(short=false){
    const wars = this.intel.wars;
    if (!wars || !wars.length){
        return short ? "No active wars." : "There are no active wars at this time.";
    }

    const w = wars[0]; // assume 1 active war (Torn usually allows 1)
    const score = w.score || 0;
    const respect = w.respect || 0;

    const history = this.memory.warHistory.slice(-20);
    const recentRespect = history.map(x=>x.respect);
    const respectPace = recentRespect.length > 1
        ? (recentRespect[recentRespect.length-1] - recentRespect[0])
        : 0;

    if (short){
        return `War active — score ${score}, respect ${respect}, pace ${respectPace}`;
    }

    return (
`=== WAR STATUS ===
Opponent:     ${w.opponent_name || "Unknown"}
Score:        ${score}
Respect:      ${respect}
Pace:         ${respectPace} respect / recent interval

Recommendation:
${this.warAdvice(w, respectPace)}
`
    );
};

Colonel.warAdvice = function(w, pace){
    if (pace < 0) return "⚠️ We are losing respect — increase pressure.";
    if (pace > 0 && pace < 10) return "Small advantage — maintain consistent hits.";
    if (pace >= 10) return "Strong momentum — capitalize with coordinated bursts.";
    return "Gather intel. Enemy activity unclear.";
};

/* ============================================================================
   FACTION REPORT
   ============================================================================ */
Colonel.reportFaction = function(){
    const f = this.intel.faction;
    const mem = this.intel.factionMembers;

    if (!f?.id){
        return "Not in a faction or no faction data available.";
    }

    const online = mem.filter(m=>m.status?.state === "Online").length;
    const hosp   = mem.filter(m=>m.status?.state === "Hospitalized").length;
    const travel = mem.filter(m=>m.status?.state === "Traveling").length;

    return (
`=== FACTION STATUS ===
Name:         ${f.name} [${f.id}]
Respect:      ${f.respect}
Members:      ${mem.length}
Online:       ${online}
Hospital:     ${hosp}
Travel:       ${travel}

Observation:
${this.factionAdvice(mem)}
`
    );
};

Colonel.factionAdvice = function(mem){
    const online = mem.filter(m=>m.status?.state === "Online").length;

    if (online >= mem.length * 0.6)
        return "High readiness — good time for organized hits.";

    if (online <= mem.length * 0.2)
        return "Low readiness — avoid provoking counter-attacks.";

    return "Moderate readiness — coordinate chain timing.";
};

/* ============================================================================
   ENEMY SUMMARY
   ============================================================================ */
Colonel.reportEnemies = function(){
    const e = this.intel.enemies;
    if (!e.length){
        return "No enemy operatives detected.";
    }

    const online = e.filter(x=>x.status?.state === "Online").length;

    return (
`=== ENEMY OVERVIEW ===
Total enemies detected:  ${e.length}
Online:                 ${online}

Threat Levels:
${this.enemyThreatBreakdown()}
`
    );
};

Colonel.enemyThreatBreakdown = function(){
    const e = this.intel.enemies.map(x=>{
        const t = this.threatScore(x);
        return {name:x.name, level:x.level, label:t.label, score:t.score};
    });

    const grouped = {
        Trivial: [],
        Favorable: [],
        Balanced: [],
        Dangerous: [],
        Severe: [],
    };

    for (const x of e){
        grouped[x.label].push(`${x.name} (lvl ${x.level})`);
    }

    return Object.entries(grouped)
        .map(([k,v]) => ` ${k}: ${v.length ? v.join(", ") : "(none)"}`)
        .join("\n");
};

/* ============================================================================
   BEST TARGET RECOMMENDATION
   ============================================================================ */
Colonel.reportBestTarget = function(short=false){
    const t = this.evaluateTargets();
    if (!t.length){
        return short ? "No targets." : "No viable targets found.";
    }

    const best = t[0];

    if (short){
        return `Best target: ${best.name} (${best.est.toLocaleString()} est)`;
    }

    return (
`=== RECOMMENDED TARGET ===
Name:         ${best.name}
Level:        ${best.level}
Est. Stats:   ${best.est.toLocaleString()}
Status:       ${best.online ? "Online" : "Offline"}
Threat:       ${best.threat.label}

Reasoning:
${this.explainTarget(best)}
`
    );
};

Colonel.explainTarget = function(t){
    const reasons = [];

    if (t.online) reasons.push("• Enemy is online → immediate hit viability.");
    else reasons.push("• Enemy offline → lower risk of retaliation.");

    if (t.threat.score <= 2) reasons.push("• Low threat level → favorable matchup.");
    if (t.threat.score == 3) reasons.push("• Balanced threat → skill-based outcome.");
    if (t.threat.score >= 4) reasons.push("• High threat → dangerous, use caution.");

    const ratio = (Number(this.intel.stats?.total)||1) / t.est;
    reasons.push(`• Stat ratio: ${ratio.toFixed(2)}x`);

    return reasons.join("\n");
};

/* ============================================================================
   WEAKEST TARGETS
   ============================================================================ */
Colonel.reportWeakest = function(){
    const t = this.evaluateTargets();
    if (!t.length) return "No enemies.";

    const w = [...t].sort((a,b)=>a.est - b.est).slice(0,5);

    return (
`=== WEAK ENEMIES ===
${w.map(x=>`${x.name} (est ${x.est.toLocaleString()})`).join("\n")}
`
    );
};

/* ============================================================================
   STRONGEST TARGETS
   ============================================================================ */
Colonel.reportStrongest = function(){
    const t = this.evaluateTargets();
    if (!t.length) return "No enemies.";

    const s = [...t].sort((a,b)=>b.est - a.est).slice(0,5);

    return (
`=== MAJOR THREATS ===
${s.map(x=>`${x.name} (est ${x.est.toLocaleString()})`).join("\n")}
`
    );
};

/* ============================================================================
   SPECIFIC ENEMY INFO
   ============================================================================ */
Colonel.reportEnemyInfo = function(nameFrag){
    const f = nameFrag.toLowerCase();
    const matches = this.intel.enemies.filter(x =>
        x.name.toLowerCase().includes(f)
    );

    if (!matches.length)
        return `No enemy matches '${nameFrag}'.`;

    const e = matches[0];
    const mem = this.memory.enemies[e.id];
    const est = mem?.est || this.estimateByLevel(e.level);
    const last = mem?.lastSeen
        ? new Date(mem.lastSeen).toLocaleString()
        : "unknown";

    return (
`=== ENEMY INTEL: ${e.name} ===
Level:          ${e.level}
Status:         ${e.status?.state}
Estimated Stats:${est.toLocaleString()}
Last Seen:      ${last}
Fights Recorded:${mem?.fights || 0}
Confidence:     ${(mem?.confidence || 0).toFixed(2)}

Threat Level:   ${this.threatScore(e).label}
`
    );
};

/* ============================================================================
   EXPORT & REGISTER
   ============================================================================ */
if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name: "Colonel",
    module: Colonel
});

})();
