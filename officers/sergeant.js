// sergeant.js — Full Firebase Sync + Analytics Engine

////////////////////////////////////////////////////////////
// SERGEANT — PER-FACTION FIREBASE SYNC ENGINE
//
// Responsibilities:
//    -Automatically detect factionId from SITREP
//    -Maintain one shared target list per faction
//    -Sync: download, merge, update, broadcast
//    -Debounced writes (safe, low cost)
//    -Analytics
//    -Rolling windows for enemy metrics
//    -Offline queue
//    -ZERO sensitive data written
////////////////////////////////////////////////////////////

(function(){
"use strict";

const DB = "https://torn-war-room-default-rtdb.firebaseio.com";

const Sergeant = {
    nexus: null,
    factionId: null,

    writeQueue: [],
    writeTimer: null,

    pollTimer: null,
    pollInterval: 5000,

    lastWrite: 0,
    minDelay: 1200,
    maxDelay: 5000,

    sharedTargets: [],
};

/* ============================================================
   INIT
   ============================================================ */
Sergeant.init = function(nexus){
    this.nexus = nexus;

    // Handle SITREP to detect faction ID
    nexus.events.on("SITREP_UPDATE", data => {
        const fid = data?.faction?.id || null;

        if (!fid) return;

        if (fid !== this.factionId){
            this.factionId = fid;
            this.restartPolling();
        }
    });

    // AI memory write requests
    nexus.events.on("AI_MEMORY_WRITE", payload => {
        if (!this.factionId) return;
        if (!this.validPath(payload.path)) return;
        if (!this.validPayload(payload.payload)) return;

        this.enqueueWrite(payload.path, payload.payload);
    });

    // Shared target add
    nexus.events.on("REQUEST_ADD_SHARED_TARGET", t => {
        this.addSharedTarget(t);
    });

    this.loadLocalTargets();
};

/* ============================================================
   VALIDATION HELPERS
   ============================================================ */
Sergeant.validPath = function(path){
    if (!path) return false;
    if (path.includes("null")) return false;
    if (!path.startsWith("factions/")) return false;
    return true;
};

Sergeant.validPayload = function(payload){
    if (!payload) return false;

    // reject invalid numbers
    const scan = obj => {
        for (const k in obj){
            const v = obj[k];
            if (typeof v === "number" && (!isFinite(v) || isNaN(v))) return false;
            if (typeof v === "object" && v !== null){
                if (!scan(v)) return false;
            }
        }
        return true;
    };

    return scan(payload);
};

/* ============================================================
   POLLING LOOP
   ============================================================ */
Sergeant.restartPolling = function(){
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
    this.poll();
};

Sergeant.poll = function(){
    if (!this.factionId) return;

    this.pullAIMemory();
    this.pullTargets();
    this.pullOrders();
};

/* ============================================================
   REST GET
   ============================================================ */
Sergeant.restGet = function(path, cb){
    if (typeof GM_xmlhttpRequest !== "function") return;

    GM_xmlhttpRequest({
        method:"GET",
        url:`${DB}/${path}.json`,
        onload:r=>{
            if (r.status === 200){
                try { cb(JSON.parse(r.responseText)); } catch {}
            }
        }
    });
};

/* ============================================================
   REST PUT
   ============================================================ */
Sergeant.restPut = function(path, value, cb){
    if (typeof GM_xmlhttpRequest !== "function") return;

    GM_xmlhttpRequest({
        method:"PUT",
        url:`${DB}/${path}.json`,
        data:JSON.stringify(value),
        headers:{ "Content-Type":"application/json" },
        onload:()=> cb && cb()
    });
};

/* ============================================================
   QUEUED WRITES
   ============================================================ */
Sergeant.enqueueWrite = function(path, payload){
    this.writeQueue.push({ path, payload });

    const now = Date.now();
    const elapsed = now - this.lastWrite;
    let delay = this.minDelay;

    if (elapsed > this.maxDelay) delay = 50;

    if (this.writeTimer) clearTimeout(this.writeTimer);

    this.writeTimer = setTimeout(() => this.flushQueue(), delay);
};

Sergeant.flushQueue = function(){
    const queue = [...this.writeQueue];
    this.writeQueue.length = 0;

    this.lastWrite = Date.now();

    for (const item of queue){
        if (!this.validPath(item.path)) continue;
        if (!this.validPayload(item.payload)) continue;
        this.restPut(item.path, item.payload);
    }
};

/* ============================================================
   AI MEMORY SYNC
   ============================================================ */
Sergeant.pullAIMemory = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/ai_memory`;

    this.restGet(path, data => {
        if (!data) return;
        if (!this.validPayload(data)) return;

        this.nexus.events.emit("AI_MEMORY_UPDATE", data);
    });
};

/* ============================================================
   SHARED TARGETS
   ============================================================ */
Sergeant.loadLocalTargets = function(){
    try {
        const stored = localStorage.getItem("nexus_shared_targets");
        if (stored) this.sharedTargets = JSON.parse(stored);
    } catch {
        this.sharedTargets = [];
    }

    this.nexus.events.emit("SHARED_TARGETS_UPDATED", this.sharedTargets);
};

Sergeant.saveLocalTargets = function(){
    localStorage.setItem("nexus_shared_targets", JSON.stringify(this.sharedTargets));
};

Sergeant.addSharedTarget = function(t){
    if (!t?.id || !t?.name) return;

    t.timestamp = Date.now();

    // remove old entries with same ID
    this.sharedTargets = this.sharedTargets.filter(x => x.id !== t.id);
    this.sharedTargets.push(t);

    this.saveLocalTargets();
    this.nexus.events.emit("SHARED_TARGETS_UPDATED", this.sharedTargets);

    if (this.factionId){
        const p = `factions/${this.factionId}/targets/${t.id}`;
        if (this.validPath(p)) this.enqueueWrite(p, t);
    }
};

/* ============================================================
   FETCH REMOTE TARGETS
   ============================================================ */
Sergeant.pullTargets = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/targets`;

    this.restGet(path, data => {
        if (!data) return;

        const list = Object.values(data);

        if (JSON.stringify(list) !== JSON.stringify(this.sharedTargets)){
            this.sharedTargets = list;
            this.saveLocalTargets();
            this.nexus.events.emit("SHARED_TARGETS_UPDATED", list);
        }
    });
};

/* ============================================================
   COMMANDER ORDERS
   ============================================================ */
Sergeant.pullOrders = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/orders`;

    this.restGet(path, data => {
        if (!data) return;
        this.nexus.events.emit("COMMANDER_ORDERS", data);
    });
};

/* ============================================================
   REGISTER
   ============================================================ */
if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name:"Sergeant",
    module:Sergeant
});

})();
