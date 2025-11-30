// colonel.js — WAR NEXUS 3.0.3
// Adaptive AI Engine — Works even with limited V2 endpoints

(function(){
"use strict";

const Colonel = {
    nexus: null,
    state: {
        user: {},
        faction: {},
        enemies: {},
        enemyMembers: {},
        chain: {},
        attacks: [],
    },

    memory: {
        enemies: {}, // id → memory block
        chain: { pace: [] },
    },

    lastSummary: "",
};

/* ============================================================
   INIT
   ============================================================ */
Colonel.init = function(nexus){
    this.nexus = nexus;

    nexus.events.on("RAW_INTEL", intel => this.ingestIntel(intel));
    nexus.events.on("ASK_COLONEL", txt => this.answer(txt));
};

/* ============================================================
   SAFE HELPERS
   ============================================================ */
Colonel.safeObj = x => (x && typeof x === "object" ? x : {});
Colonel.safeNum = x => (typeof x === "number" && isFinite(x) ? x : 0);

/* ============================================================
   INGEST INTEL
   ============================================================ */
Colonel.ingestIntel = function(d){
    if (!d) return;

    /* USER */
    this.state.user = {
        id: d.basic?.profile?.id,
        name: d.basic?.profile?.name,
        level: d.basic?.profile?.level,
        stats: d.stats?.battlestats ?? d.stats ?? {},
        battlestats: d.battlestats ?? {},
        total: this.safeNum(d.stats?.battlestats?.total || d.battlestats?.total),
        bars: d.bars?.bars || {},
    };

    /* FACTION */
    this.state.faction = d.faction?.faction || {};

    /* ENEMY FACTIONS */
    this.state.wars = this.safeObj(d.wars);

    /* CHAIN */
    this.state.chain = (d.chain && typeof d.chain === "object")
        ? d.chain
        : { current: 0, timeout: 0, modifier: 1 };

    /* ATTACKS */
    this.state.attacks = d.attacks?.attacks || [];

    /* FACTION MEMBERS */
    let map = {};
    if (d.members?.members){
        for (const m of d.members.members){
            map[m.id] = {
                id: m.id,
                name: m.name,
                level: m.level,
                faction_id: m.faction_id,
                status: this.normalizeStatus(m.status?.state),
                online: this.normalizeStatus(m.status?.state) === "online",
                hospital: this.normalizeStatus(m.status?.state) === "hospital",
                traveling: this.normalizeStatus(m.status?.state) === "traveling",
            };
        }
    }
    this.state.enemyMembers = map;

    /* LEARNING */
    this.learnAll();

    /* RECOMPUTE AI VIEW */
    this.recompute();

    /* BROADCAST SITREP */
    this.nexus.events.emit("SITREP_UPDATE", {
        faction: this.state.faction,
        chain: this.state.chain,
        enemies: this.memory.enemies,
        summary: this.lastSummary,
    });
};

/* ============================================================
   STATUS NORMALIZATION
   ============================================================ */
Colonel.normalizeStatus = function(s){
    if (!s) return "unknown";
    return String(s).trim().toLowerCase();
};

/* ============================================================
   ENEMY MEMORY BLOCK
   ============================================================ */
Colonel.getMemory = function(id){
    if (!this.memory.enemies[id]){
        this.memory.enemies[id] = {
            id,
            name: "",
            estTotal: 1000,
            confidence: 0,
            history: [],
        };
    }
    return this.memory.enemies[id];
};

/* ============================================================
   LEARNING ENGINE
   ============================================================ */
Colonel.learnAll = function(){
    for (const atk of this.state.attacks){
        this.learnFromAttack(atk);
    }
};

Colonel.learnFromAttack = function(atk){
    if (!atk?.attacker || !atk?.defender) return;

    const isUserAttacker = atk.attacker?.id === this.state.user.id;
    const isUserDefender = atk.defender?.id === this.state.user.id;

    if (!isUserAttacker && !isUserDefender) return;
    if (!atk.modifiers) return;

    const ff = this.safeNum(atk.modifiers.fair_fight);
    if (!ff || ff <= 0) return;

    const userTotal = this.safeNum(this.state.user.total);
    if (userTotal <= 0) return;

    // FF inversion – clamped for safety
    // total_enemy = total_user / (1 - FF)^(1/0.366)
    const F = Math.min(0.90, Math.max(0.05, 1 - ff)); // safer domain
    let est = userTotal / Math.pow(F, 1/0.366);

    if (!isFinite(est) || est <= 0) return;
    est = Math.max(500, Math.min(est, 5e9)); // clamp

    const enemyId = isUserAttacker ? atk.defender.id : atk.attacker.id;
    const mem = this.getMemory(enemyId);

    mem.name = isUserAttacker ? atk.defender.name : atk.attacker.name;

    // EMA smoothing based on confidence
    mem.estTotal = (mem.estTotal * mem.confidence + est) / (mem.confidence + 1);
    mem.confidence = Math.min(1.0, mem.confidence + 0.05);

    // Push history
    mem.history.push({ ts: Date.now(), ff, est });
    if (mem.history.length > 50) mem.history.shift();
};

/* ============================================================
   AI RECOMPUTE
   ============================================================ */
Colonel.recompute = function(){
    const list = [];

    for (const id in this.state.enemyMembers){
        const m = this.state.enemyMembers[id];
        const mem = this.getMemory(id);

        if (!mem || !m) continue;

        const userTotal = this.state.user.total || 1;
        const ratio = mem.estTotal > 0 ? (userTotal / mem.estTotal) : 0;
        const vuln = Math.max(0, Math.min(1, ratio));

        let score = 0;
        if (m.online) score += 30;
        if (m.hospital) score -= 100;
        if (m.traveling) score -= 100;

        score += vuln * 50;
        score += mem.confidence * 10;

        list.push({
            id: m.id,
            name: m.name,
            level: m.level,
            estimatedTotal: Math.round(mem.estTotal),
            online: m.online,
            hospital: m.hospital,
            traveling: m.traveling,
            score,
        });
    }

    list.sort((a,b) => b.score - a.score);
    this.state.targets = list;

    // Summary
    this.lastSummary = this.generateSummary(list);
};

/* ============================================================
   SUMMARY
   ============================================================ */
Colonel.generateSummary = function(list){
    if (!list.length) return "No targets available.";

    const top = list.slice(0, 3)
        .map(t => `${t.name} (${t.level}) — est ${t.estimatedTotal.toLocaleString()}`)
        .join("\n");

    return `Top Targets:\n${top}`;
};

/* ============================================================
   ANSWER NLP
   ============================================================ */
Colonel.answer = function(txt){
    txt = (txt || "").toLowerCase();

    let reply = "";

    if (txt.includes("weak")){
        reply = this.replyWeakest();
    } else if (txt.includes("strong")){
        reply = this.replyStrongest();
    } else if (txt.includes("target")){
        reply = this.replyTop();
    } else {
        reply = this.lastSummary;
    }

    this.nexus.events.emit("ASK_COLONEL_RESPONSE", reply);
};

Colonel.replyTop = function(){
    const t = this.state.targets?.[0];
    if (!t) return "No targets.";
    return `Top target: ${t.name} (lvl ${t.level}) est ${t.estimatedTotal.toLocaleString()}`;
};

Colonel.replyStrongest = function(){
    const arr = [...this.state.targets].sort((a,b)=>b.estimatedTotal-a.estimatedTotal);
    const t = arr[0];
    if (!t) return "No data.";
    return `Strongest visible enemy: ${t.name}, est ${t.estimatedTotal.toLocaleString()}`;
};

Colonel.replyWeakest = function(){
    const arr = [...this.state.targets].sort((a,b)=>a.estimatedTotal-b.estimatedTotal);
    const t = arr[0];
    if (!t) return "No data.";
    return `Weakest visible enemy: ${t.name}, est ${t.estimatedTotal.toLocaleString()}`;
};

/* ============================================================
   REGISTER
   ============================================================ */

if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name:"Colonel",
    module:Colonel
});

})();
