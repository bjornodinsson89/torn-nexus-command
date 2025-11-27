/**************************************(***********************
 * COLONEL PRIME vX.0 — ULTRA-AI + TACTICAL ENGINE (MERGED)
 *
 * ROLE:
 *   • Senior Tactical & Intelligence Officer for War Room Nexus
 *
 * RESPONSIBILITIES:
 *   • Maintain IndexedDB brain (players, factions, patterns, scores, guides, models, events)
 *   • Ingest RAW_INTEL from General / Lieutenant
 *   • Build AI intelligence: aggression, patterns, risk, hostilities, heatmaps, guides
 *   • Tactical engine: chain pace, faction threat, war enemies, target scoring
 *   • Emit unified SITREP_UPDATE with AI block for Major.js
 *   • Support advanced queries: ASK_COLONEL, REQUEST_*_SITREP, REQUEST_TARGET_SCORES, etc.
 **********************************************************************************************/

(function () {
    "use strict";

    /* =======================================================
     * 1. CORE & DATABASE ARCHITECTURE
     * ======================================================= */

    const Colonel = {
        general: null,
        db: null,
        dbName: "ColonelUltraAI_DB",
        dbVersion: 2, // forces store creation/upgrade on patch

        // High-level memory used by AI & SITREP
        memory: {
            models: {},
            lastModelUpdate: 0,

            self: { level: 1, status: "Okay" }, // used in scoring

            // Chain intel (tactical)
            chain: {
                current: 0,
                max: 0,
                timeout: 0,
                paceHistory: [],
                pacePerMin: 0,
                avgPace: 0,
                decayRate: 0,
                isActive: false,
                dropRisk: "Low",
                prediction: "stable"
            },

            // Faction intel
            faction: {
                raw: null,
                id: null,
                name: null,
                members: {},
                readiness: {},
                hostilityScore: 0,
                hostilityHistory: [],
                warTrend: "stable",
                hostilityTrend: "stable",
                eventsLast24h: 0,
                heatmap: []
            },

            // War intel
            war: {
                raw: null,
                enemies: [],
                wall: null,
                score: null,
                threat: 0,
                danger: "Low",
                enemyActivityHeatmap: []
            },

            // Last global event sitrep (for AI block)
            globalEvents: {
                trend: "stable",
                heatmap: [],
                lastHour: 0,
                last6h: 0,
                last24h: 0
            },

            // Last AI risk profile / behavior for a focused player (optional)
            lastAIProfile: null,

            // Cache of last unified SITREP (optional)
            lastSITREP: null
        },

        // Internal listener references for cleanup if needed later
        listeners: [],

        /* --- INITIALIZATION SEQUENCE --- */
        init(General) {
            this.general = General;

            this.openDB()
                .then(() => this.bootstrapModels())
                .then(() => {
                    this.attachCoreListeners();
                    this.attachEventListeners();
                    this.attachQAListeners();
                    console.log("%c[COLONEL PRIME] Ultra-AI + Tactical Engine Online", "color:#f66");
                })
                .catch(err => {
                    console.warn("[COLONEL PRIME] DB Init Failed:", err);
                });
        },

        /* --- INDEXEDDB SETUP --- */
        openDB() {
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    reject("IndexedDB not supported");
                    return;
                }
                const req = indexedDB.open(this.dbName, this.dbVersion);

                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    const stores = ["players", "factions", "patterns", "scores", "guides", "models", "events"];

                    stores.forEach(store => {
                        if (!db.objectStoreNames.contains(store)) {
                            const opts =
                                store === "events" ? { autoIncrement: true } :
                                store === "models" ? { keyPath: "name" } :
                                { keyPath: "id" };
                            db.createObjectStore(store, opts);
                        }
                    });
                };

                req.onsuccess = () => {
                    this.db = req.result;
                    resolve();
                };

                req.onerror = () => reject(req.error);
            });
        },

        /* --- GENERIC DB OPERATIONS --- */
        write(store, data) {
            return new Promise((resolve, reject) => {
                try {
                    const tx = this.db.transaction(store, "readwrite");
                    tx.objectStore(store).put(data);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => reject(tx.error);
                } catch (e) {
                    reject(e);
                }
            });
        },

        read(store, key) {
            return new Promise((resolve, reject) => {
                try {
                    const tx = this.db.transaction(store, "readonly");
                    const req = tx.objectStore(store).get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => reject(req.error);
                } catch (e) {
                    reject(e);
                }
            });
        },

        readAll(store) {
            return new Promise((resolve, reject) => {
                try {
                    const tx = this.db.transaction(store, "readonly");
                    const req = tx.objectStore(store).getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                } catch (e) {
                    reject(e);
                }
            });
        },

        delete(store, key) {
            return new Promise((resolve, reject) => {
                try {
                    const tx = this.db.transaction(store, "readwrite");
                    tx.objectStore(store).delete(key);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => reject(tx.error);
                } catch (e) {
                    reject(e);
                }
            });
        },

        /* --- UTILITIES --- */
        now() { return Date.now(); },
        clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },
        smooth(a, b, t) { return (1 - t) * a + t * b; },

        warn(...msg) { console.warn("%c[COLONEL WARN]", "color:#F90", ...msg); },

        /* --- MODEL BOOTSTRAP --- */
        async bootstrapModels() {
            const base = {
                name: "baseWeights",
                version: 1,
                weights: {
                    aggressionWeight: 0.28,
                    threatWeight: 0.24,
                    fairFightWeight: 0.18,
                    respectVarianceWeight: 0.12,
                    behavioralRiskWeight: 0.10,
                    clusterWeight: 0.05,
                    factionHostilityWeight: 0.03
                },
                lastTrained: this.now()
            };

            const existing = await this.read("models", "baseWeights");
            if (!existing) {
                await this.write("models", base);
                this.memory.models["base"] = base.weights;
            } else {
                this.memory.models["base"] = existing.weights;
            }
            this.memory.lastModelUpdate = this.now();
        }
    };

    /* =======================================================
     * 2. NORMALIZATION & CORE STRUCTURES
     * ======================================================= */

    Colonel.normalizePlayer = function (p) {
        if (!p) return null;
        return {
            id: p.id || p.playerID || p.player_id,
            name: p.name || "Unknown",
            level: p.level || 1,
            lastSeen: this.now(),
            aggressionScore: 0,
            aggressionHistory: [],
            threatLevel: 0,
            threatTrend: "stable",
            statusTimeline: [],
            respectHistory: [],
            attackHistory: [],
            chainBehavior: {},
            behaviorCluster: "unknown",
            lastUpdate: this.now()
        };
    };

    Colonel.normalizeFaction = function (f) {
        return {
            id: f.id,
            name: f.name || "Unknown Faction",
            hostilityScore: 0,
            hostilityHistory: [],
            warTrend: "stable",
            memberAggMap: {},
            lastWarUpdate: this.now(),
            lastUpdate: this.now()
        };
    };

    Colonel.buildPatternID = function (playerID) { return playerID + "-" + this.now(); };

    Colonel.normalizePattern = function (p) {
        return {
            id: this.buildPatternID(p.playerID),
            playerID: p.playerID,
            timestamp: this.now(),
            behaviorCluster: p.behaviorCluster || "unknown",
            metrics: p.metrics || {}
        };
    };

    Colonel.computeTrend = function (values, window = 5) {
        if (!Array.isArray(values) || values.length < 2) return "stable";
        const recent = values.slice(-window);
        const first = recent[0];
        const last = recent[recent.length - 1];
        if (last > first * 1.15) return "rising";
        if (last < first * 0.85) return "falling";
        return "stable";
    };

    Colonel.exponentialDecayArray = function (arr, halfLifeHours = 12) {
        const now = this.now();
        const halfLife = halfLifeHours * 3600 * 1000;
        return arr.map(v => v * Math.pow(0.5, (now - v.timestamp) / halfLife));
    };

    /* =======================================================
     * 3. CORE DATA OPS (PLAYERS / FACTIONS / PATTERNS / SCORES)
     * ======================================================= */

    Colonel.ensurePlayer = async function (id, rawData) {
        let record = await this.read("players", id);
        if (!record) {
            record = this.normalizePlayer({ id, ...(rawData || {}) });
        } else {
            if (rawData && rawData.level) record.level = rawData.level;
            if (rawData && rawData.name) record.name = rawData.name;
            record.lastSeen = this.now();
        }
        await this.write("players", record);
        return record;
    };

    Colonel.ensureFaction = async function (id, raw) {
        let r = await this.read("factions", id);
        if (!r) {
            r = this.normalizeFaction({ id, ...raw });
        } else {
            if (raw.name) r.name = raw.name;
            r.lastUpdate = this.now();
        }
        await this.write("factions", r);
        return r;
    };

    Colonel.storePattern = async function (p) {
        const norm = this.normalizePattern(p);
        await this.write("patterns", norm);
        return norm;
    };

    Colonel.storeScore = async function (playerID, score, breakdown) {
        const data = { id: playerID, score, breakdown, lastScored: this.now() };
        await this.write("scores", data);
    };

    /* =======================================================
     * 4. PLAYER INTELLIGENCE ENGINE
     * ======================================================= */

    Colonel.updateAggression = async function (playerID, event) {
        let player = await this.read("players", playerID);
        if (!player) return;

        const now = this.now();
        const record = { value: event.value || 1, type: event.type || "attack", timestamp: now };

        player.aggressionHistory.push(record);
        if (player.aggressionHistory.length > 100) player.aggressionHistory.shift();

        const values = player.aggressionHistory.map(e => e.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = values.length ? sum / values.length : 0;

        const posterior = (avg * 0.7) + 0.15; // 0.15 prior
        player.aggressionScore = this.clamp(posterior, 0, 1);
        player.lastUpdate = now;

        await this.write("players", player);
    };

    Colonel.updateStatusActivity = async function (playerID, status) {
        let player = await this.read("players", playerID);
        if (!player) return;

        const now = this.now();
        player.statusTimeline.push({ status, timestamp: now });
        if (player.statusTimeline.length > 200) player.statusTimeline.shift();

        player.statusTimeline = player.statusTimeline.filter(s => (now - s.timestamp) < (48 * 3600000));
        await this.write("players", player);
    };

    Colonel.computeThreatLevel = async function (playerID) {
        let p = await this.read("players", playerID);
        if (!p) return 0;

        const A = p.aggressionScore || 0;
        const recentAttacks = p.aggressionHistory ? p.aggressionHistory.slice(-10).length : 0;
        const lastSeen = p.lastSeen || 0;
        const timeSince = (this.now() - lastSeen) / 60000;
        const activityFactor = timeSince < 15 ? 1 : timeSince < 60 ? 0.6 : 0.3;

        const prior = 0.2;
        const evidence = (A * 0.6) + (recentAttacks * 0.04);
        const posterior = (evidence * activityFactor) + prior;

        const threat = this.clamp(posterior, 0, 1);

        p.threatLevel = threat;
        p.threatHistory = p.threatHistory || [];
        p.threatHistory.push(threat);
        if (p.threatHistory.length > 30) p.threatHistory.shift();

        p.threatTrend = this.computeTrend(p.threatHistory.map(x => x));
        p.lastUpdate = this.now();

        await this.write("players", p);
        return threat;
    };

    /* =======================================================
     * 5. PATTERNS & BEHAVIOR CLUSTERS
     * ======================================================= */

    Colonel.computeAggressionSlope = function (history) {
        if (!Array.isArray(history) || history.length < 3) return 0;
        const values = history.map(h => h.value || 1);
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i;
        }
        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX + 1e-9);
    };

    Colonel.extractStatusPatterns = function (timeline) {
        if (!Array.isArray(timeline)) return { hospitalCount: 0, travelCount: 0, jailCount: 0, loginDensity: 0 };
        const now = this.now();
        let hospital = 0, travel = 0, jail = 0, active = 0;
        for (const evt of timeline) {
            const age = (now - evt.timestamp) / 60000;
            const s = (evt.status || "").toLowerCase();
            if (s.includes("hospital")) hospital++;
            if (s.includes("travel")) travel++;
            if (s.includes("jail")) jail++;
            if (age < 180) active++;
        }
        return { hospitalCount: hospital, travelCount: travel, jailCount: jail, loginDensity: active / 180 };
    };

    Colonel.buildBehaviorVector = function (player) {
        const slope = this.computeAggressionSlope(player.aggressionHistory);
        const status = this.extractStatusPatterns(player.statusTimeline);
        return [slope, status.hospitalCount, status.travelCount, status.jailCount, status.loginDensity];
    };

    Colonel.classifyBehaviorCluster = function (vector) {
        const centroids = {
            aggressive: [0.8, 1, 0, 0, 0.7],
            mobile: [0.3, 0, 5, 0, 0.6],
            unstable: [0.6, 6, 1, 2, 0.4],
            passive: [0.1, 0, 0, 0.2],
            chaotic: [0.7, 7, 4, 3, 0.8],
            stable: [0.2, 0, 0, 0, 0.5]
        };
        let best = "stable", bestDist = Infinity;
        for (const [cluster, center] of Object.entries(centroids)) {
            let dist = 0;
            for (let i = 0; i < vector.length; i++) dist += Math.pow(vector[i] - center[i], 2);
            if (dist < bestDist) { bestDist = dist; best = cluster; }
        }
        return best;
    };

    Colonel.predictNextBehavior = function (cluster) {
        switch (cluster) {
            case "aggressive": return "likely_attack";
            case "mobile": return "likely_travel";
            case "unstable": return "likely_hospital";
            case "chaotic": return "likely_attack_or_travel";
            case "passive": return "likely_idle";
            default: return "unknown";
        }
    };

    Colonel.analyzePlayerPatterns = async function (playerID) {
        const p = await this.read("players", playerID);
        if (!p) return null;

        const vec = this.buildBehaviorVector(p);
        const cluster = this.classifyBehaviorCluster(vec);
        const predicted = this.predictNextBehavior(cluster);

        p.behaviorCluster = cluster;
        p.predictedBehavior = predicted;
        p.lastBehaviorVector = vec;
        p.lastBehaviorUpdate = this.now();

        await this.write("players", p);

        return { cluster, predicted };
    };

    /* ADVANCED RISK PROFILE */

    Colonel.computeLoginPattern = function (player) {
        if (!player || !Array.isArray(player.statusTimeline)) return 0;
        const now = this.now();
        const recent = player.statusTimeline.filter(s => now - s.timestamp < 86400000);
        const hours = {};
        for (const evt of recent) {
            const h = new Date(evt.timestamp).getHours();
            hours[h] = (hours[h] || 0) + 1;
        }
        const values = Object.values(hours);
        if (!values.length) return 0;
        const maxBin = Math.max(...values);
        const total = values.reduce((a, b) => a + b, 0);
        return maxBin / total;
    };

    Colonel.detectChainBreaker = function (player) {
        if (!player || !Array.isArray(player.aggressionHistory)) return false;
        const last = player.aggressionHistory.slice(-20);
        let hospitalHits = 0;
        for (const evt of last) {
            if (evt.type === "attack" && evt.result === "hospital") hospitalHits++;
        }
        return hospitalHits >= 5;
    };

    Colonel.computeBehavioralRiskProfile = async function (playerID) {
        const p = await this.read("players", playerID);
        if (!p) return { risk: 0, cluster: "unknown" };

        const cluster = p.behaviorCluster || "stable";
        let clusterRisk = 0.3;
        const base = {
            aggressive: 0.8,
            unstable: 0.6,
            chaotic: 0.9,
            mobile: 0.5,
            passive: 0.2
        };
        if (base[cluster] !== undefined) clusterRisk = base[cluster];

        const loginConsistency = this.computeLoginPattern(p);
        const isBreaker = this.detectChainBreaker(p);

        let risk = this.clamp(
            0.7 * clusterRisk + 0.3 * (1 - loginConsistency),
            0, 1
        );

        if (isBreaker) risk = this.clamp(risk + 0.15, 0, 1);

        return {
            risk,
            cluster,
            loginConsistency,
            chainBreaker: isBreaker
        };
    };

    Colonel.processPatternIntel = async function (playerID) {
        await this.analyzePlayerPatterns(playerID);
        return await this.computeBehavioralRiskProfile(playerID);
    };

    /* =======================================================
     * 6. FACTION INTELLIGENCE ENGINE
     * ======================================================= */

    Colonel.updateFactionHostility = async function (factionID) {
        let f = await this.read("factions", factionID);
        if (!f) return 0;

        const now = this.now();
        const memberAgg = Object.values(f.memberAggMap || {});
        const avgAgg = memberAgg.length ? memberAgg.reduce((a, b) => a + b, 0) / memberAgg.length : 0;

        f.hostilityHistory = (f.hostilityHistory || []).map(h => {
            const age = now - h.timestamp;
            const decay = Math.pow(0.5, age / (8 * 3600000));
            return { ...h, value: h.value * decay };
        });

        f.hostilityHistory.push({ value: avgAgg, timestamp: now });
        if (f.hostilityHistory.length > 50) f.hostilityHistory.shift();

        const latest = f.hostilityHistory[f.hostilityHistory.length - 1].value;
        const posterior = (latest * 0.7) + 0.2;

        f.hostilityScore = this.clamp(posterior, 0, 1);
        f.warTrend = this.computeTrend(f.hostilityHistory.map(h => h.value));
        f.lastUpdate = now;

        await this.write("factions", f);
        this.memory.faction.hostilityScore = f.hostilityScore;
        this.memory.faction.hostilityHistory = f.hostilityHistory;
        this.memory.faction.warTrend = f.warTrend;

        return f.hostilityScore;
    };

    Colonel.ingestFactionMemberAggression = async function (factionID, memberID, value) {
        let f = await this.read("factions", factionID);
        if (!f) return;
        f.memberAggMap = f.memberAggMap || {};
        f.memberAggMap[memberID] = value;
        await this.write("factions", f);
        await this.updateFactionHostility(factionID);
    };

    Colonel.computeFactionRisk = async function (factionID) {
        let f = await this.read("factions", factionID);
        if (!f) return 0;

        const hostility = f.hostilityScore || await this.updateFactionHostility(factionID);
        let clusterFactor = 0.3;
        if (f.warTrend === "rising") clusterFactor = 0.6;
        if (f.warTrend === "falling") clusterFactor = 0.2;

        return this.clamp(hostility * 0.7 + clusterFactor * 0.3, 0, 1);
    };

    /* =======================================================
     * 7. ENSEMBLE TARGET SCORING ENGINE
     * ======================================================= */

    Colonel.getBaseModelWeights = function () {
        return this.memory.models["base"] || {
            aggressionWeight: 0.28,
            threatWeight: 0.24,
            fairFightWeight: 0.18,
            respectVarianceWeight: 0.12,
            behavioralRiskWeight: 0.10,
            clusterWeight: 0.05,
            factionHostilityWeight: 0.03
        };
    };

    Colonel.computeEnsembleTargetScore = async function (target) {
        const attackerLevel = this.memory.self.level || 1;

        const defenderID = target.id || target.playerID || target.player_id;
        const defenderLevel = target.level || 1;
        const status = target.status || "Okay";
        const factionID = target.factionID || target.faction_id;

        const diff = defenderLevel - attackerLevel;
        const ff = this.clamp(Math.exp(-Math.pow(diff / 10, 2)), 0, 1);

        let statusMult = 0.5;
        const s = String(status).toLowerCase();
        if (s === "okay" || s === "ok" || s === "online") statusMult = 1.0;
        else if (s.includes("travel")) statusMult = 0.4;
        else if (s.includes("hospital")) statusMult = 0.2;
        else if (s.includes("jail")) statusMult = 0.1;

        const playerRecord = defenderID ? await this.read("players", defenderID) : null;
        const playerRisk = playerRecord ? (await this.computeBehavioralRiskProfile(defenderID)).risk : 0.5;
        const factionRisk = factionID ? await this.computeFactionRisk(factionID) : 0.2;

        const scoreBehRisk = 1 - playerRisk;
        const scoreFacHost = 1 - factionRisk;

        const W = this.getBaseModelWeights();

        const ensemble =
            ff * W.fairFightWeight +
            statusMult * 0.25 +
            scoreBehRisk * W.behavioralRiskWeight +
            scoreFacHost * W.factionHostilityWeight +
            0.05;

        const finalScore = this.clamp(ensemble, 0, 1);

        if (defenderID) {
            await this.storeScore(defenderID, finalScore, { fairFight: ff, risk: playerRisk });
        }

        return { score: finalScore };
    };

    Colonel.computeTargetScore = function (target) {
        return this.computeEnsembleTargetScore(target)
            .then(result => result.score)
            .catch(e => {
                this.warn("Score error:", e);
                return 0;
            });
    };

    Colonel.scoreTargetList = async function (targets) {
        if (!Array.isArray(targets)) return [];
        const out = [];
        for (const t of targets) {
            const { score } = await this.computeEnsembleTargetScore(t);
            out.push({ ...t, colonelScore: score });
        }
        return out.sort((a, b) => b.colonelScore - a.colonelScore);
    };

    /* =======================================================
     * 8. EVENTS, HEATMAPS, GLOBAL SITREP
     * ======================================================= */

    Colonel.logEvent = async function (ev) {
        const data = {
            playerID: ev.playerID || null,
            factionID: ev.factionID || null,
            type: ev.type || "unknown",
            value: ev.value || 1,
            timestamp: this.now()
        };
        await this.write("events", data);
    };

    Colonel.readLastEvents = async function (limit = 100) {
        const all = await this.readAll("events");
        return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    };

    Colonel.computeEventHeatmap = function (events) {
        const map = Array(24).fill(0);
        for (const ev of events) {
            const hour = new Date(ev.timestamp).getHours();
            map[hour] += (ev.value || 1);
        }
        return map;
    };

    Colonel.computeEventTrend = function (events) {
        if (!events || !events.length) return "stable";
        const values = events.map(e => e.value || 1);
        return this.computeTrend(values);
    };

    Colonel.generateGlobalSitrep = async function () {
        const events = await this.readLastEvents(200);
        const now = this.now();
        const trend = this.computeEventTrend(events);
        const heatmap = this.computeEventHeatmap(events);

        const lastHour = events.filter(e => now - e.timestamp < 3600000).length;
        const last24h = events.filter(e => now - e.timestamp < 86400000).length;
        const last6h = events.filter(e => now - e.timestamp < 21600000).length;

        const result = { trend, heatmap, lastHour, last6h, last24h };
        this.memory.globalEvents = result;
        return result;
    };

    /* PLAYER / FACTION SITREPS (AI-QUERY-ONLY) */

    Colonel.getEventsForPlayer = async function (playerID, limit = 100) {
        const all = await this.readAll("events");
        const filtered = all.filter(e => e.playerID === playerID);
        return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    };

    Colonel.getEventsForFaction = async function (factionID, limit = 200) {
        const all = await this.readAll("events");
        const filtered = all.filter(e => e.factionID === factionID);
        return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    };

    Colonel.getPlayerActivityHeatmap = async function (playerID) {
        const events = await this.getEventsForPlayer(playerID, 200);
        return this.computeEventHeatmap(events);
    };

    Colonel.generatePlayerSitrep = async function (playerID) {
        const p = await this.read("players", playerID);
        if (!p) return { error: "Player not found" };

        const events = await this.getEventsForPlayer(playerID, 100);
        const trend = this.computeEventTrend(events);
        const heatmap = this.computeEventHeatmap(events);
        const riskProfile = await this.computeBehavioralRiskProfile(playerID);
        const threat = p.threatLevel || await this.computeThreatLevel(playerID);

        return {
            id: playerID,
            name: p.name,
            threat,
            trend,
            cluster: p.behaviorCluster || "unknown",
            risk: riskProfile.risk,
            predictedBehavior: p.predictedBehavior || "unknown",
            heatmap,
            eventsLast24h: events.filter(
                e => this.now() - e.timestamp < 86400000
            ).length
        };
    };

    Colonel.getFactionHostilityTimeline = async function (factionID) {
        const events = await this.getEventsForFaction(factionID, 200);
        const now = this.now();
        const out = [];

        for (const ev of events) {
            const ageHours = (now - ev.timestamp) / 3600000;
            if (ageHours < 24) {
                out.push({
                    ageHours,
                    value: ev.value || 1
                });
            }
        }
        return out.sort((a, b) => a.ageHours - b.ageHours);
    };

    Colonel.generateFactionSitrep = async function (factionID) {
        const f = await this.read("factions", factionID);
        if (!f) return { error: "Faction not found" };

        const events = await this.getEventsForFaction(factionID, 200);
        const timeline = await this.getFactionHostilityTimeline(factionID);
        const trend = this.computeEventTrend(events);

        const avgHostility = f.hostilityHistory?.length
            ? f.hostilityHistory.reduce((a, b) => a + b.value, 0) / f.hostilityHistory.length
            : 0;

        return {
            id: factionID,
            name: f.name,
            hostilityScore: f.hostilityScore || avgHostility,
            warTrend: f.warTrend || trend,
            hostilityTrend: trend,
            eventsLast24h: events.filter(
                e => this.now() - e.timestamp < 86400000
            ).length,
            heatmap: this.computeEventHeatmap(events),
            timeline
        };
    };

    /* =======================================================
     * 9. GUIDES & QA / ADVICE
     * ======================================================= */

    Colonel.cleanGuide = function (text) {
        if (!text) return "";
        return text.replace(/\[.*?\]/g, "")
            .replace(/https?:\/\/\S+/g, "")
            .replace(/<[^>]*>/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    };

    Colonel.classifyGuide = function (text) {
        text = text.toLowerCase();
        if (text.includes("crime") || text.includes("nerve")) return "crime";
        if (text.includes("gym") || text.includes("train")) return "training";
        if (text.includes("chain") || text.includes("respect")) return "chain";
        if (text.includes("faction")) return "faction";
        if (text.includes("war")) return "war";
        return "general";
    };

    Colonel.chunkGuide = function (text, size = 500) {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
        return chunks;
    };

    Colonel.ingestGuide = async function (name, text) {
        const cleaned = this.cleanGuide(text);
        const guide = {
            id: Date.now() + "-" + Math.random().toString(36).slice(2),
            title: name || "Untitled",
            category: this.classifyGuide(cleaned),
            contentChunks: this.chunkGuide(cleaned),
            dateIngested: this.now()
        };
        await this.write("guides", guide);
        return guide;
    };

    Colonel.indexGuides = async function () {
        const guides = await this.readAll("guides");
        const index = {
            crime: [], training: [], chain: [],
            war: [], faction: [], general: []
        };
        for (const g of guides) {
            const cat = g.category || "general";
            if (!index[cat]) index[cat] = [];
            index[cat].push(g);
        }
        return index;
    };

    Colonel.extractGuideTips = function (guides) {
        if (!guides || !guides.length) return null;

        const chunks = [];
        for (const g of guides) {
            chunks.push(...(g.contentChunks || []));
        }

        const sentences = chunks
            .join(" ")
            .split(".")
            .map(s => s.trim())
            .filter(s => s.length > 10);

        const actionable = sentences.filter(s =>
            /(always|never|avoid|focus|recommended|ideal|best|tip)/i.test(s)
        );

        if (!actionable.length) return null;
        return actionable.slice(0, 3).join(". ") + ".";
    };

    Colonel.handleTargetQuestion = async function (q) {
        const levelMatch = q.match(/level\s*(\d+)/);
        if (levelMatch) {
            const lvl = parseInt(levelMatch[1], 10);
            return "Ideal target around level " + lvl +
                " is one with a strong fair-fight score and low behavioral risk.";
        }

        if (q.includes("who") && q.includes("hit")) {
            return "Check the Targets view: Colonel sorts targets by respect potential and risk profile.";
        }

        if (q.includes("best") && q.includes("target")) {
            return "The best target is the one with highest ColonelScore that your faction can safely chain.";
        }

        return "Specify level or describe the target type for more detail.";
    };

    Colonel.advise = async function (topic, context = {}) {
        topic = (topic || "").toLowerCase();

        if (topic.includes("train") || topic.includes("gym")) {
            return "Train your highest stat unless your spread is extremely skewed; then reinforce your lowest for better gains.";
        }

        if (topic.includes("respect") || topic.includes("chain")) {
            return "Prioritize okay-status enemies with moderate level and low faction hostility for optimal respect gain.";
        }

        if (topic.includes("war")) {
            return "Focus on hostile factions with rising hostility only if you can sustain chains; otherwise pick fading factions as soft targets.";
        }

        if (topic.includes("crime")) {
            return "Use low-risk crimes to stabilize nerve, then weave in higher tiers as your success rate improves.";
        }

        return "I require more context to advise properly.";
    };

    Colonel.answerQuestion = async function (question) {
        if (!question) return "I require a question.";
        const q = question.toLowerCase();

        const index = await this.indexGuides();

        if (q.includes("crime") || q.includes("nerve")) {
            const tips = this.extractGuideTips(index.crime);
            return tips || "I have no crime data ingested.";
        }

        if (q.includes("gym") || q.includes("train") || q.includes("stats")) {
            const tips = this.extractGuideTips(index.training);
            return tips || "No training guides are stored yet.";
        }

        if (q.includes("respect") || q.includes("chain")) {
            const tips = this.extractGuideTips(index.chain);
            return tips || "No chain/respect guides ingested.";
        }

        if (q.includes("faction")) {
            const tips = this.extractGuideTips(index.faction);
            return tips || "No faction guides ingested.";
        }

        if (q.includes("war") || q.includes("raid")) {
            const tips = this.extractGuideTips(index.war);
            return tips || "No war guides stored.";
        }

        if (q.includes("target") || q.includes("hit")) {
            return await this.handleTargetQuestion(q);
        }

        const generalTips = this.extractGuideTips(index.general);
        if (generalTips) return generalTips;

        return "I do not have enough information to answer that.";
    };

    /* =======================================================
     * 10. TACTICAL ENGINE (CHAIN / FACTION / WAR)
     * ======================================================= */

    // --- CHAIN ENGINE ---
    Colonel.processChainIntel = function (chain) {
        if (!chain) return;

        const now = this.now();
        const mem = this.memory.chain;

        const delta = chain.current - mem.current;
        if (delta > 0) {
            mem.paceHistory.push({ time: now, hits: delta });
        }

        const cutoff = now - 60000;
        mem.paceHistory = mem.paceHistory.filter(p => p.time > cutoff);

        const totalHits = mem.paceHistory.reduce((a, c) => a + c.hits, 0);
        mem.pacePerMin = totalHits;

        mem.current = chain.current;
        mem.max = chain.max || mem.max;
        mem.timeout = chain.timeout;
        mem.isActive = chain.current > 0;

        let risk = "Low";
        if (chain.timeout < 50) risk = "Medium";
        if (chain.timeout < 30) risk = "High";
        if (chain.timeout < 15) risk = "Critical";

        mem.dropRisk = risk;
        mem.prediction =
            risk === "Critical" ? "likely_drop" :
            risk === "High" ? "danger_zone" :
            risk === "Medium" ? "tight" :
            "stable";

        // simple decay-rate hint
        mem.decayRate = Math.max(0, chain.timeout - (chain.current * 2));
    };

    // --- FACTION ENGINE ---
    Colonel.processFactionIntel = function (faction) {
        if (!faction) return;

        this.memory.faction.raw = faction;
        this.memory.faction.id = faction.id || faction.faction_id || null;
        this.memory.faction.name = faction.name || null;
        this.memory.faction.members = faction.members || {};

        const readiness = {};
        Object.values(this.memory.faction.members).forEach(m => {
            if (!m) return;
            const id = m.player_id || m.user_id || m.id;
            readiness[id] = {
                name: m.name,
                isHosp: (m.status?.state || "").toLowerCase().includes("hospital"),
                readyIn: m.status?.until || 0,
                lastActive: m.last_action?.relative || "--",
                position: m.position || "Member"
            };
        });
        this.memory.faction.readiness = readiness;
    };

    // --- WAR ENGINE ---
    Colonel.deriveEnemyTargets = function (war) {
        // Expect war.enemies as object or array; if missing, return empty
        const enemies = war?.enemies || {};
        const out = [];

        const list = Array.isArray(enemies) ? enemies : Object.values(enemies);
        list.forEach(m => {
            if (!m) return;
            const t = {
                id: m.id || m.userID || m.player_id,
                name: m.name || "Unknown",
                level: m.level || 0,
                faction: m.faction || "",
                status: m.status?.state || "Okay",
                timer: m.status?.until || 0,
                lastSeen: m.lastSeen || 0,
                factionID: m.faction_id || null
            };
            out.push(t);
        });

        return out;
    };

    Colonel.deriveEnemyStats = function (list, chainCurrent) {
        let online = 0, hosp = 0, jail = 0, travel = 0;
        const now = this.now();

        list.forEach(t => {
            const s = (t.status || "").toLowerCase();
            if (t.lastSeen && now - t.lastSeen < 600000) online++;
            if (s.includes("hospital")) hosp++;
            if (s.includes("jail")) jail++;
            if (s.includes("travel")) travel++;
        });

        let threatScore = online + (chainCurrent > 0 ? 5 : 0);
        let danger = "Low";
        if (threatScore > 10) danger = "Medium";
        if (threatScore > 20) danger = "High";
        if (threatScore > 30) danger = "Extreme";

        return {
            enemyOnline: online,
            enemyHospital: hosp,
            enemyJail: jail,
            enemyTravel: travel,
            threat: threatScore,
            danger
        };
    };

    Colonel.processWarIntel = async function (war, chain) {
        if (!war) return;
        const mem = this.memory.war;

        mem.raw = war;
        mem.wall = war.wall || mem.wall;
        mem.score = war.score || mem.score;

        const enemies = this.deriveEnemyTargets(war);
        mem.enemies = enemies;

        const stats = this.deriveEnemyStats(enemies, chain?.current || 0);
        mem.threat = stats.threat;
        mem.danger = stats.danger;

        // Optional: enemy activity heatmap from events (if you log them)
        mem.enemyActivityHeatmap = []; // placeholder for future event-based heatmap

        // Score enemies using AI scoring engine
        const scored = await this.scoreTargetList(enemies);
        mem.enemies = scored;
    };

    /* =======================================================
     * 11. RAW_INTEL INGESTION + UNIFIED SITREP_UPDATE
     * ======================================================= */

    Colonel.ingestIntel = async function (intel) {
        if (!intel) return;

        const raw = intel.raw || {};

        // Normalize player info from raw if needed
        if (!intel.player && (raw.player_id || raw.name)) {
            intel.player = {
                id: raw.player_id,
                name: raw.name,
                level: raw.level
            };
        }

        // Self model from player if it’s the user
        if (intel.player && intel.player.id) {
            this.memory.self.level = parseInt(intel.player.level || this.memory.self.level, 10);
        }

        // Ensure player record & analyze
        if (intel.player && intel.player.id) {
            const pid = intel.player.id;
            await this.ensurePlayer(pid, intel.player);
            await this.analyzePlayerPatterns(pid);
            const profile = await this.computeBehavioralRiskProfile(pid);
            this.memory.lastAIProfile = profile;
            await this.computeThreatLevel(pid);
        }

        // Faction intel
        if (intel.faction) {
            const fid = intel.faction.id || intel.faction.faction_id;
            if (fid) {
                await this.ensureFaction(fid, intel.faction);
                await this.updateFactionHostility(fid);
            }
            this.processFactionIntel(intel.faction);
        }

        // Chain intel
        if (intel.chain) {
            this.processChainIntel(intel.chain);
        }

        // War intel if present
        if (intel.war) {
            await this.processWarIntel(intel.war, intel.chain || null);
        }

        // Global events AI block (throttling could be added later)
        await this.generateGlobalSitrep();

        // Finally, emit unified SITREP_UPDATE for Major
        this.emitUnifiedSitrep(intel);
    };

    Colonel.emitUnifiedSitrep = function (intel) {
        const sitrep = {
            chain: { ...this.memory.chain },

            faction: {
                id: this.memory.faction.id,
                name: this.memory.faction.name,
                members: this.memory.faction.members,
                readiness: this.memory.faction.readiness,
                hostilityScore: this.memory.faction.hostilityScore,
                hostilityHistory: this.memory.faction.hostilityHistory,
                warTrend: this.memory.faction.warTrend,
                hostilityTrend: this.memory.faction.hostilityTrend,
                eventsLast24h: this.memory.faction.eventsLast24h,
                heatmap: this.memory.faction.heatmap
            },

            war: {
                wall: this.memory.war.wall,
                score: this.memory.war.score,
                enemies: this.memory.war.enemies,
                threat: this.memory.war.threat,
                danger: this.memory.war.danger,
                enemyActivityHeatmap: this.memory.war.enemyActivityHeatmap
            },

            user: {
                status: this.memory.self.status,
                level: this.memory.self.level
            },

            ai: {
                global: { ...this.memory.globalEvents },
                profile: this.memory.lastAIProfile,
                // top enemies already scored in war.enemies
                notes: []
            }
        };

        this.memory.lastSITREP = sitrep;
        this.general.signals.dispatch("SITREP_UPDATE", sitrep);
    };

    /* =======================================================
     * 12. SIGNAL WIRES (RAW_INTEL, QUERIES, QA)
     * ======================================================= */

    Colonel.attachCoreListeners = function () {
        if (!this.general) return;

        // RAW_INTEL main feed
        this.general.signals.listen("RAW_INTEL", intel => {
            this.ingestIntel(intel).catch(e => this.warn("Ingest error:", e));
        });

        // USER_SITREP hook (optional – if someone emits it)
        this.general.signals.listen("USER_SITREP", us => {
            if (!us) return;
            this.memory.self.status = us.status || this.memory.self.status;
        });

        // Target scoring request
        this.general.signals.listen("REQUEST_TARGET_SCORES", async payload => {
            const list = payload?.targets || [];
            const scored = await this.scoreTargetList(list);
            this.general.signals.dispatch("TARGET_SCORES_READY", { original: list, scored });
        });

        // Global sitrep on-demand
        this.general.signals.listen("REQUEST_GLOBAL_SITREP", async () => {
            const data = await this.generateGlobalSitrep();
            this.general.signals.dispatch("GLOBAL_SITREP_READY", data);
        });
    };

    Colonel.attachEventListeners = function () {
        if (!this.general) return;

        this.general.signals.listen("LOG_EVENT", ev => {
            if (!ev) return;
            this.logEvent(ev).catch(e => this.warn("Event log error:", e));
        });

        this.general.signals.listen("REQUEST_PLAYER_SITREP", async payload => {
            if (!payload || !payload.id) return;
            const data = await this.generatePlayerSitrep(payload.id);
            this.general.signals.dispatch("PLAYER_SITREP_READY", data);
        });

        this.general.signals.listen("REQUEST_FACTION_SITREP", async payload => {
            if (!payload || !payload.id) return;
            const data = await this.generateFactionSitrep(payload.id);
            this.general.signals.dispatch("FACTION_SITREP_READY", data);
        });
    };

    Colonel.attachQAListeners = function () {
        if (!this.general) return;

        this.general.signals.listen("REQUEST_ADVICE", async payload => {
            const topic = payload?.topic || "";
            const context = payload?.context || {};
            const result = await this.advise(topic, context);
            this.general.signals.dispatch("ADVICE_READY", { topic, result });
        });

        this.general.signals.listen("ASK_COLONEL", async payload => {
            if (!payload?.question) return;
            const answer = await this.answerQuestion(payload.question);
            this.general.signals.dispatch("COLONEL_ANSWER", { question: payload.question, answer });
        });
    };

    /* =======================================================
     * 13. REGISTER WITH GENERAL
     * ======================================================= */

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Colonel", Colonel);
    } else {
        console.warn("[COLONEL PRIME] WAR_GENERAL not found – Colonel not registered.");
    }

})();
