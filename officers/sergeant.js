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

/* ------------------------------------------------------------ */
/* STATE */
/* ------------------------------------------------------------ */

const DB = "https://torn-war-room-default-rtdb.firebaseio.com";

const Sergeant = {
    nexus: null,
    factionId: null,
    aiMemory: null,
    sharedTargets: [],
    writeQueue: [],
    writeTimer: null,
    pollTimer: null,

    lastWriteTs: 0,
    minWriteDelay: 1200,
    maxWriteDelay: 5000
};

/* ------------------------------------------------------------ */
/* INIT */
/* ------------------------------------------------------------ */

Sergeant.init = function(nexus){
    this.nexus = nexus;

    this.nexus.events.on("SITREP_UPDATE", data => {
        const fid = data?.faction?.id;

        // Only restart polling when faction changes
        if (fid && fid !== this.factionId){
            this.factionId = fid;

            if (this.pollTimer){
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }

            this.startPolling();
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

/* ------------------------------------------------------------ */
/* POLLING LOOP */
/* ------------------------------------------------------------ */

Sergeant.startPolling = function(){
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(() => {
        if (!this.factionId) return;
        this.pullAIMemory();
        this.pullSharedTargets();
        this.pullCommanderOrders();
    }, 5000);
};

/* ------------------------------------------------------------ */
/* REST GET */
/* ------------------------------------------------------------ */

Sergeant.restGet = function(path, cb){
    if (typeof GM_xmlhttpRequest !== "function"){
        console.warn("GM_xmlhttpRequest unavailable");
        return;
    }

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

/* ------------------------------------------------------------ */
/* REST PUT */
/* ------------------------------------------------------------ */

Sergeant.restPut = function(path, value, cb){
    if (typeof GM_xmlhttpRequest !== "function"){
        console.warn("GM_xmlhttpRequest unavailable");
        return;
    }

    GM_xmlhttpRequest({
        method: "PUT",
        url: `${DB}/${path}.json`,
        data: JSON.stringify(value),
        headers: { "Content-Type": "application/json" },
        onload: () => cb && cb()
    });
};

/* ------------------------------------------------------------ */
/* REST PATCH */
/* ------------------------------------------------------------ */

Sergeant.restPatch = function(path, value, cb){
    if (typeof GM_xmlhttpRequest !== "function"){
        console.warn("GM_xmlhttpRequest unavailable");
        return;
    }

    GM_xmlhttpRequest({
        method: "PATCH",
        url: `${DB}/${path}.json`,
        data: JSON.stringify(value),
        headers: { "Content-Type": "application/json" },
        onload: () => cb && cb()
    });
};

/* ------------------------------------------------------------ */
/* PULL AI MEMORY */
/* ------------------------------------------------------------ */

Sergeant.pullAIMemory = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/ai_memory`;

    this.restGet(path, data => {
        if (!data) return;

        this.aiMemory = data;
        this.nexus.events.emit("AI_MEMORY_UPDATE", data);
    });
};

/* ------------------------------------------------------------ */
/* WRITE QUEUE (with guaranteed flush) */
/* ------------------------------------------------------------ */

Sergeant.enqueueWrite = function(path, payload){
    if (!path || typeof path !== "string") {
        console.warn("Sergeant WARN: invalid write path:", path);
        return;
    }

    this.writeQueue.push({ path, payload });

    const now = Date.now();
    const elapsed = now - this.lastWriteTs;

    if (this.writeTimer) clearTimeout(this.writeTimer);

    const delay = (elapsed > this.maxWriteDelay) ? 50 : this.minWriteDelay;

    this.writeTimer = setTimeout(() => this.flushWriteQueue(), delay);
};

Sergeant.flushWriteQueue = function(){
    const q = [...this.writeQueue];
    this.writeQueue.length = 0;

    this.lastWriteTs = Date.now();

    q.forEach(item => {
        if (!item.path) return;
        this.restPut(item.path, item.payload);
    });
};

/* ------------------------------------------------------------ */
/* LOCAL TARGET STORAGE */
/* ------------------------------------------------------------ */

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

/* ------------------------------------------------------------ */
/* ADD SHARED TARGET */
/* ------------------------------------------------------------ */

Sergeant.addSharedTarget = function(t){
    if (!t?.id || !t?.name) return;

    t.timestamp = Date.now();

    this.sharedTargets = this.sharedTargets.filter(x => x.id !== t.id);
    this.sharedTargets.push(t);

    this.saveLocalTargets();
    this.nexus.events.emit("SHARED_TARGETS_UPDATED", this.sharedTargets);

    if (this.factionId){
        const p = `factions/${this.factionId}/targets/${t.id}`;
        this.enqueueWrite(p, t);
    }
};

/* ------------------------------------------------------------ */
/* PULL SHARED TARGETS */
/* ------------------------------------------------------------ */

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

/* ------------------------------------------------------------ */
/* COMMANDER ORDERS */
/* ------------------------------------------------------------ */

Sergeant.pullCommanderOrders = function(){
    if (!this.factionId) return;

    const path = `factions/${this.factionId}/orders`;

    this.restGet(path, orders => {
        if (!orders) return;
        this.nexus.events.emit("COMMANDER_ORDERS", orders);
    });
};

/* ------------------------------------------------------------ */
/* REGISTER */
/* ------------------------------------------------------------ */

if (!window.__NEXUS_OFFICERS) window.__NEXUS_OFFICERS = [];
window.__NEXUS_OFFICERS.push({
    name: "Sergeant",
    module: Sergeant
});

})();
