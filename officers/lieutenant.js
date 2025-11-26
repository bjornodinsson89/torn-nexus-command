(function () {

    const Lieutenant = {
        general: null,

        init(General) {
            this.general = General;

            // ingest raw intel (existing)
            General.signals.listen("RAW_INTEL", intel => this.ingestRawIntel(intel));

            // chain memory as before
            this.loadMemory();

            
            setInterval(()=>this.pollIntel(), 1000);

            console.log("%c[Lieutenant v2.1] Online (Polling Active)", "color:#4cf");
        },

        pollTicker:0,

        pollIntel() {
            this.pollTicker++;
            if (this.pollTicker < this.getPollingGate()) return;
            this.pollTicker = 0;

            this.general.intel.request({
                selections:["basic","chain","faction","bars"],
                normalize:true
            }).then(data=>{
                this.general.signals.dispatch("RAW_INTEL", data);
            }).catch(()=>{});
        },

        getPollingGate() {
            // Converts seconds → ticks (1 tick per second)
            if (this.memory.timeLeft < 60 && this.memory.active) return 1;   // panic 1s
            if (this.memory.active) return 3;                                // chain 3s
            return 15;                                                       // peace 15s
        },

        /************ (rest is same as your v2 file) ************/
        memoryKey: "lieutenant_chain_memory_v2",
        memory: { active:false, chainID:0, hits:0, timeLeft:0, requiredPace:0,
                  lastUpdate:Date.now(), hitHistory:[], paceHistory:[] },

        loadMemory() {
            try {
                const raw = localStorage.getItem(this.memoryKey);
                if (raw) this.memory = JSON.parse(raw);
            } catch(e){}
        },

        saveMemory() {
            try { localStorage.setItem(this.memoryKey, JSON.stringify(this.memory)); }
            catch(e){}
        },

        ingestRawIntel(intel) {
            if (!intel || !intel.chain) return;
            const c = intel.chain;
            this.memory.active = c.current>0;
            this.memory.hits = c.current ?? this.memory.hits;
            this.memory.timeLeft = c.timeout ?? this.memory.timeLeft;
            this.memory.lastUpdate = Date.now();
            this.saveMemory();
        }
    };

    if (window.WAR_GENERAL) WAR_GENERAL.register("Lieutenant", Lieutenant);

})();
