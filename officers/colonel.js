/*****************************
 * WAR_COLONEL v4.0
 *****************************/
 
(function() {

class Colonel {

    constructor() {
        this.general = null;

        this.memory = {
            self: { status: null },
            faction: {},
            chain: {},
            war: {},
        };

        this.listeners = [];
    }

    init(G) {
        this.cleanup();
        this.general = G;

        this.registerListeners();

        console.log("%c[Colonel v4.0] Balanced Ultra-AI Online", "color:#aaf");
    }

    registerListeners() {
        // RAW_INTEL flow unchanged
        this.listen("RAW_INTEL", intel => {
            this.ingestIntel(intel);
        });

        // USER_SITREP listener remains but still never fires
        this.listen("USER_SITREP", sitrep => {
            if (!sitrep) return;
            this.memory.self.status = sitrep.status || this.memory.self.status;
        });
    }

    listen(ev, handler) {
        const unsub = this.general.signals.listen(ev, handler);
        this.listeners.push(unsub);
    }

    /**************************************************************
     * FIXED: Update self.status using RAW_INTEL instead of USER_SITREP
     **************************************************************/
    ingestIntel(intel) {
        if (!intel) return;

        // FIX #3:
        if (intel.user && intel.user.status) {
            this.memory.self.status = intel.user.status;
        }

        if (intel.chain) this.memory.chain = intel.chain;
        if (intel.faction) this.memory.faction = intel.faction;
        if (intel.raw && intel.raw.war) this.memory.war = intel.raw.war;

        this.buildChainSITREP();
        this.buildWarSITREP();
    }

    buildChainSITREP() {
        const c = this.memory.chain;
        if (!c || !c.current) return;

        const sitrep = {
            chain: c.current,
            cooldown: c.cooldown || null
        };

        this.general.signals.dispatch("CHAIN_SITREP", sitrep);
    }

    buildWarSITREP() {
        const w = this.memory.war;
        if (!w) return;

        const sitrep = {
            war: w
        };

        this.general.signals.dispatch("WAR_SITREP", sitrep);
    }

    cleanup() {
        this.listeners.forEach(u => u());
        this.listeners = [];
    }
}

/**************************************************************
 * REGISTER
 **************************************************************/
if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Colonel", new Colonel());
}

})();
