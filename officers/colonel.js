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

(function(){
"use strict";

const Colonel = {
    nexus: null,
    lastTs: 0,
    state: {
        user: {},
        faction: {},
        factionMembers: [],
        enemies: [],
        chain: {},
        attacks: [],
        supplemental: {}
    },
    ai: {
        threat: 0,
        risk: 0,
        aggression: 0,
        instability: 0,
        prediction: { drop: 0, nextHit: 0 },
        notes: [],
        topTargets: []
    },
    init(nexus) {
        this.nexus = nexus;
        this.nexus.events.on("RAW_INTEL", d => this.ingest(d));
        this.nexus.events.on("ASK_COLONEL", q => this.answer(q));
    },
    ingest(data) {
        this.state.user = data.user || {};
        this.state.chain = data.chain || {};
        this.state.attacks = data.attacks || [];
        this.state.supplemental = data.supplemental || {};
        this.state.faction = data.faction || {};
        this.state.factionMembers = this.state.faction.members ? Object.values(this.state.faction.members) : [];
        this.state.enemies = this.extractEnemies(data.enemies || []);
        this.updateAI();
        this.dispatchSITREP();
    },
    extractEnemies(enemies) {
        if (!enemies || enemies.length === 0) return [];
        const first = enemies[0];
        if (!first.members) return [];
        return Object.values(first.members);
    },
    updateAI() {
        const now = Date.now();
        const c = this.state.chain;
        const user = this.state.user;
        const enemies = this.state.enemies;
        let threat = 0;
        let risk = 0;
        let aggr = 0;
        let inst = 0;
        const onlineCount = enemies.filter(e => this.isOnline(e)).length;
        threat += Math.min(1, onlineCount * 0.05);
        if (c.hits > 0) threat += 0.1;
        if (onlineCount > enemies.length * 0.4) threat += 0.1;
        if (c.timeout < 45) risk += 0.6;
        if (c.timeout < 80) risk += 0.3;
        if ((user.status || "").toLowerCase().includes("hospital")) risk += 0.2;
        if (this.lastTs > 0) {
            const dt = (now - this.lastTs) / 1000;
            if (dt > 0) {
                aggr = c.hits / Math.max(1, dt);
            }
        }
        inst = Math.abs(c.timeout - 60) / 100;
        const nextHit = onlineCount > 0 ? Math.round(onlineCount * threat * 2) : 0;
        const drop = c.timeout < 120 ? Math.round((120 - c.timeout) / 2) : 0;
        this.ai.threat = Math.min(1, threat);
        this.ai.risk = Math.min(1, risk);
        this.ai.aggression = Math.min(1, aggr);
        this.ai.instability = Math.min(1, inst);
        this.ai.prediction = { drop, nextHit };
        this.ai.topTargets = this.scoreTargets(enemies).slice(0, 15);
        this.ai.notes = this.generateNotes();
        this.lastTs = now;
    },
    isOnline(member) {
        const ts = member.last_action?.timestamp || 0;
        const now = Date.now();
        return (now - ts) < 600000;
    },
    scoreTargets(list) {
        const now = Date.now();
        const scored = [];
        for (const m of list) {
            let s = 0;
            s += (m.level || 1) * 1.5;
            const state = (m.status || "").toLowerCase();
            if (state.includes("hospital")) s -= 25;
            if (state.includes("travel")) s -= 10;
            if (state.includes("jail")) s -= 10;
            const ts = m.last_action?.timestamp || 0;
            if ((now - ts) < 300000) s += 10;
            s = Math.max(0, s);
            scored.push({
                id: m.id || m.ID || null,
                name: m.name || "",
                level: m.level || 0,
                status: m.status || "",
                last_action: m.last_action || {},
                score: s
            });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored;
    },
    generateNotes() {
        const notes = [];
        const a = this.ai;
        const c = this.state.chain;
        if (a.threat > 0.7) notes.push("High enemy activity.");
        if (a.risk > 0.7) notes.push("Chain risk elevated.");
        if (c.hits > 0) notes.push("Chain in progress.");
        if (a.prediction.nextHit > 0) notes.push("Enemy movement possible.");
        if (a.instability > 0.5) notes.push("Unstable chain conditions.");
        return notes;
    },
    dispatchSITREP() {
        const sitrep = {
            user: this.state.user,
            chain: this.state.chain,
            factionMembers: this.state.factionMembers,
            enemies: this.ai.topTargets,
            war: this.state.faction.wars || {},
            targets: { personal: [], shared: [], war: this.ai.topTargets },
            ai: this.ai
        };
        this.nexus.events.emit("SITREP_UPDATE", sitrep);
    },
    answer(payload) {
        const q = (payload?.question || "").toLowerCase();
        let r = "I need more information.";
        if (q.includes("threat")) r = "Threat level " + Math.round(this.ai.threat * 100) + "%.";
        else if (q.includes("risk")) r = "Chain collapse risk " + Math.round(this.ai.risk * 100) + "%.";
        else if (q.includes("next") && q.includes("hit")) r = "Next hit estimate: " + this.ai.prediction.nextHit + ".";
        else if (q.includes("chain")) r = "Chain: " + this.state.chain.hits + " hits, " + this.state.chain.timeout + "s remaining.";
        else if (q.includes("best") || q.includes("target")) {
            const t = this.ai.topTargets[0];
            r = t ? "Top target: " + t.name + " (score " + t.score + ")" : "No suitable targets.";
        }
        this.nexus.events.emit("COLONEL_RESPONSE", { response: r });
    }
};

/* BLOCK: SELF REGISTRATION */

window.__NEXUS_OFFICERS = window.__NEXUS_OFFICERS || [];
window.__NEXUS_OFFICERS.push({ name: "Colonel", module: Colonel });

})();
