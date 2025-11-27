/***************************************************
 * WAR_LIEUTENANT v2.2 (Final Fixed)
 ***************************************************/

(function() {
    const Lieutenant = {
        general: null,
        intervals: [],
        listeners: [],
        memoryKey: "lieutenant_chain_memory_v22",
        memory: { active: false, hits: 0, timeLeft: 0, lastUpdate: 0, paceHistory: [] },
        failCount: 0,

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
            this.listeners.forEach(unsub => unsub?.());
            this.intervals = [];
            this.listeners = [];
        },

        registerListeners() {
            this.listeners.push(this.general.signals.listen("RAW_INTEL", intel => {
                if (intel?._processed) return;
                this.ingest(intel);
            }));
        },

        startPolling() {
            this.intervals.push(setInterval(() => {
                if (!this.general.intel.hasCredentials()) return;
                this.poll();
            }, 1000));
        },

        poll() {
            const wait = this.pollRate();
            if (!this._tick) this._tick = 0;
            this._tick++;
            if (this._tick < wait) return;
            this._tick = 0;

            this.general.intel.request({
                normalize: true,
                selections: ["chain", "faction", "war", "profile"]
            }).then(intel => {
                intel._processed = true;
                this.general.signals.dispatch("RAW_INTEL", intel);
                this.failCount = 0;
            }).catch(() => {
                this.failCount++;
                if (this.failCount > 3) setTimeout(() => this.failCount = 0, 60000);
            });
        },

        pollRate() {
            if (this.memory.timeLeft < 50 && this.memory.active) return 1;
            if (this.memory.active) return 3;
            return 15;
        },

        ingest(intel) {
            if (!intel?.chain) return;
            const c = intel.chain;
            this.memory.active = c.current > 0;
            this.memory.hits = c.current;
            this.memory.timeLeft = c.timeout;
            this.memory.lastUpdate = Date.now();

            this.memory.paceHistory = this.memory.paceHistory || [];
            this.memory.paceHistory.push({ time: Date.now(), hits: 1 });
            const cutoff = Date.now() - 60000;
            this.memory.paceHistory = this.memory.paceHistory.filter(p => p.time > cutoff);
            if (this.memory.paceHistory.length > 100) this.memory.paceHistory.shift();

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

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Lieutenant", Lieutenant);
})();
