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

WARDBG("Colonel file loaded.");

const Colonel = {

    general: null,

    activityFriendly: Array(30).fill(0),
    activityEnemy: Array(30).fill(0),
    lastActivityUpdate: 0,
    sharedTargets: [],

    init(general){
        this.general = general;
        WARDBG("Colonel online (MAX-AI)");

        general.signals.listen("RAW_INTEL", intel => {
            this.process(intel);
        });

        general.signals.listen("UPDATE_TARGETS", targets => {
            this.sharedTargets = Array.isArray(targets) ? targets : [];
        });
    },

    process(intel){
        const user = intel.user;
        const friendlyMembers = intel.friendlyMembers || [];
        const enemyMembers = intel.enemyMembers || [];
        const chain = intel.chain || {};
        const friendlyFaction = intel.friendlyFaction || {};
        const enemyFaction = intel.enemyFaction || {};

        this.applyThreatModel(enemyMembers, friendlyMembers, chain);
        this.updateActivityWindows(friendlyMembers, enemyMembers);

        const ai = this.computeAI(enemyMembers, chain);

        const sitrep = {
            user,
            chain,
            friendlyFaction,
            enemyFaction,
            friendlyMembers,
            enemyMembers,
            sharedTargets: this.sharedTargets || [],
            activityFriendly: [...this.activityFriendly],
            activityEnemy: [...this.activityEnemy],
            ai
        };

        WAR_GENERAL.signals.dispatch("SITREP_UPDATE", sitrep);
    },

    applyThreatModel(enemyMembers, friendlyMembers, chain){
        const now = Date.now();

        for (let m of enemyMembers){
            const last = m.last_action || 0;
            const idle = now - last;
            const online = idle < 600000;

            let threat = 0;

            if (online) threat += 0.35;

            threat += (m.level / 100) * 0.25;

            if (m.status === "Hospital") threat -= 0.25;
            if (m.status === "Okay") threat += 0.15;
            if (m.status === "Traveling") threat -= 0.20;

            if (chain.hits > 0){
                if (online) threat += 0.15;
                if ((chain.timeLeft || 0) < 60) threat += 0.10;
            }

            m.threat = Math.max(0, Math.min(1, threat));
            m.online = online;
        }
    },

    updateActivityWindows(friendlyMembers, enemyMembers){
        const now = Date.now();
        const delta = now - this.lastActivityUpdate;

        if (delta < 60000 && this.lastActivityUpdate !== 0) return;
        this.lastActivityUpdate = now;

        const friendlyOnline = friendlyMembers.filter(m => {
            const last = m.last_action || 0;
            return (now - last) < 600000;
        }).length;

        const enemyOnline = enemyMembers.filter(m => m.online).length;

        this.activityFriendly.shift();
        this.activityEnemy.shift();

        this.activityFriendly.push(friendlyOnline);
        this.activityEnemy.push(enemyOnline);
    },

    computeAI(enemyMembers, chain){
        const enemyOnline = enemyMembers.filter(m => m.online).length;
        const avgThreat = enemyMembers.reduce((s,m)=>s+(m.threat||0),0) / Math.max(1, enemyMembers.length);

        const threat = Math.min(1, (enemyOnline / 15) * 0.4 + avgThreat * 0.6);

        const collapse = (chain.collapseRisk || 0) / 100;
        const momentum = (chain.momentum || 0) / 100;
        const risk = Math.min(1, collapse * 0.6 + threat * 0.4 + momentum * 0.1);

        const tempo = this.computeTempo();
        const instability = this.computeInstability(enemyMembers);

        return { threat, risk, tempo, instability };
    },

    computeTempo(){
        const a = this.activityEnemy;
        if (a.length < 10) return 0;

        const recent = a.slice(-5);
        const old = a.slice(-10, -5);

        const avgRecent = recent.reduce((s,v)=>s+v,0)/recent.length;
        const avgOld = old.reduce((s,v)=>s+v,0)/old.length;

        const diff = avgRecent - avgOld;

        return Math.max(0, Math.min(1, (diff / 10)));
    },

    computeInstability(enemyMembers){
        if (enemyMembers.length < 3) return 0;

        const threats = enemyMembers.map(m => m.threat || 0);
        const avg = threats.reduce((s,v)=>s+v,0)/threats.length;

        let variance = 0;
        threats.forEach(t => {
            variance += Math.pow(t - avg, 2);
        });

        variance /= threats.length;

        return Math.min(1, variance * 4);
    }
};

Colonel.init(WAR_GENERAL);

})();
