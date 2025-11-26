/**
 * COLONEL v3.1 — ULTRA-AI (FULL ORIGINAL + PATCHES)
 * COMPILED & PATCHED
 * Core + IndexedDB + Full Pattern Intelligence + Heatmaps + Advanced QA
 */

(function() {
    "use strict";

    /* =======================================================
     * 1. CORE & DATABASE ARCHITECTURE
     * ======================================================= */
    const Colonel = {
        general: null,
        db: null,
        dbName: "ColonelUltraAI_DB",
        dbVersion: 2, // PATCHED: Bumped version to force store creation

        memory: {
            models: {},
            lastModelUpdate: 0,
            self: { level: 1, status: "Okay" } // PATCHED: Added self-storage to fix scoring crash
        },

        /* --- INITIALIZATION SEQUENCE --- */
        init(General) {
            this.general = General;
            this.openDB().then(() => {
                this.bootstrapModels();
                // Once DB is open and models loaded, we start the engines
                this.start();
            }).catch(err => {
                console.error("[COLONEL] DB Init Failed:", err);
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
                            const opts = store === "events" ? { autoIncrement: true } : (store === "models" ? { keyPath: "name" } : { keyPath: "id" });
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

        // Logs
        log(...msg) { console.log("%c[COLONEL-AI]", "color:#F44; font-weight:bold;", ...msg); },
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

            // Check existing before overwrite to preserve training
            const existing = await this.read("models", "baseWeights");
            if (!existing) {
                await this.write("models", base);
                this.memory.models["base"] = base.weights;
            } else {
                this.memory.models["base"] = existing.weights;
            }
            this.memory.lastModelUpdate = this.now();
        },

        /* --- NORMALIZATION UTILS --- */
        normalizePlayer(p) {
            if (!p) return null;
            return {
                id: p.id || p.playerID || p.player_id,
                name: p.name || "Unknown",
                level: p.level || 1, // PATCHED: Added level capture
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
        },

        normalizeFaction(f) {
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
        },

        buildPatternID(playerID) { return playerID + "-" + this.now(); },

        normalizePattern(p) {
            return {
                id: this.buildPatternID(p.playerID),
                playerID: p.playerID,
                timestamp: this.now(),
                behaviorCluster: p.behaviorCluster || "unknown",
                metrics: p.metrics || {}
            };
        },

        /* --- CORE DATA OPS --- */
        async ensurePlayer(id, rawData) {
            let record = await this.read("players", id);
            if (!record) {
                record = this.normalizePlayer({ id, ...(rawData || {}) });
            } else {
                // Update basic fields if they exist in raw data
                if (rawData.level) record.level = rawData.level;
                if (rawData.name) record.name = rawData.name;
                record.lastSeen = this.now();
            }
            await this.write("players", record);
            return record;
        },

        async ensureFaction(id, raw) {
            let r = await this.read("factions", id);
            if (!r) {
                r = this.normalizeFaction({ id, ...raw });
            } else {
                if (raw.name) r.name = raw.name;
                r.lastUpdate = this.now();
            }
            await this.write("factions", r);
            return r;
        },

        async storePattern(p) {
            const norm = this.normalizePattern(p);
            await this.write("patterns", norm);
            return norm;
        },

        async storeScore(playerID, score, breakdown) {
            const data = { id: playerID, score, breakdown, lastScored: this.now() };
            await this.write("scores", data);
        }
    };

    /* =======================================================
     * 2. STATS & TREND UTILITIES
     * ======================================================= */
    Colonel.computeTrend = function(values, window = 5) {
        if (!Array.isArray(values) || values.length < 2) return "stable";
        const recent = values.slice(-window);
        const first = recent[0];
        const last = recent[recent.length - 1];
        if (last > first * 1.15) return "rising";
        if (last < first * 0.85) return "falling";
        return "stable";
    };

    Colonel.exponentialDecayArray = function(arr, halfLifeHours = 12) {
        const now = this.now();
        const halfLife = halfLifeHours * 3600 * 1000;
        return arr.map(v => v * Math.pow(0.5, (now - v.timestamp) / halfLife));
    };

    /* =======================================================
     * 3. PLAYER INTELLIGENCE ENGINE
     * ======================================================= */
    Colonel.updateAggression = async function(playerID, event) {
        let player = await this.read("players", playerID);
        if (!player) return;

        const now = this.now();
        const record = { value: event.value || 1, type: event.type || "attack", timestamp: now };
        
        player.aggressionHistory.push(record);
        if (player.aggressionHistory.length > 100) player.aggressionHistory.shift();

        const values = player.aggressionHistory.map(e => e.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = values.length ? sum / values.length : 0;

        // Bayesian prior: 0.15 default aggression
        const posterior = (avg * 0.7) + 0.15;
        player.aggressionScore = this.clamp(posterior, 0, 1);
        player.lastUpdate = now;
        await this.write("players", player);
    };

    Colonel.updateStatusActivity = async function(playerID, status) {
        let player = await this.read("players", playerID);
        if (!player) return;

        const now = this.now();
        player.statusTimeline.push({ status, timestamp: now });
        if (player.statusTimeline.length > 200) player.statusTimeline.shift();

        // Decay logic for cleanup
        player.statusTimeline = player.statusTimeline.filter(s => (now - s.timestamp) < (48 * 3600000));

        await this.write("players", player);
    };

    Colonel.computeThreatLevel = async function(playerID) {
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
        
        p.threatTrend = this.computeTrend(p.threatHistory);
        p.lastUpdate = this.now();
        
        await this.write("players", p);
        return threat;
    };

    Colonel.analyzeBehavior = async function(playerID) {
        // Redirect to new pattern engine
        return await this.analyzePlayerPatterns(playerID);
    };

    Colonel.computePlayerRisk = async function(playerID) {
        // Redirect to new risk engine
        return (await this.computeBehavioralRiskProfile(playerID)).risk;
    };

    /* =======================================================
     * 4. FACTION INTELLIGENCE ENGINE
     * ======================================================= */
    Colonel.updateFactionHostility = async function(factionID) {
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
        const posterior = (latest * 0.7) + 0.2; // 0.2 prior

        f.hostilityScore = this.clamp(posterior, 0, 1);
        f.warTrend = this.computeTrend(f.hostilityHistory.map(h => h.value));
        f.lastUpdate = now;
        
        await this.write("factions", f);
        return f.hostilityScore;
    };

    Colonel.ingestFactionMemberAggression = async function(factionID, memberID, value) {
        let f = await this.read("factions", factionID);
        if (!f) return;
        f.memberAggMap = f.memberAggMap || {};
        f.memberAggMap[memberID] = value;
        await this.write("factions", f);
        await this.updateFactionHostility(factionID);
    };

    Colonel.computeFactionRisk = async function(factionID) {
        let f = await this.read("factions", factionID);
        if (!f) return 0;

        const hostility = f.hostilityScore || await this.updateFactionHostility(factionID);
        let clusterFactor = 0.3;
        if (f.warTrend === "rising") clusterFactor = 0.6;
        if (f.warTrend === "falling") clusterFactor = 0.2;

        return this.clamp(hostility * 0.7 + clusterFactor * 0.3, 0, 1);
    };

    /* =======================================================
     * 5. PATTERN RECOGNITION & CLUSTERING
     * ======================================================= */
    Colonel.computeAggressionSlope = function(history) {
        if (!Array.isArray(history) || history.length < 3) return 0;
        const values = history.map(h => h.value || 1);
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i;
        }
        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX + 1e-9);
    };

    Colonel.extractStatusPatterns = function(timeline) {
        if (!Array.isArray(timeline)) return { hospitalCount: 0, travelCount: 0, jailCount: 0, loginDensity: 0 };
        const now = this.now();
        let hospital = 0, travel = 0, jail = 0, active = 0;
        for (const evt of timeline) {
            const age = (now - evt.timestamp) / 60000;
            // PATCHED: Include checks against string includes for safety
            const s = (evt.status || "").toLowerCase();
            if (s.includes("hospital")) hospital++;
            if (s.includes("travel")) travel++;
            if (s.includes("jail")) jail++;
            if (age < 180) active++;
        }
        return { hospitalCount: hospital, travelCount: travel, jailCount: jail, loginDensity: active / 180 };
    };

    Colonel.buildBehaviorVector = function(player) {
        const slope = this.computeAggressionSlope(player.aggressionHistory);
        const status = this.extractStatusPatterns(player.statusTimeline); 
        return [slope, status.hospitalCount, status.travelCount, status.jailCount, status.loginDensity];
    };

    Colonel.classifyBehaviorCluster = function(vector) {
        const centroids = {
            aggressive: [0.8, 1, 0, 0, 0.7],
            mobile: [0.3, 0, 5, 0, 0.6],
            unstable: [0.6, 6, 1, 2, 0.4],
            passive: [0.1, 0, 0, 0, 0.2],
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

    /* [PATCH SET 1A: Advanced Pattern Analysis] */
    Colonel.predictNextBehavior = function(cluster) {
        switch (cluster) {
            case "aggressive": return "likely_attack";
            case "mobile":     return "likely_travel";
            case "unstable":   return "likely_hospital";
            case "chaotic":    return "likely_attack_or_travel";
            case "passive":    return "likely_idle";
            default:           return "unknown";
        }
    };

    Colonel.analyzePlayerPatterns = async function(playerID) {
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

    /* [PATCH SET 1B: Advanced Risk Profile] */
    Colonel.computeLoginPattern = function(player) {
        if (!player || !Array.isArray(player.statusTimeline)) return 0;

        const now = this.now();
        const recent = player.statusTimeline.filter(
            s => now - s.timestamp < 86400000 // last 24h
        );

        const hours = {};
        for (const evt of recent) {
            const h = new Date(evt.timestamp).getHours();
            hours[h] = (hours[h] || 0) + 1;
        }

        const values = Object.values(hours);
        if (!values.length) return 0;

        const maxBin = Math.max(...values);
        const total = values.reduce((a,b)=>a+b,0);
        return maxBin / total; // 0..1 consistency
    };

    Colonel.detectChainBreaker = function(player) {
        if (!player || !Array.isArray(player.aggressionHistory)) return false;

        const last = player.aggressionHistory.slice(-20);
        let hospitalHits = 0;

        for (const evt of last) {
            if (evt.type === "attack" && evt.result === "hospital") {
                hospitalHits++;
            }
        }

        // Heuristic: many recent hospitalizing hits = breaker-ish behavior
        return hospitalHits >= 5;
    };

    Colonel.computeBehavioralRiskProfile = async function(playerID) {
        const p = await this.read("players", playerID);
        if (!p) return { risk: 0, cluster: "unknown" };

        const cluster = p.behaviorCluster || "stable";

        let clusterRisk = 0.3;
        const base = {
            aggressive: 0.8,
            unstable:  0.6,
            chaotic:   0.9,
            mobile:    0.5,
            passive:   0.2
        };
        if (base[cluster] !== undefined) clusterRisk = base[cluster];

        const loginConsistency = this.computeLoginPattern(p);   // 0..1
        const isBreaker        = this.detectChainBreaker(p);    // boolean

        // Higher consistency -> slightly lower risk
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

    Colonel.processPatternIntel = async function(playerID) {
        await this.analyzePlayerPatterns(playerID);
        return await this.computeBehavioralRiskProfile(playerID);
    };

    /* =======================================================
     * 6. ENSEMBLE TARGET SCORING ENGINE
     * ======================================================= */
    Colonel.getBaseModelWeights = function() {
        return this.memory.models["base"] || {
            aggressionWeight: 0.28, threatWeight: 0.24, fairFightWeight: 0.18,
            respectVarianceWeight: 0.12, behavioralRiskWeight: 0.10, clusterWeight: 0.05, factionHostilityWeight: 0.03
        };
    };

    Colonel.computeEnsembleTargetScore = async function(target) {
        // PATCHED: Use internal memory for attacker stats instead of crashing on general.getPlayer()
        const attackerLevel = this.memory.self.level || 1;

        const defenderID = target.id || target.playerID || target.player_id;
        const defenderLevel = target.level || 1;
        const status = target.status || "Okay";
        const factionID = target.factionID || target.faction_id;

        // 1. Fair Fight & Status
        const diff = defenderLevel - attackerLevel;
        const ff = this.clamp(Math.exp(-Math.pow(diff / 10, 2)), 0, 1);
        
        let statusMult = 0.5;
        const s = String(status).toLowerCase();
        if (s === "okay" || s === "ok" || s === "online") statusMult = 1.0;
        else if (s.includes("travel")) statusMult = 0.4;
        else if (s.includes("hospital")) statusMult = 0.2;
        else if (s.includes("jail")) statusMult = 0.1;

        // 2. Database Lookups
        const playerRecord = defenderID ? await this.read("players", defenderID) : null;
        
        // 3. Risk Weights
        const playerRisk = playerRecord ? (await this.computeBehavioralRiskProfile(defenderID)).risk : 0.5;
        const factionRisk = factionID ? await this.computeFactionRisk(factionID) : 0.2;

        const scoreBehRisk = 1 - playerRisk; // Invert: Higher score = Lower risk
        const scoreFacHost = 1 - factionRisk;

        // 4. Weights & Assembly
        const W = this.getBaseModelWeights();
        
        const ensemble =
            ff * W.fairFightWeight +
            (statusMult) * 0.25 + 
            scoreBehRisk * W.behavioralRiskWeight +
            scoreFacHost * W.factionHostilityWeight +
            0.05;

        const finalScore = this.clamp(ensemble, 0, 1);

        if (defenderID) {
            await this.storeScore(defenderID, finalScore, { fairFight: ff, risk: playerRisk });
        }

        return { score: finalScore };
    };

    /* [PATCH 0: Missing Score Wrapper] */
    Colonel.computeTargetScore = function(target) {
        // Wrapper returning just the numeric score
        return this.computeEnsembleTargetScore(target)
            .then(result => result.score)
            .catch(e => {
                this.warn("Score error:", e);
                return 0;
            });
    };

    Colonel.scoreTargetList = async function(targets) {
        if (!Array.isArray(targets)) return [];
        const out = [];
        for (const t of targets) {
            const { score } = await this.computeEnsembleTargetScore(t);
            out.push({ ...t, colonelScore: score });
        }
        return out.sort((a, b) => b.colonelScore - a.colonelScore);
    };

    /* =======================================================
     * 7. EVENT INTELLIGENCE
     * ======================================================= */
    Colonel.logEvent = async function(ev) {
        const data = {
            playerID: ev.playerID || null,
            factionID: ev.factionID || null,
            type: ev.type || "unknown",
            value: ev.value || 1,
            timestamp: this.now()
        };
        await this.write("events", data);
    };

    Colonel.readLastEvents = async function(limit = 100) {
        const all = await this.readAll("events");
        return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    };

    /* [PATCH SET 2A: Heatmaps & Global Sitrep] */
    Colonel.computeEventHeatmap = function(events) {
        const map = Array(24).fill(0);
        for (const ev of events) {
            const hour = new Date(ev.timestamp).getHours();
            map[hour] += (ev.value || 1);
        }
        return map;
    };

    Colonel.computeEventTrend = function(events) {
        if (!events || !events.length) return "stable";
        const values = events.map(e => e.value || 1);
        return this.computeTrend(values);
    };

    Colonel.generateGlobalSitrep = async function() {
        const events = await this.readLastEvents(200);
        const now = this.now();
        const trend = this.computeEventTrend(events);
        const heatmap = this.computeEventHeatmap(events);

        const lastHour = events.filter(e => now - e.timestamp < 3600000).length;
        const last24h = events.filter(e => now - e.timestamp < 86400000).length;
        const last6h  = events.filter(e => now - e.timestamp < 21600000).length;

        return {
            trend,
            heatmap,
            lastHour,
            last6h,
            last24h
        };
    };

    /* [PATCH SET 2B: Player & Faction Sitreps] */
    Colonel.getEventsForPlayer = async function(playerID, limit = 100) {
        const all = await this.readAll("events");
        const filtered = all.filter(e => e.playerID === playerID);
        return filtered.sort((a,b)=>b.timestamp - a.timestamp).slice(0, limit);
    };

    Colonel.getEventsForFaction = async function(factionID, limit = 200) {
        const all = await this.readAll("events");
        const filtered = all.filter(e => e.factionID === factionID);
        return filtered.sort((a,b)=>b.timestamp - a.timestamp).slice(0, limit);
    };

    Colonel.getPlayerActivityHeatmap = async function(playerID) {
        const events = await this.getEventsForPlayer(playerID, 200);
        return this.computeEventHeatmap(events);
    };

    Colonel.generatePlayerSitrep = async function(playerID) {
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

    Colonel.getFactionHostilityTimeline = async function(factionID) {
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
        return out.sort((a,b)=>a.ageHours - b.ageHours);
    };

    Colonel.generateFactionSitrep = async function(factionID) {
        const f = await this.read("factions", factionID);
        if (!f) return { error: "Faction not found" };

        const events = await this.getEventsForFaction(factionID, 200);
        const timeline = await this.getFactionHostilityTimeline(factionID);
        const trend = this.computeEventTrend(events);

        const avgHostility = f.hostilityHistory?.length
            ? f.hostilityHistory.reduce((a,b)=>a + b.value, 0) / f.hostilityHistory.length
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
     * 8. GUIDES & NLP
     * ======================================================= */
    Colonel.cleanGuide = function(text) {
        if (!text) return "";
        return text.replace(/\[.*?\]/g, "").replace(/https?:\/\/\S+/g, "").replace(/<[^>]*>/g, "").replace(/\s{2,}/g, " ").trim();
    };

    Colonel.classifyGuide = function(text) {
        text = text.toLowerCase();
        if (text.includes("crime") || text.includes("nerve")) return "crime";
        if (text.includes("gym") || text.includes("train")) return "training";
        if (text.includes("chain") || text.includes("respect")) return "chain";
        if (text.includes("faction")) return "faction";
        if (text.includes("war")) return "war";
        return "general";
    };

    Colonel.chunkGuide = function(text, size = 500) {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
        return chunks;
    };

    Colonel.ingestGuide = async function(name, text) {
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

    /* [PATCH SET 3A: Advanced QA Helpers] */
    Colonel.indexGuides = async function() {
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

    Colonel.extractGuideTips = function(guides) {
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
        return actionable.slice(0,3).join(". ") + ".";
    };

    Colonel.handleTargetQuestion = async function(q) {
        const levelMatch = q.match(/level\s*(\d+)/);
        if (levelMatch) {
            const lvl = parseInt(levelMatch[1],10);
            return "Ideal target around level " + lvl +
                " is one with a strong fair-fight score and low behavioral risk.";
        }

        if (q.includes("who") && q.includes("hit")) {
            return "Check the Targets tab: Colonel sorts targets by respect potential and risk profile.";
        }

        if (q.includes("best") && q.includes("target")) {
            return "The best target is the one with highest ColonelScore that your faction can safely hit.";
        }

        return "Specify level or describe the target type for more detail.";
    };

    Colonel.advise = async function(topic, context = {}) {
        topic = (topic || "").toLowerCase();

        if (topic.includes("train") || topic.includes("gym")) {
            return "Train your highest stat unless your spread is too skewed; then reinforce your weakest for better gains.";
        }

        if (topic.includes("respect") || topic.includes("chain")) {
            return "Prioritize okay-status enemies with moderate level and low faction hostility for best respect return.";
        }

        if (topic.includes("war")) {
            return "Focus fire on hostile factions with rising trends only if you can sustain chains; otherwise exploit fading factions.";
        }

        if (topic.includes("crime")) {
            return "Run low-risk crimes to stabilize nerve, then mix in higher tiers as success rates improve.";
        }

        return "I require more context to advise properly.";
    };

    /* [PATCH SET 3B: Full Router] */
    Colonel.answerQuestion = async function(question) {
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
     * 9. SIGNAL LISTENERS (INGESTION)
     * ======================================================= */
    Colonel.ingestIntel = async function(intel) {
        if (!intel) return;
        if (intel.player) {
            const pid = intel.player.id || intel.player.player_id;
            
            // PATCHED: Capture level for fair fight calculations
            if(intel.player.level) intel.player.level = parseInt(intel.player.level, 10);
            
            await this.ensurePlayer(pid, intel.player);
            // If we have intel, trigger analysis immediately
            await this.analyzeBehavior(pid);
        }
        if (intel.faction) {
            const fid = intel.faction.id || intel.faction.faction_id;
            await this.ensureFaction(fid, intel.faction);
        }
    };

    Colonel.attachGeneralListeners = function() {
        if (!this.general) return;

        this.general.signals.listen("RAW_INTEL", intel => this.ingestIntel(intel));
        
        // PATCHED: Added listener for User Sitrep to cache self stats
        this.general.signals.listen("USER_SITREP", us => {
            this.memory.self.status = us.status;
            // Note: level is usually not in sitrep, but status is critical for scoring
        });

        this.general.signals.listen("REQUEST_TARGET_SCORES", async payload => {
            const list = payload?.targets || [];
            const scored = await this.scoreTargetList(list);
            this.general.signals.dispatch("TARGET_SCORES_READY", { original: list, scored });
        });

        this.general.signals.listen("REQUEST_GLOBAL_SITREP", async () => {
            const data = await this.generateGlobalSitrep();
            this.general.signals.dispatch("GLOBAL_SITREP_READY", data);
        });

        this.general.signals.listen("ASK_COLONEL", async payload => {
            if (!payload?.question) return;
            const answer = await this.answerQuestion(payload.question);
            this.general.signals.dispatch("COLONEL_ANSWER", { question: payload.question, answer });
        });
    };

    /* [PATCH SET 4A: Missing Listeners] */
    Colonel.attachPlayerListeners = function() {
        if (!this.general) return;

        // PATCHED: Changed 'PLAYER_DATA' to 'RAW_INTEL' to match Core
        this.general.signals.listen("RAW_INTEL", pdata => {
            // Original logic checks here
            if (!pdata || !pdata.player) return; // Defensive check
            
            // Re-mapping original logic to work with raw intel structure
            const p = pdata.player;
            const id = p.id || p.player_id;
            if (!id) return;
            
            this.ensurePlayer(id, p).then(()=>{
                this.analyzeBehavior(id);
                this.computeThreatLevel(id);
                this.processPatternIntel(id);
            });
        });
    };

    Colonel.attachFactionListeners = function() {
        if (!this.general) return;

        // PATCHED: Changed 'FACTION_DATA' to 'RAW_INTEL' check
        this.general.signals.listen("RAW_INTEL", data => {
            if (!data || !data.faction) return;
            const f = data.faction;
            const fid = f.id || f.faction_id;
            if (!fid) return;
            this.ensureFaction(fid, f).then(()=>{
                this.updateFactionHostility(fid);
            });
        });
    };

    Colonel.attachPatternListeners = function() {
        if (!this.general) return;

        this.general.signals.listen("RAW_INTEL", intel => {
            if (!intel || !intel.player) return;
            const id = intel.player.id || intel.player.player_id;
            if (!id) return;
            this.processPatternIntel(id);
        });
    };

    Colonel.attachEventListeners = function() {
        if (!this.general) return;

        // OPTIONAL: if you emit events from General/Major in future:
        this.general.signals.listen("LOG_EVENT", ev => {
            if (!ev) return;
            this.logEvent(ev);
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

    Colonel.attachQAListeners = function() {
        if (!this.general) return;

        this.general.signals.listen("REQUEST_ADVICE", async payload => {
            const topic = payload?.topic || "";
            const context = payload?.context || {};
            const result = await this.advise(topic, context);
            this.general.signals.dispatch("ADVICE_READY", { topic, result });
        });
l/**
 * WAR_COLONEL v3.2
 * ----------------------------------------------------
 * ROLE: Senior Tactical Officer (Ultra-AI Logic Engine)
 *
 * RESPONSIBILITIES:
 *   • Analyze RAW_INTEL (normalized by General)
 *   • Produce CHAIN_SITREP
 *   • Produce FACTION_THREAT_SITREP
 *   • Produce WAR_SITREP (complete war intel)
 *   • Score targets on-demand
 *   • Detect threat levels, pace, danger, patterns
 *
 * PATCHES INCLUDED:
 *   ✔ Re-init safe with cleanup()
 *   ✔ Listeners stored and cleared
 *   ✔ WAR_SITREP output
 *   ✔ REQUEST_TARGET_SCORES → TARGET_SCORES_READY
 *   ✔ Full chain intelligence model
 *   ✔ Simple faction threat modeling
 */

(function () {

    const Colonel = {
        general: null,
        listeners: [],
        intervals: [],

        chainState: {
            hits: 0,
            timeout: 0,
            paceHistory: [],
            lastUpdate: 0,
        },

        // ============= INIT ================
        init(General) {
            this.cleanup();
            this.general = General;

            this.registerListeners();

            console.log("%c[Colonel v3.2] Tactical AI Online", "color:#f66");
        },

        // ============= CLEANUP =============
        cleanup() {
            if (this.listeners.length) {
                this.listeners.forEach(unsub => { try { unsub(); } catch {} });
                this.listeners = [];
            }
            this.intervals.forEach(id => clearInterval(id));
            this.intervals = [];
        },

        // ========== LISTENER WRAPPER ==========
        listen(ev, fn) {
            this.general.signals.listen(ev, fn);

            const unsub = () => {
                const bus = this.general.signals._internal?.[ev];
                if (!bus) return;
                const i = bus.indexOf(fn);
                if (i >= 0) bus.splice(i, 1);
            };

            this.listeners.push(unsub);
        },

        // ============ MAIN LISTENERS ============
        registerListeners() {
            // RAW INTEL FEED
            this.listen("RAW_INTEL", intel => this.ingestIntel(intel));

            // SCORE REQUESTS FROM MAJOR
            this.listen("REQUEST_TARGET_SCORES", payload => {
                this.processTargetScores(payload.targets);
            });
        },

        // ============= RAW INTEL INGESTION =============
        ingestIntel(data) {
            if (!data) return;

            // Chain
            if (data.chain) this.processChain(data.chain);

            // Faction
            if (data.faction) this.processFaction(data.faction);

            // War (enemy derived from faction + chain + user)
            this.processWar(data);
        },

    /* --------------------------------------------------------
     * CHAIN ENGINE
     * -------------------------------------------------------- */

        processChain(chain) {
            const now = Date.now();

            // History tracking for pace
            const delta = chain.current - this.chainState.hits;
            if (delta > 0) {
                this.chainState.paceHistory.push({
                    time: now,
                    hits: delta
                });
            }

            // Keep history short
            const cutoff = now - 60000; // 1m
            this.chainState.paceHistory = this.chainState.paceHistory.filter(p => p.time > cutoff);

            // Calculate pace
            const totalHits = this.chainState.paceHistory.reduce((a, c) => a + c.hits, 0);
            const pacePerMin = totalHits; // hits/min

            // Drop risk logic
            let risk = "Low";
            if (chain.timeout < 50) risk = "Medium";
            if (chain.timeout < 30) risk = "High";
            if (chain.timeout < 15) risk = "Critical";

            const sitrep = {
                chainID: chain.current > 0 ? 1 : 0,
                hits: chain.current,
                timeLeft: chain.timeout,
                currentPace: pacePerMin,
                requiredPace: 0, // can be enhanced later
                dropRisk: risk,
                warning: risk === "Critical" ? "CHAIN AT RISK" : "OK",
                message: risk === "Critical" ? "Time is nearly out." : ""
            };

            this.general.signals.dispatch("CHAIN_SITREP", sitrep);

            this.chainState.hits = chain.current;
            this.chainState.timeout = chain.timeout;
            this.chainState.lastUpdate = now;
        },

    /* --------------------------------------------------------
     * FACTION ENGINE
     * -------------------------------------------------------- */

        processFaction(faction) {
            const members = faction.members || {};
            let online = 0, hosp = 0, jail = 0, watchers = 0;

            Object.values(members).forEach(m => {
                if (!m) return;

                const status = (m.status?.state || "").toLowerCase();
                if (m.lastSeen && Date.now() - m.lastSeen < 600000) online++;
                if (status.includes("hospital")) hosp++;
                if (status.includes("jail")) jail++;
                if (m.watching) watchers++;
            });

            const fSitrep = {
                id: faction.id,
                name: faction.name,
                online,
                hospital: hosp,
                jail,
                watchers
            };

            this.general.signals.dispatch("FACTION_SITREP", fSitrep);
        },

    /* --------------------------------------------------------
     * WAR ENGINE
     * -------------------------------------------------------- */

        processWar(unified) {
            // We expect:
            // unified.user (optional)
            // unified.faction (optional)
            // unified.chain (optional)

            const faction = unified.faction || {};
            const chain = unified.chain || {};

            // Enemy modeling: treat faction enemies as "targets"
            const enemyTargets = this.deriveEnemyTargets(faction);

            const {
                enemyOnline,
                enemyHospital,
                enemyJail,
                enemyTravel,
                threat,
                danger
            } = this.deriveEnemyStats(enemyTargets, chain);

            const sitrep = {
                state: chain.current > 0 ? "CHAINING" : "PEACE",
                chainPower: chain.modifier || 1,

                enemyOnline,
                enemyHospital,
                enemyJail,
                enemyTravel,

                threat,
                danger,

                message: danger === "Extreme" ? "Immediate caution required." : "Stable",

                topScore: 0,
                targets: enemyTargets
            };

            // Call scoring for the enemy targets
            const ids = enemyTargets.map(t => t.id).join(",");
            sitrep.topScoreHash = ids; // Useful for diff in Major

            // Score internally
            const scored = this.scoreTargetList(enemyTargets);
            sitrep.targets = scored;
            sitrep.topScore = scored.length ? scored[0].colonelScore : 0;

            this.general.signals.dispatch("WAR_SITREP", sitrep);
        },

        deriveEnemyTargets(faction) {
            const members = faction.members || {};
            const out = [];

            Object.values(members).forEach(m => {
                if (!m) return;

                const t = {
                    id: m.userID,
                    name: m.name || "Unknown",
                    level: m.level || 0,
                    faction: faction.name,
                    status: m.status?.state || "Okay",
                    timer: m.status?.until || 0,
                    lastSeen: m.lastSeen || 0
                };

                out.push(t);
            });

            return out;
        },

        deriveEnemyStats(list, chain) {
            let online = 0, hosp = 0, jail = 0, travel = 0;

            list.forEach(t => {
                const s = (t.status || "").toLowerCase();
                if (Date.now() - (t.lastSeen || 0) < 600000) online++;
                if (s.includes("hospital")) hosp++;
                if (s.includes("jail")) jail++;
                if (s.includes("travel")) travel++;
            });

            // threat uses simple model (can be made more advanced)
            let threat = online + (chain.current > 0 ? 5 : 0);
            let danger = "Low";

            if (threat > 10) danger = "Medium";
            if (threat > 20) danger = "High";
            if (threat > 30) danger = "Extreme";

            return {
                enemyOnline: online,
                enemyHospital: hosp,
                enemyJail: jail,
                enemyTravel: travel,
                threat,
                danger
            };
        },

    /* --------------------------------------------------------
     * TARGET SCORING ENGINE
     * -------------------------------------------------------- */

        scoreTargetList(list) {
            return list.map(t => {
                const score = this.scoreTarget(t);
                return { ...t, colonelScore: score };
            }).sort((a, b) => b.colonelScore - a.colonelScore);
        },

        scoreTarget(t) {
            let s = 0;

            // ---- SIMPLE COMBAT RELEVANCE ----
            if (t.status.toLowerCase().includes("hospital")) s -= 20;
            if (t.status.toLowerCase().includes("jail")) s -= 15;
            if (t.status.toLowerCase().includes("travel")) s -= 10;

            // Threat level by level
            s += t.level * 2;

            // Freshness (recent activity)
            if (t.lastSeen && Date.now() - t.lastSeen < 600000) s += 10;

            // Online enemies during chain are higher priority
            if (Date.now() - (t.lastSeen || 0) < 600000) s += 5;

            // Passive cooldown
            if (t.timer > 0) s -= Math.min(20, t.timer / 1000);

            return Math.max(0, Math.floor(s));
        },

        processTargetScores(list) {
            if (!list || !list.length) return;

            const scored = this.scoreTargetList(list);

            this.general.signals.dispatch("TARGET_SCORES_READY", {
                scored
            });
        }
    };

    // REGISTER WITH GENERAL
    if (window.WAR_GENERAL) {
        WAR_GENERAL.register("Colonel", Colonel);
    } else {
        console.warn("[WAR_COLONEL] WAR_GENERAL missing – Colonel not registered.");
    }

})();
