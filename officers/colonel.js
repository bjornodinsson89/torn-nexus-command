// colonel.js — Maximum Military Intelligence AI
// FULL IMPLEMENTATION 

WAR_SANDBOX.register("Colonel", (function(){

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

const Colonel = {

    general: null,

    // Rolling activity windows (last 30 minutes)
    activityFriendly: Array(30).fill(0),
    activityEnemy: Array(30).fill(0),
    lastActivityUpdate: 0,

    init(general){
        this.general = general;
        WARDBG("Colonel online (MAX-AI)");

        // Listen for raw intel from Lieutenant
        general.signals.listen("RAW_INTEL", intel => {
            this.process(intel);
        });

        // Listen for shared target updates from UI
        general.signals.listen("UPDATE_TARGETS", targets => {
            this.sharedTargets = targets;
        });
    },

    ////////////////////////////////////////////////////////
    // MAIN INTEL PROCESSOR
    ////////////////////////////////////////////////////////

    process(intel){
        const user = intel.user;
        const friendlyMembers = intel.friendlyMembers;
        const enemyMembers = intel.enemyMembers;
        const chain = intel.chain;
        const friendlyFaction = intel.friendlyFaction;
        const enemyFaction = intel.enemyFaction;

        // Build threat profiles
        this.applyThreatModel(enemyMembers, friendlyMembers, chain);

        // Update rolling activity windows
        this.updateActivityWindows(friendlyMembers, enemyMembers);

        // Compute AI metrics
        const ai = this.computeAI(enemyMembers, chain);

        // Build SITREP
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

        // Push SITREP up to Major
        WAR_SANDBOX.signals.dispatch("SITREP_UPDATE", sitrep);
    },

    ////////////////////////////////////////////////////////
    // THREAT MODELING
    ////////////////////////////////////////////////////////

    applyThreatModel(enemyMembers, friendlyMembers, chain){
        const now = Date.now();

        for (let m of enemyMembers){

            // Online detection
            const idle = now - (m.last_action * 1000);
            const online = idle < 600000;

            // Base threat
            let threat = 0;

            // Weight: online
            if (online) threat += 0.35;

            // Weight: level
            threat += (m.level / 100) * 0.25;

            // Weight: status (hospital reduces threat)
            if (m.status === "Hospital") threat -= 0.25;
            if (m.status === "Okay") threat += 0.15;
            if (m.status === "Traveling") threat -= 0.20;

            // Weight: chain proximity
            if (chain.hits > 0){
                if (online) threat += 0.15;
                if (chain.timeLeft < 60) threat += 0.10;
            }

            // Clamp 0-1
            m.threat = Math.max(0, Math.min(1, threat));
            m.online = online;
        }
    },

    ////////////////////////////////////////////////////////
    // ROLLING ACTIVITY WINDOWS (30 entries)
    ////////////////////////////////////////////////////////

    updateActivityWindows(friendlyMembers, enemyMembers){
        const now = Date.now();
        const delta = now - this.lastActivityUpdate;

        // Update every 60 seconds
        if (delta < 60000 && this.lastActivityUpdate !== 0) return;
        this.lastActivityUpdate = now;

        const friendlyOnline = friendlyMembers.filter(m => {
            return (now - (m.last_action * 1000) < 600000);
        }).length;

        const enemyOnline = enemyMembers.filter(m => {
            return m.online;
        }).length;

        // Scroll window left
        this.activityFriendly.shift();
        this.activityEnemy.shift();

        // Append current count
        this.activityFriendly.push(friendlyOnline);
        this.activityEnemy.push(enemyOnline);
    },

    ////////////////////////////////////////////////////////
    // MAXIMUM INTELLIGENCE AI CORE
    ////////////////////////////////////////////////////////

    computeAI(enemyMembers, chain){
        const enemyOnline = enemyMembers.filter(m => m.online).length;
        const avgThreat = enemyMembers.reduce((s,m)=>s+(m.threat||0),0) / Math.max(1, enemyMembers.length);

        // Threat = combination of online count + threat profile
        const threat = Math.min(1, (enemyOnline / 15) * 0.4 + avgThreat * 0.6);

        // Risk = chain state + enemy momentum
        const collapse = chain.collapseRisk / 100;
        const momentum = (chain.momentum || 0) / 100;
        const risk = Math.min(1, collapse * 0.6 + threat * 0.4);

        // Tempo = enemy online fluctuations (activity slope)
        const tempo = this.computeTempo();

        // Instability = variance of enemy threat over last 30m
        const instability = this.computeInstability(enemyMembers);

        return { threat, risk, tempo, instability };
    },

    ////////////////////////////////////////////////////////
    // TEMPORAL ANALYSIS — TEMPO
    ////////////////////////////////////////////////////////

    computeTempo(){
        const a = this.activityEnemy;
        if (a.length < 5) return 0;

        const recent = a.slice(-5);
        const old = a.slice(-10, -5);

        const avgRecent = recent.reduce((s,v)=>s+v,0)/recent.length;
        const avgOld = old.reduce((s,v)=>s+v,0)/old.length;

        const diff = avgRecent - avgOld;

        // Normalize
        return Math.max(0, Math.min(1, (diff / 10)));
    },

    ////////////////////////////////////////////////////////
    // INSTABILITY = variance of enemy threat
    ////////////////////////////////////////////////////////

    computeInstability(enemyMembers){
        if (enemyMembers.length < 3) return 0;

        const threats = enemyMembers.map(m => m.threat || 0);
        const avg = threats.reduce((s,v)=>s+v,0)/threats.length;

        let variance = 0;
        threats.forEach(t => {
            variance += Math.pow(t - avg, 2);
        });

        variance /= threats.length;

        return Math.min(1, variance * 4); // normalized
    }
};

return Colonel;

})());
