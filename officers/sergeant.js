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

/* BLOCK: STATE */

const DB = "https://torn-war-room-default-rtdb.firebaseio.com";

const Sergeant = {
    nexus: null,
    factionId: null,
    aiMemory: null,
    sharedTargets: [],
    writeQueue: [],
    writeTimer: null,
    pollTimer: null
};

/* BLOCK: INIT */

Sergeant.init = function(nexus){
    this.nexus = nexus;

    this.nexus.events.on("SITREP_UPDATE", data => {
        const fid = data?.faction?.id;

        // PATCH: prevent duplicate polling timers
        if (fid && fid !== this.factionId){
            this.factionId = fid;

            if (this.pollTimer) {
                clearInterval(this.pollTimer);  // PATCH
                this.pollTimer = null;
            }

            this.startPolling();  // guaranteed single instance
        }
    });

    this.nexus.events.on("AI_MEMORY_WRITE", payload => {
        if (!this.factionId) return;
        this.enqueueWrite(payload.path, payload.payload);
    });

    this.nexus.events.on("REQUEST_ADD_SHARED_TARGET", t => {
        this.addSharedTarget(t);
    });

    this.loadLocalTargets();
};

/* BLOCK: POLLING */

Sergeant.startPolling = function(){
    if (this.pollTimer) clearInterval(this.pollTimer); // PATCH: double safety

    this.pollTimer = setInterval(() => {
        if (!this.factionId) return;
        this.pullAIMemory();
        this.pullSharedTargets();
        this.pullCommanderOrders();
    }, 5000);
};

/* BLOCK: REST GET */

Sergeant.restGet = function(path, cb){
    GM_xmlhttpRequest({
        method: "GET",
        url: `${DB}/${path}.json`,
        onload: r => {
            if (r.status === 200){
                try { cb(JSON.parse(r.responseText)); }
                catch {}
            }
        }
    });
};

/* BLOCK: REST PUT */

Sergeant.restPut = function(path, value, cb){
    GM_xmlhttpRequest({
        method: "PUT",
        url: `${DB}/${path}.json`,
        data: JSON.stringify(value),
        headers: { "Content-Type": "application/json" },
        onload: () => cb && cb()
    });
};

/* BLOCK: REST PATCH */

Sergeant.restPatch = function(path, value, cb){
    GM_xmlhttpRequest({
        method: "PATCH",
        url: `${DB}/${path}.json`,
        data: JSON.stringify(value),
        headers: { "Content-Type": "application/json" },
        onload: () => cb && cb()
    });
};

/* BLOCK: AI MEMORY PULL */

Sergeant.pullAIMemory = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/ai_memory`;

    this.restGet(path, data => {
        if (!data) return;

        this.aiMemory = data;
        this.nexus.events.emit("AI_MEMORY_UPDATE", data);
    });
};

/* BLOCK: AI MEMORY WRITE QUEUE */

Sergeant.enqueueWrite = function(path, payload){

    // PATCH: ensure path safety
    if (!path || typeof path !== "string") {
        console.warn("Sergeant WARN: invalid AI memory write path:", path);
        return;
    }

    this.writeQueue.push({ path, payload });

    if (this.writeTimer) clearTimeout(this.writeTimer);

    this.writeTimer = setTimeout(() => this.flushWriteQueue(), 1200);
};

Sergeant.flushWriteQueue = function(){
    const q = [...this.writeQueue];
    this.writeQueue.length = 0;

    q.forEach(item => {
        // PATCH: validate path again
        if (!item.path) return;
        this.restPut(item.path, item.payload);
    });
};

/* BLOCK: SHARED TARGETS LOCAL */

Sergeant.loadLocalTargets = function(){
    try {
        const raw = localStorage.getItem("nexus_shared_targets");
        if (raw) this.sharedTargets = JSON.parse(raw);
    } catch {
        this.sharedTargets = [];
    }

    this.nexus.events.emit("SHARED_TARGETS_UPDATED", this.sharedTargets);
};

Sergeant.saveLocalTargets = function(){
    localStorage.setItem("nexus_shared_targets", JSON.stringify(this.sharedTargets));
};

/* BLOCK: SHARED TARGETS ADD */

Sergeant.addSharedTarget = function(t){
    if (!t?.id || !t?.name) return;

    t.timestamp = Date.now();

    // Ensure no duplicates
    this.sharedTargets = this.sharedTargets.filter(x => x.id !== t.id);
    this.sharedTargets.push(t);

    this.saveLocalTargets();

    this.nexus.events.emit("SHARED_TARGETS_UPDATED", this.sharedTargets);

    if (this.factionId){
        const p = `factions/${this.factionId}/targets/${t.id}`;
        this.enqueueWrite(p, t);
    }
};

/* BLOCK: SHARED TARGETS PULL */

Sergeant.pullSharedTargets = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/targets`;

    this.restGet(path, data => {
        if (!data) return;

        const list = Object.values(data);
        const local = JSON.stringify(this.sharedTargets);
        const remote = JSON.stringify(list);

        if (local !== remote){
            this.sharedTargets = list;
            this.saveLocalTargets();
            this.nexus.events.emit("SHARED_TARGETS_UPDATED", this.sharedTargets);
        }
    });
};

/* BLOCK: COMMANDER ORDERS */

Sergeant.pullCommanderOrders = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/orders`;

    this.restGet(path, orders => {
        if (!orders) return;
        this.nexus.events.emit("COMMANDER_ORDERS", orders);
    });
};

/* BLOCK: REGISTRATION */

if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];

window.__NEXUS_OFFICERS.push({
    name: "Sergeant",
    module: Sergeant
});

})();
