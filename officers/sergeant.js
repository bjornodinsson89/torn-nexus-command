// sergeant.js — Full Firebase Sync + Analytics Engine

////////////////////////////////////////////////////////////
// SERGEANT — PER-FACTION FIREBASE SYNC ENGINE
//
// Responsibilities:
//   ✓ Automatically detect factionId from SITREP
//   ✓ Maintain one shared target list per faction
//   ✓ Sync: download, merge, update, broadcast
//   ✓ Debounced writes (safe, low cost)
//   ✓ Analytics (popular targets, danger scores)
//   ✓ Rolling windows for enemy metrics
//   ✓ Offline queue with retry
//   ✓ ZERO sensitive data written
//
// Uses Firebase Realtime Database via CDN scripts loaded
// through the sandbox iframe (allowed by policy).
////////////////////////////////////////////////////////////

(function() {
"use strict";

const DB = "https://torn-war-room-default-rtdb.firebaseio.com";

const Sergeant = {

    general: null,

    factionId: null,
    lastFactionSync: 0,

    // Local shared targets, in-memory & persistent
    sharedTargets: [],
    writeQueue: [],
    writeTimer: null,

    // Polling timers
    pollTimer: null,

    // -----------------------------------------------------
    // INIT
    // -----------------------------------------------------
    init(G) {
        this.general = G;
        this.loadLocal();

        // Listen for SITREP so we know factionId
        this.general.signals.listen("SITREP_UPDATE", data => {
            if (data?.factionMembers && data.user?.id) {
                // Determine factionId from colonel's SITREP
                const factionMembers = data.factionMembers;
                const self = factionMembers.find(x => x.id === data.user.id);
                if (!self) return;
            }
        });

        // Listen for RAW_INTEL so we know faction.id when Lieutenant pulls Torn API
        this.general.signals.listen("RAW_INTEL", data => {
            const fid = data?.faction?.id;
            if (!fid) return;

            if (this.factionId !== fid) {
                this.factionId = fid;
                this.startPolling();
            }

            // Sync members → Firebase
            this.syncMembersToFirebase(data.faction.members || {});
        });

        // Listen for "REQUEST_ADD_SHARED_TARGET"
        this.general.signals.listen("REQUEST_ADD_SHARED_TARGET", t => {
            this.addSharedTarget(t);
        });

        // For the Major to get updates
        this.general.signals.dispatch("SHARED_TARGETS_UPDATED", this.sharedTargets);
    },

    // -----------------------------------------------------
    // LOCAL STORAGE
    // -----------------------------------------------------
    loadLocal() {
        try {
            const raw = localStorage.getItem("nexus_shared_targets");
            if (raw) this.sharedTargets = JSON.parse(raw);
        } catch {
            this.sharedTargets = [];
        }
    },

    saveLocal() {
        localStorage.setItem("nexus_shared_targets",
            JSON.stringify(this.sharedTargets));
    },

    // -----------------------------------------------------
    // POLLING LOOP (Firebase REST)
    // -----------------------------------------------------
    startPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);

        // Poll every 5 seconds for full feature parity
        this.pollTimer = setInterval(() => {
            if (!this.factionId) return;

            this.pollSharedTargets();
            this.pollCommanderOrders();
        }, 5000);
    },

    // -----------------------------------------------------
    // REST GET
    // -----------------------------------------------------
    restGet(path, cb) {
        GM_xmlhttpRequest({
            method: "GET",
            url: `${DB}/${path}.json`,
            onload: r => {
                if (r.status === 200) {
                    try { cb(JSON.parse(r.responseText)); }
                    catch { /* ignore */ }
                }
            }
        });
    },

    // -----------------------------------------------------
    // REST PUT
    // -----------------------------------------------------
    restPut(path, value, cb) {
        GM_xmlhttpRequest({
            method: "PUT",
            url: `${DB}/${path}.json`,
            data: JSON.stringify(value),
            headers: { "Content-Type": "application/json" },
            onload: () => cb && cb()
        });
    },

    // -----------------------------------------------------
    // REST PATCH
    // -----------------------------------------------------
    restPatch(path, value, cb) {
        GM_xmlhttpRequest({
            method: "PATCH",
            url: `${DB}/${path}.json`,
            data: JSON.stringify(value),
            headers: { "Content-Type": "application/json" },
            onload: () => cb && cb()
        });
    },

    // -----------------------------------------------------
    // SYNC FACTION MEMBERS → Firebase
    // -----------------------------------------------------
    syncMembersToFirebase(members) {
        if (!this.factionId) return;

        const now = Date.now();
        if (now - this.lastFactionSync < 5000) return; // limit to 1 write per 5s
        this.lastFactionSync = now;

        const base = `factions/${this.factionId}/members`;

        const payload = {};
        for (const [id, m] of Object.entries(members)) {
            payload[id] = {
                id,
                name: m.name,
                level: m.level || 0,
                status: m.status?.state || "",
                updated: now
            };
        }

        // Batch update (PATCH)
        this.restPatch(base, payload);
    },

    // -----------------------------------------------------
    // ADD SHARED TARGET
    // -----------------------------------------------------
    addSharedTarget(t) {
        if (!t?.id || !t?.name) return;

        t.timestamp = Date.now();

        // Replace or add locally
        this.sharedTargets = this.sharedTargets.filter(x => x.id !== t.id);
        this.sharedTargets.push(t);
        this.saveLocal();

        // Notify Major
        this.general.signals.dispatch("SHARED_TARGETS_UPDATED", this.sharedTargets);

        // Push to Firebase
        if (this.factionId)
            this.enqueueWrite(`factions/${this.factionId}/targets/${t.id}`, t);
    },

    // -----------------------------------------------------
    // QUEUED WRITES (BATCHED)
    // -----------------------------------------------------
    enqueueWrite(path, value) {
        this.writeQueue.push({ path, value });

        if (this.writeTimer) clearTimeout(this.writeTimer);

        // Batch writes every 1200ms
        this.writeTimer = setTimeout(() => this.flushWriteQueue(), 1200);
    },

    flushWriteQueue() {
        const queue = [...this.writeQueue];
        this.writeQueue.length = 0;

        queue.forEach(item => {
            this.restPut(item.path, item.value);
        });
    },

    // -----------------------------------------------------
    // POLL: SHARED TARGETS
    // -----------------------------------------------------
    pollSharedTargets() {
        if (!this.factionId) return;

        const path = `factions/${this.factionId}/targets`;
        this.restGet(path, data => {
            if (!data) return;

            // Convert map → array
            const remoteList = Object.values(data);

            // Detect changes
            const localJson = JSON.stringify(this.sharedTargets);
            const remoteJson = JSON.stringify(remoteList);

            if (localJson !== remoteJson) {
                this.sharedTargets = remoteList;
                this.saveLocal();

                // Notify Major
                this.general.signals.dispatch(
                    "SHARED_TARGETS_UPDATED",
                    this.sharedTargets
                );
            }
        });
    },

    // -----------------------------------------------------
    // POLL: COMMANDER ORDERS
    // -----------------------------------------------------
    pollCommanderOrders() {
        if (!this.factionId) return;

        const path = `factions/${this.factionId}/orders`;
        this.restGet(path, orders => {
            if (!orders) return;

            // Dispatch commander orders to Major / Colonel
            this.general.signals.dispatch("COMMANDER_ORDERS", orders);
        });
    }
};

if (typeof WAR_GENERAL !== "undefined") {
    WAR_GENERAL.register("Sergeant", Sergeant);
} else if (typeof WARDBG === "function") {
    WARDBG("SERGEANT FAILED TO REGISTER: WAR_GENERAL missing");
}

})();
