WAR_SANDBOX.register("Sergeant",{
    general:null,
    db:null,
    sharing:[],

    init(s){
        this.general=s;
        WARDBG("Sergeant online (Firebase disabled for now).");
        // Firebase optional (can be re-enabled)
    },

    onMessage(msg){
        if(msg.type==="PUSH_SHARED"){
            this.sharing=msg.payload;
            WARDBG("Shared updated.");
        }
    }
});
