/***************************************************
 * WAR_LIEUTENANT v2.2 (Final Deployment Build)
 * Role: Reconnaissance Officer
 * Responsibilities:
 *    • Poll Torn API (via General)
 *    • Deliver RAW_INTEL
 *    • Adaptive polling (peace / chain / panic)
 *    • Persistent chain memory
 ***************************************************/

(function() {

    const Lieutenant = {
        general: null,
        intervals: [],
        listeners: [],
        memoryKey: "lieutenant_chain_memory_v22",

        memory: {
            active: false,
            hits: 0,
            timeLeft: 0,
            chainID: 0,
            lastUpdate: 0,
            paceHistory: []
        },

        init(General) {
            this.cleanup();
            this.general = General;

            this.loadMemory();
            this.registerListeners();
            this.startPolling();

            console.log("%c[Lieutenant v2.2] Recon Online", "color:#4cf");
        },

        cleanup() {
            this.intervals.forEach(id => clearInterval(id));
            this.intervals = [];

            if (this.listeners.length) {
                this.listeners.forEach(unsub => { try { unsub(); } catch {} });
                this.listeners = [];
            }
        },

        registerListeners() {
            const unsub = this.general.signals.listen("RAW_INTEL", intel => {
                this.ingest(intel);
            });
            this.listeners.push(unsub);
        },

        startPolling() {
            const id = setInterval(() => {
                if (!this.general.intel.hasCredentials()) return;
                this.poll();
            }, 1000);

            this.intervals.push(id);
        },

        poll() {
            const wait = this.pollRate();
            if (!this._tick) this._tick = 0;
            this._tick++;

            if (this._tick < wait) return;
            this._tick = 0;

            this.general.intel.request({
                normalize: true,
                selections: ["basic","bars","chain","faction","profile"]
            }).then(intel => {
                this.general.signals.dispatch("RAW_INTEL", intel);
            }).catch(()=>{});
        },

        pollRate() {
            if (this.memory.timeLeft < 50 && this.memory.active) return 1;  
            if (this.memory.active) return 3;       
            return 15;                                
        },

        ingest(intel) {
            if (!intel || !intel.chain) return;

            const c = intel.chain;
            this.memory.active = c.current > 0;
            this.memory.hits = c.current;
            this.memory.timeLeft = c.timeout;
            this.memory.lastUpdate = Date.now();

            if (!this.memory.paceHistory) this.memory.paceHistory = [];
            this.memory.paceHistory.push({time: Date.now(), hits: 1});

            const cutoff = Date.now() - 60000;
            this.memory.paceHistory = this.memory.paceHistory.filter(p => p.time > cutoff);

            this.saveMemory();
        },

        loadMemory() {
            try {
                const raw = localStorage.getItem(this.memoryKey);
                if (raw) this.memory = JSON.parse(raw);
            } catch {}
        },

        saveMemory() {
            try { 
                localStorage.setItem(this.memoryKey, JSON.stringify(this.memory)); 
            } catch {}
        }
    };

    if (window.WAR_GENERAL) WAR_GENERAL.register("Lieutenant", Lieutenant);

})();
