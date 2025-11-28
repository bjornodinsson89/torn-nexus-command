WAR_SANDBOX.register("Lieutenant",{
    general:null,
    tick:0,
    active:false,
    timeout:0,

    init(s){
        this.general=s;
        WARDBG("Lieutenant online.");
        this.loop();
    },

    loop(){
        setInterval(()=>{
            this.tick++;
            const rate=this.active && this.timeout<45?1:(this.active?3:15);
            if(this.tick>=rate){ this.tick=0; this.fetch(); }
        },1000);
    },

    fetch(){
        this.general.intel.request("basic,profile,chain,faction,territory,war")
            .then(d=>this.handle(d))
            .catch(e=>WARDBG("L error: "+e));
    },

    handle(d){
        const chain=d.chain||{};
        this.active=(chain.current||0)>0;
        this.timeout=chain.timeout||0;

        WAR_SANDBOX.signals.dispatch("RAW_INTEL",{
            user:{
                id:d.profile.player_id,
                name:d.profile.name,
                level:d.profile.level,
                hp:d.profile.life.current,
                max_hp:d.profile.life.maximum
            },
            chain:{
                hits:chain.current||0,
                timeLeft:chain.timeout||0
            },
            factionMembers:d.faction.members||{},
            enemyFactionMembers:(d.war.war?.enemy_faction?.members)||{}
        });
    }
});
