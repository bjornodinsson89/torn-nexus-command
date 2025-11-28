/***********************************
 * COLONEL PRIME vX.1 (Final Fixed)
 ***********************************/

(function () {
    "use strict";

    const Colonel = {
        general: null,
        config: {
            tornApiKey: null,
            tornStatsKey: null,
            tornStatsEnabled: false,
            tornToolsEnabled: false,
            tornToolsToken: null,
            tornToolsBaseUrl: null,
            yataEnabled: false,
            yataApiKey: null,
            aiThrottleMs: 4000,
            tornStatsCacheTtl: 6 * 60 * 60 * 1000
        },
        db: null,
        memory: {
            lastAIUpdate: 0,
            lastSitrepUpdate: 0,
            state: { chain: null, faction: null, war: null, user: null },
            ai: { threatLevel: 0, riskLevel: 0, topTargets: [], notes: [], sources: {} },
            cache: { torn: {}, tornStats: {}, tornTools: {}, yata: {} }
        },
        api: { torn: { v1: {}, v2: {} }, tornstats: {}, torntools: {}, yata: {} },
        listeners: [],
        _dbQueue: [],
        _dbTimer: null,

        init(General) {
            this.cleanup();
            this.general = General;
            this._initApiLayer();
            this._attachCoreListeners();
            console.log("%c[COLONEL PRIME vX.1] Online", "color:#f55;font-weight:bold;");
        },

        cleanup() {
            this.listeners.forEach(u => u());
            this.listeners = [];
            clearTimeout(this._dbTimer);
            this._dbQueue = [];
        },

        setDatabaseAdapter(adapter) {
            if (adapter?.get && adapter?.set) this.db = adapter;
        },

        setTornStatsKey(key) {
            if (key && /^[a-f0-9]{32}$/i.test(key)) {
                this.config.tornStatsKey = key;
                this.config.tornStatsEnabled = true;
            } else {
                this.config.tornStatsKey = null;
                this.config.tornStatsEnabled = false;
            }
        },

        _listen(ev, fn) {
            const unsub = this.general.signals.listen(ev, fn);
            this.listeners.push(unsub);
        },

        _attachCoreListeners() {
            this._listen("RAW_INTEL", intel => {
                if (intel?._processed) return;
                this._handleRawIntel(intel);
            });
            this._listen("REQUEST_GLOBAL_SITREP", () => this._dispatchSitrep(this._buildSitrep()));
            this._listen("REQUEST_TARGET_SCORES", p => {
                const scored = this._scoreTargetList(p?.targets || []);
                this.general.signals.dispatch("TARGET_SCORES_READY", { scored });
            });
        },

        _handleRawIntel(intel) {
            if (!intel) return;
            if (intel.chain) this.memory.state.chain = { ...intel.chain };
            if (intel.faction) this.memory.state.faction = { ...intel.faction };
            if (intel.war) this.memory.state.war = { ...intel.war };
            if (intel.user) this.memory.state.user = { ...intel.user };
            this._maybeRunAIAndSitrep();
        },

        _maybeRunAIAndSitrep() {
            const now = Date.now();
            if (now - this.memory.lastAIUpdate < this.config.aiThrottleMs) return;
            this.memory.lastAIUpdate = now;
            this._computeAI();
            this._dispatchSitrep(this._buildSitrep());
        },

        _computeAI() {
            const s = this.memory.state;
            const a = this.memory.ai;
            const chain = s.chain || {};
            const war = s.war || {};
            const user = s.user || {};

            let threat = 0;
            const enemies = Array.isArray(war.enemyMembers) ? war.enemyMembers : [];
            const online = enemies.filter(m => Date.now() - (m.lastSeen || 0) < 600000).length;
            threat += Math.min(0.6, online * 0.03);
            if (chain.current > 0) threat += 0.15;
            if (war.state === "WAR") threat += 0.15;
            a.threatLevel = this._clamp(threat, 0, 1);

            let risk = 0;
            const timeout = chain.timeout || 0;
            if (timeout < 15) risk += 0.6;
            else if (timeout < 30) risk += 0.4;
            else if (timeout < 60) risk += 0.25;
            const status = (user.status?.state || "").toLowerCase();
            if (status.includes("hospital") || status.includes("jail")) risk += 0.1;
            a.riskLevel = this._clamp(risk, 0, 1);

            const targets = Array.isArray(war.targets) ? war.targets : [];
            a.topTargets = this._scoreTargetList(targets).slice(0, 5);
            a.notes = this._buildAINotes(a.threatLevel, a.riskLevel, chain, war, user);
            a.sources = { torn: true, tornStats: this.config.tornStatsEnabled };
        },

        _buildAINotes(threat, risk, chain, war, user) {
            const notes = [];
            if (chain?.current > 0) notes.push(`Chain \( {chain.current} active; \){chain.timeout}s left.`);
            if (war?.state) notes.push(`War: ${war.state || "UNKNOWN"}`);
            if (threat > 0.7) notes.push("High enemy activity — stay sharp.");
            if (risk > 0.7) notes.push("Chain drop imminent!");
            const st = (user.status?.state || "").toLowerCase();
            if (st.includes("hospital")) notes.push("You are hospitalized.");
            if (st.includes("jail")) notes.push("You are in jail.");
            return notes;
        },

        _scoreTargetList(list) {
            return (list || []).map(t => ({
                ...t,
                colonelScore: this._scoreSingleTarget(t)
            })).sort((a, b) => b.colonelScore - a.colonelScore);
        },

        _scoreSingleTarget(t) {
            if (!t) return 0;
            let score = 0;
            score += Math.min(50, (t.level || 1) * 2);
            if (Date.now() - (t.lastSeen || 0) < 600000) score += 10;
            const status = (t.status || "").toLowerCase();
            if (status.includes("hospital")) score -= 25;
            if (status.includes("jail")) score -= 20;
            if (status.includes("travel")) score -= 10;
            if (t.timer > 0) score -= Math.min(20, t.timer / 1000);
            return Math.max(0, Math.round(score));
        },

        _buildSitrep() {
            const s = this.memory.state;
            const a = this.memory.ai;
            return {
                chain: s.chain || { current: 0, timeout: 0 },
                faction: s.faction || { id: null, name: null },
                war: s.war || { state: "PEACE" },
                user: s.user || { level: 1, status: "Unknown" },
                ai: { ...a }
            };
        },

        _dispatchSitrep(sitrep) {
            this.memory.lastSitrepUpdate = Date.now();
            this.general.signals.dispatch("SITREP_UPDATE", sitrep);
        },

        _initApiLayer() {
            const self = this;

            function buildTornUrl(section, selections, id) {
                const key = self.config.tornApiKey || self.general?.intel?.getCredentials?.() || "";
                if (!key) throw new Error("No API key");
                const base = "https://api.torn.com/";
                const sel = Array.isArray(selections) ? selections.join(",") : selections;
                return `\( {base} \){section || "user"}\( {id ? "/" + id : ""}?selections= \){sel}&key=${key}`;
            }

            async function callTorn(section, selections, opts = {}) {
                const url = buildTornUrl(section, selections, opts.id);
                const cKey = opts.cacheKey || url;
                const cached = self._getCache("torn", cKey);
                if (cached) return cached;

                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url,
                        timeout: 10000,
                        onload: res => {
                            if (res.status !== 200) return reject(new Error(`HTTP ${res.status}`));
                            try {
                                const json = JSON.parse(res.responseText);
                                self._setCache("torn", cKey, json);
                                resolve(json);
                            } catch (e) { reject(e); }
                        },
                        onerror: () => reject(new Error("Network error")),
                        ontimeout: () => reject(new Error("Timeout"))
                    });
                });
            }

            this.api.torn.v2.user = {
                getBasic: async (s = ["basic"]) => {
                    try { return await callTorn("user", s); } catch { return { error: "Torn down" }; }
                }
            };
        },

        _getCache(bucket, key, ttl) {
            const store = this.memory.cache[bucket];
            if (!store) return null;
            const e = store[key];
            if (!e) return null;
            if (ttl && Date.now() - e.ts > ttl) { delete store[key]; return null; }
            return e.value;
        },

        _setCache(bucket, key, value) {
            if (!this.memory.cache[bucket]) this.memory.cache[bucket] = { size: 0, maxSize: 100 };
            const store = this.memory.cache[bucket];
            if (store.size >= store.maxSize) {
                const now = Date.now();
                for (const k in store) {
                    if (k !== "size" && k !== "maxSize" && now - store[k].ts > 300000) {
                        delete store[k]; store.size--; break;
                    }
                }
            }
            store[key] = { value, ts: Date.now() };
            store.size++;
        },

        async _cacheTornStatsProfile(target, data) {
            this._setCache("tornStats", String(target), data);
            if (this.db) {
                this._dbQueue.push({ path: `/tornstats/${target}`, data: { data, ts: Date.now() } });
                clearTimeout(this._dbTimer);
                this._dbTimer = setTimeout(async () => {
                    for (const item of this._dbQueue) {
                        try { await this.db.set(item.path, item.data); } catch (e) { console.warn(e); }
                    }
                    this._dbQueue = [];
                }, 2000);
            }
        },

        _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
    };

    if (window.WAR_GENERAL) {
        window.Colonel = Colonel; // Global exposure fix
        window.WAR_GENERAL.register("Colonel", Colonel);
    }
})();
