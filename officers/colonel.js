WAR_SANDBOX.register("Colonel",{
    general:null,
    state:{},

    init(s){
        this.general=s;
        WARDBG("Colonel online.");
        s.signals.listen("RAW_INTEL",x=>this.process(x));
    },

    process(d){
        const enemies=this.formatEnemies(d.enemyFactionMembers);
        const ai=this.computeAI(d.chain,enemies);

        WAR_SANDBOX.signals.dispatch("SITREP_UPDATE",{
            user:d.user,
            chain:d.chain,
            factionMembers:d.factionMembers,
            enemyFactionMembers:enemies,
            ai
        });
    },

    formatEnemies(map){
        const now=Date.now();
        return Object.values(map).map(m=>{
            const idle=now-(m.last_action.timestamp*1000);
            return{
                name:m.name,
                level:m.level,
                status:m.status,
                online:(idle<600000)
            };
        });
    },

    computeAI(chain,enemies){
        const active=enemies.filter(e=>e.online).length;
        return{
            threat:Math.min(1,active*0.04),
            risk:(chain.timeLeft<60)?0.5:0.1
        };
    }
});
