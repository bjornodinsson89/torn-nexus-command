// ============================================================================
//  WAR NEXUS — COLONEL v5.0
//  ANALYTICAL STRATEGIST + PREDICTIVE ENGINE (OFFLINE)
//  Author: Bjorn
// ============================================================================
//
//  Responsibilities:
//    • Ingest RAW_INTEL from Lieutenant
//    • Maintain long-term memory (enemies, chain, wars, member activity)
//    • Estimate enemy power & threat
//    • Analyze chain / war / faction state
//    • Predict chain bonus ETA / stall risk
//    • Predict war momentum
//    • Expose SITREP_UPDATE with predictions for Major UI
//    • Answer ASK_COLONEL with analytical, text reports
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

        // war history snapshots
        warHistory: [],

        // faction member activity
        memberActivity: {},

        // book-keeping
        lastUpdate: 0,
    }
};

/* ============================================================================
   INIT
   ============================================================================ */
Colonel.init = function(nexus){
    this.nexus = nexus;

    // Intel from Lieutenant
    nexus.events.on("RAW_INTEL", d => this.ingestIntel(d));

    // Questions from Major terminal
    nexus.events.on("ASK_COLONEL", payload => {
        const q = payload?.question || "";
        const answer = this.answer(q);
        this.nexus.events.emit("ASK_COLONEL_RESPONSE", { answer });
    });

    nexus.log("Colonel v5.0 (Analytical + Predictive) initialized");
};

/* ============================================================================
   INGEST INTEL
   ============================================================================ */
Colonel.ingestIntel = function(d){
    try {
        if (!d) return;

        // USER / STATS / BARS
        this.intel.user  = d.basic?.profile || {};
        this.intel.stats = d.stats || d.battlestats || {};
        this.intel.bars  = d.bars?.bars || {};

        // CHAIN
        this.intel.chain = d.chain || {};
        this.recordChainHistory();

        // FACTION
        this.intel.faction        = d.faction?.faction || {};
        this.intel.factionMembers = d.members?.members || [];
        this.recordMemberActivity();

        // ENEMIES (flattened enemy factions, if available)
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

        // ATTACKS
        this.intel.attacks = d.attacks?.attacks || [];
        this.learnFromAttacks();

        // WARS
        this.intel.wars = d.wars?.wars || [];
        this.recordWarHistory();

        this.memory.lastUpdate = Date.now();

        // PUSH SITREP (for Major UI)
        this.pushSitrep();

    } catch(e){
        this.nexus.log("Colonel ingestIntel ERROR: " + e.message);
    }
};

/* ============================================================================
   CHAIN HISTORY
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
   MEMBER ACTIVITY
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
            lastAction: m.last_action?.timestamp
        });

        if (this.memory.memberActivity[id].length > 200)
            this.memory.memberActivity[id].splice(0, 80);
    }
};

/* ============================================================================
   WAR HISTORY
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
            chain: w.chain
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
        if (!enemy?.id) continue;

        if (!this.memory.enemies[enemy.id]){
            this.memory.enemies[enemy.id] = {
                id: enemy.id,
                name: enemy.name,
                est: 0,
                confidence: 0.15,
                lastSeen: 0,
                dmgSamples: [],
                fights: 0
            };
        }

        const mem = this.memory.enemies[enemy.id];
        const dmg = atk.modifiers?.damage || 0;

        if (dmg > 0){
            mem.dmgSamples.push(dmg);
            if (mem.dmgSamples.length > 20)
                mem.dmgSamples.splice(0, 5);

            const avgDmg = mem.dmgSamples.reduce((a,b)=>a+b,0) / mem.dmgSamples.length;
            const prev = mem.est || avgDmg;
            mem.est = Math.round(prev * 0.6 + avgDmg * 0.4);
            mem.confidence = Math.min(1, mem.confidence + 0.04);
        }

        mem.lastSeen = Date.now();
        mem.fights++;
    }
};

/* ============================================================================
   BASELINE ESTIMATE (LEVEL-BASED)
   ============================================================================ */
Colonel.estimateByLevel = function(level){
    if (!level) return 1;
    return Math.round(Math.pow(level, 2.25) * 3500);
};

/* ============================================================================
   THREAT SCORE
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

        const vuln   = userTotal / est;
        const threat = est / userTotal;

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
   PREDICTION CORE
   ============================================================================ */
Colonel.buildPredictions = function(){
    return {
        chain: this.predictChain(),
        war:   this.predictWar(),
        enemies: this.predictEnemies(),
        members: this.predictMembers()
    };
};

/* ===== CHAIN PREDICTION ==================================================== */
Colonel.predictChain = function(){
    const c = this.intel.chain;
    if (!c || !c.current){
        return {
            active: false,
            summary: "Chain inactive.",
        };
    }

    const history = this.memory.chainHistory.slice(-10);
    if (history.length < 2){
        return {
            active: true,
            summary: "Chain active, insufficient history for pace.",
            stallSeconds: c.timeout,
            bonusEta: null
        };
    }

    // compute hits/min pace
    let first = history[0];
    let last  = history[history.length-1];
    const dtMs = last.ts - first.ts;
    const dhits = last.hits - first.hits;
    const pace = dtMs > 0 ? (dhits / (dtMs / 60000)) : 0; // hits per minute

    // predict next bonus threshold (simple: 10, 25, 50, 100, 150, 200, etc.)
    const milestones = [10,25,50,100,150,200,300,500,1000];
    const current = c.current || 0;
    let nextMilestone = null;
    for (const m of milestones){
        if (m > current){ nextMilestone = m; break; }
    }

    let etaMin = null;
    if (nextMilestone && pace > 0){
        const remainingHits = nextMilestone - current;
        etaMin = remainingHits / pace;
    }

    return {
        active: true,
        hits: current,
        max: c.max,
        timeout: c.timeout,
        paceHitsPerMin: pace,
        nextBonusAt: nextMilestone,
        etaMinutesToBonus: etaMin,
        stallSeconds: c.timeout,
        summary: this.buildChainPredictionSummary(current, pace, etaMin, nextMilestone, c.timeout)
    };
};

Colonel.buildChainPredictionSummary = function(hits, pace, etaMin, milestone, timeout){
    const parts = [];
    parts.push(`Chain ${hits} hits, timeout ${timeout}s.`);
    if (pace > 0){
        parts.push(`Current pace: ${pace.toFixed(2)} hits/min.`);
        if (milestone && etaMin != null){
            parts.push(`ETA to ${milestone} hits: ~${etaMin.toFixed(1)} min.`);
        }
    } else {
        parts.push("Pace data insufficient or stalled.");
    }
    if (timeout < 15){
        parts.push("⚠ High stall risk in under 15 seconds.");
    }
    return parts.join(" ");
};

/* ===== WAR PREDICTION ====================================================== */
Colonel.predictWar = function(){
    const wars = this.intel.wars;
    if (!wars || !wars.length){
        return {
            active: false,
            summary: "No active wars."
        };
    }

    const w = wars[0];
    const history = this.memory.warHistory.filter(x => x.warId === w.war_id).slice(-20);
    if (history.length < 2){
        return {
            active: true,
            summary: "War active, insufficient history for momentum.",
            respectPacePerHour: null,
            scorePacePerHour: null
        };
    }

    const first = history[0];
    const last  = history[history.length-1];

    const dtH = (last.ts - first.ts) / 3600000; // hours
    const dr  = last.respect - first.respect;
    const ds  = last.score - first.score;

    const respectPerHour = dtH > 0 ? dr / dtH : 0;
    const scorePerHour   = dtH > 0 ? ds / dtH : 0;

    return {
        active: true,
        respectPacePerHour: respectPerHour,
        scorePacePerHour: scorePerHour,
        summary: this.buildWarPredictionSummary(w, respectPerHour, scorePerHour)
    };
};

Colonel.buildWarPredictionSummary = function(w, respectPace, scorePace){
    const parts = [];
    parts.push(`War vs ${w.opponent_name || "Unknown"}. Respect: ${w.respect}, Score: ${w.score}.`);

    if (respectPace > 0){
        parts.push(`We are gaining ~${respectPace.toFixed(1)} respect/hour.`);
    } else if (respectPace < 0){
        parts.push(`We are losing ~${Math.abs(respectPace).toFixed(1)} respect/hour.`);
    } else {
        parts.push("Respect pace is flat.");
    }

    if (scorePace > 0){
        parts.push(`Score increasing by ~${scorePace.toFixed(1)} /hour.`);
    } else if (scorePace < 0){
        parts.push(`Score decreasing by ~${Math.abs(scorePace).toFixed(1)} /hour.`);
    }

    return parts.join(" ");
};

/* ===== ENEMY ACTIVITY PREDICTION =========================================== */
Colonel.predictEnemies = function(){
    const enemies = this.intel.enemies || [];
    const online = enemies.filter(e => e.status?.state === "Online").length;
    const total  = enemies.length;

    let activityLevel = "none";
    const ratio = total ? online/total : 0;
    if (ratio >= 0.6) activityLevel = "high";
    else if (ratio >= 0.3) activityLevel = "moderate";
    else if (ratio > 0) activityLevel = "low";

    return {
        total,
        online,
        activityLevel,
        summary: `Enemy presence: ${online}/${total} online (${activityLevel} activity).`
    };
};

/* ===== MEMBER CONTRIBUTION PREDICTION (ROUGH) ============================== */
Colonel.predictMembers = function(){
    const members = this.intel.factionMembers || [];
    if (!members.length){
        return {
            summary:"No faction data.",
            projectedActive:0
        };
    }

    const active = members.filter(m => m.status?.state === "Online").length;

    return {
        projectedActive: active,
        summary: `${active}/${members.length} members online now. Expect similar short-term participation.`
    };
};

/* ============================================================================
   SITREP EMISSION FOR MAJOR UI
   ============================================================================ */
Colonel.pushSitrep = function(){
    const predictions = this.buildPredictions();

    this.nexus.events.emit("SITREP_UPDATE", {
        user: this.intel.user,
        stats: this.intel.stats,
        bars: this.intel.bars,
        faction: this.intel.faction,
        factionMembers: this.intel.factionMembers,
        chain: this.intel.chain,
        wars: this.intel.wars,
        enemies: this.intel.enemies,
        predictions
    });
};

/* ============================================================================
   NATURAL LANGUAGE ANSWERING
   ============================================================================ */
Colonel.answer = function(query){
    if (!query || typeof query !== "string") return "Give me a question.";

    const q = query.toLowerCase();

    if (q.includes("bonus") || q.includes("eta")) return this.reportChainPrediction();
    if (q.includes("stall") || q.includes("break")) return this.reportChainStall();
    if (q.includes("momentum") || q.includes("pace")) return this.reportWarPrediction();
    if (q.includes("war")) return this.reportWar();
    if (q.includes("chain")) return this.reportChain();
    if (q.includes("faction")) return this.reportFaction();
    if (q.includes("enemy")) return this.reportEnemies();
    if (q.includes("target")) return this.reportBestTarget();
    if (q.includes("weak")) return this.reportWeakest();
    if (q.includes("strong") || q.includes("danger")) return this.reportStrongest();

    const m = q.match(/info (.+)/);
    if (m) return this.reportEnemyInfo(m[1]);

    return this.reportSummary();
};

/* ============================================================================
   REPORTS (incl. predictive flavour)
   ============================================================================ */
Colonel.reportSummary = function(){
    const chainPred = this.predictChain();
    const warPred   = this.predictWar();
    const enemyPred = this.predictEnemies();

    return [
        "=== SITUATION SUMMARY ===",
        "",
        chainPred.summary || "Chain: no data.",
        "",
        warPred.summary || "War: no data.",
        "",
        enemyPred.summary || "Enemies: no data.",
        "",
        "Ask: 'chain', 'war', 'enemy', 'target', 'bonus eta', 'stall risk', 'momentum', 'info NAME'"
    ].join("\n");
};

Colonel.reportChain = function(){
    const p = this.predictChain();
    return "=== CHAIN REPORT ===\n" + (p.summary || "No chain data.");
};

Colonel.reportChainPrediction = function(){
    const p = this.predictChain();
    return "=== CHAIN BONUS ETA ===\n" + (p.summary || "No prediction available.");
};

Colonel.reportChainStall = function(){
    const c = this.intel.chain;
    if (!c || !c.current) return "Chain inactive.";
    return `If no hits land, chain will break in approximately ${c.timeout}s.`;
};

Colonel.reportWar = function(){
    const w = this.intel.wars;
    if (!w || !w.length) return "No active wars.";
    const pred = this.predictWar();
    return "=== WAR REPORT ===\n" + (pred.summary || "War active, but no momentum data.");
};

Colonel.reportWarPrediction = function(){
    const pred = this.predictWar();
    return "=== WAR MOMENTUM ===\n" + (pred.summary || "No momentum model yet.");
};

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
Name:     ${f.name} [${f.id}]
Respect:  ${f.respect}
Members:  ${mem.length}
Online:   ${online}
Hospital: ${hosp}
Travel:   ${travel}`
    );
};

Colonel.reportEnemies = function(){
    const e = this.intel.enemies;
    if (!e.length) return "No enemies detected.";

    const online = e.filter(x=>x.status?.state === "Online").length;
    const pred   = this.predictEnemies();

    return (
`=== ENEMY OVERVIEW ===
Total enemies:  ${e.length}
Online:         ${online}
${pred.summary}`
    );
};

Colonel.reportBestTarget = function(){
    const t = this.evaluateTargets();
    if (!t.length) return "No viable targets.";

    const best = t[0];
    const ratio = (Number(this.intel.stats?.total)||1) / best.est;

    return (
`=== RECOMMENDED TARGET ===
Name:       ${best.name}
Level:      ${best.level}
Est. Stats: ${best.est.toLocaleString()}
Threat:     ${best.threat.label}
Online:     ${best.online ? "Yes" : "No"}
Ratio:      ${(ratio).toFixed(2)}x (you / them)`
    );
};

Colonel.reportWeakest = function(){
    const t = this.evaluateTargets();
    if (!t.length) return "No enemies.";

    const w = [...t].sort((a,b)=>a.est-b.est).slice(0,5);
    return "=== WEAK ENEMIES ===\n" +
        w.map(x=>`${x.name} (est ${x.est.toLocaleString()})`).join("\n");
};

Colonel.reportStrongest = function(){
    const t = this.evaluateTargets();
    if (!t.length) return "No enemies.";

    const s = [...t].sort((a,b)=>b.est-a.est).slice(0,5);
    return "=== MAJOR THREATS ===\n" +
        s.map(x=>`${x.name} (est ${x.est.toLocaleString()})`).join("\n");
};

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
Fights Logged:  ${mem?.fights || 0}
Confidence:     ${(mem?.confidence || 0).toFixed(2)}
Threat Level:   ${this.threatScore(e).label}`
    );
};

/* ============================================================================
   REGISTER
   ============================================================================ */
if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name:"Colonel",
    module:Colonel
});

})();
