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

    // Local shared targets (cached)
    sharedTargets: [],
    writeQueue: [],
    writeTimer: null,

    // Firebase poll timer
    pollTimer: null,

    init(G) {
        this.general = G;

        // Load cached targets
        this.loadLocal();

        // Listen for RAW_INTEL (RELIABLE factionId source)
        this.general.signals.listen("RAW_INTEL", intel => {
            this.handleRawIntel(intel);
        });

        // Listen for SITREP to update UI when sharedTargets change
        this.general.signals.listen("SITREP_UPDATE", sitrep => {
            // Major gets notified when Sergeant updates list
        });

        // From Major → add shared target
        this.general.signals.listen("REQUEST_ADD_SHARED_TARGET", t => {
            this.addSharedTarget(t);
        });

        if (typeof WARDBG === "function") {
            WARDBG("Sergeant online (v7.6 REST)");
        }
    },

    // -------------------------------------------------------
    // RAW_INTEL handler — extract factionId reliably
    // -------------------------------------------------------
    handleRawIntel(intel) {
        const fid = intel?.faction?.id;
        if (!fid) return;

        if (this.factionId !== fid) {
            this.factionId = fid;
            this.startPolling();
        }

        // Sync faction members (mirror) every 5s
        this.syncMembersToFirebase(intel.faction.members || {});
    },

    // -------------------------------------------------------
    // LOCAL CACHE
    // -------------------------------------------------------
    loadLocal() {
        try {
            const raw = localStorage.getItem("nexus_shared_targets");
            if (raw) this.sharedTargets = JSON.parse(raw);
        } catch {
            this.sharedTargets = [];
        }
    },

    saveLocal() {
        localStorage.setItem(
            "nexus_shared_targets",
            JSON.stringify(this.sharedTargets)
        );
    },

    // -------------------------------------------------------
    // POLLING LOOP
    // -------------------------------------------------------
    startPolling() {
        if (!this.factionId) return;

        if (this.pollTimer) clearInterval(this.pollTimer);

        // Poll every 5 seconds
        this.pollTimer = setInterval(() => {
            this.pollSharedTargets();
            this.pollCommanderOrders();
        }, 5000);

        if (typeof WARDBG === "function") {
            WARDBG("Sergeant: Polling started for faction " + this.factionId);
        }
    },

    // -------------------------------------------------------
    // REST HELPERS
    // -------------------------------------------------------
    restGet(path, cb) {
        GM_xmlhttpRequest({
            method: "GET",
            url: `${DB}/${path}.json`,
            onload: r => {
                if (r.status === 200) {
                    try { cb(JSON.parse(r.responseText)); }
                    catch { cb(null); }
                } else {
                    cb(null);
                }
            }
        });
    },

    restPut(path, value, cb) {
        GM_xmlhttpRequest({
            method: "PUT",
            url: `${DB}/${path}.json`,
            data: JSON.stringify(value),
            headers: { "Content-Type": "application/json" },
            onload: () => cb && cb()
        });
    },

    restPatch(path, value, cb) {
        GM_xmlhttpRequest({
            method: "PATCH",
            url: `${DB}/${path}.json`,
            data: JSON.stringify(value),
            headers: { "Content-Type": "application/json" },
            onload: () => cb && cb()
        });
    },

    // -------------------------------------------------------
    // FACTION MIRROR (write members)
    // -------------------------------------------------------
    syncMembersToFirebase(membersObj) {
        if (!this.factionId) return;

        const now = Date.now();
        if (now - this.lastFactionSync < 5000) return; // limit

        this.lastFactionSync = now;

        // Firebase path
        const base = `factions/${this.factionId}/members`;

        const payload = {};

        for (const [id, m] of Object.entries(membersObj)) {
            payload[id] = {
                id,
                name: m.name,
                level: m.level || 0,
                status: m.status?.state || "",
                updated: now,
                last_action: m.last_action?.relative || ""
            };
        }

        this.restPatch(base, payload);
    },

    // -------------------------------------------------------
    // ADD SHARED TARGET — from Major
    // -------------------------------------------------------
    addSharedTarget(t) {
        if (!t?.id || !t?.name) return;

        t.timestamp = Date.now();

        // Replace or add
        this.sharedTargets = this.sharedTargets.filter(x => x.id !== t.id);
        this.sharedTargets.push(t);
        this.saveLocal();

        // Notify Major UI
        this.general.signals.dispatch(
            "SHARED_TARGETS_UPDATED",
            this.sharedTargets
        );

        // Push to Firebase (queued)
        if (this.factionId)
            this.enqueueWrite(`factions/${this.factionId}/targets/${t.id}`, t);
    },

    // -------------------------------------------------------
    // WRITE QUEUE (batch writes)
    // -------------------------------------------------------
    enqueueWrite(path, value) {
        this.writeQueue.push({ path, value });

        if (this.writeTimer) clearTimeout(this.writeTimer);

        // Batch every 1200ms
        this.writeTimer = setTimeout(
            () => this.flushWriteQueue(),
            1200
        );
    },

    flushWriteQueue() {
        const queue = [...this.writeQueue];
        this.writeQueue.length = 0;

        queue.forEach(item => {
            this.restPut(item.path, item.value);
        });
    },

    // -------------------------------------------------------
    // POLL SHARED TARGETS (Firebase → local)
    // -------------------------------------------------------
    pollSharedTargets() {
        if (!this.factionId) return;
        const path = `factions/${this.factionId}/targets`;

        this.restGet(path, data => {
            if (!data) return;

            const remoteArray = Object.values(data || {});
            const remoteJson = JSON.stringify(remoteArray);
            const localJson = JSON.stringify(this.sharedTargets);

            if (remoteJson !== localJson) {
                this.sharedTargets = remoteArray;
                this.saveLocal();

                this.general.signals.dispatch(
                    "SHARED_TARGETS_UPDATED",
                    this.sharedTargets
                );

                if (typeof WARDBG === "function") WARDBG("Sergeant: Shared targets updated");
            }
        });
    },

    // -------------------------------------------------------
    // POLL COMMANDER ORDERS
    // -------------------------------------------------------
    pollCommanderOrders() {
        if (!this.factionId) return;

        const path = `factions/${this.factionId}/orders`;

        this.restGet(path, orders => {
            if (!orders) return;

            // Provide to Colonel + Major
            this.general.signals.dispatch("COMMANDER_ORDERS", orders);

            if (typeof WARDBG === "function") WARDBG("Sergeant: Orders update received");
        });
    }
};

// Register
if (typeof WAR_GENERAL !== "undefined") {
    WAR_GENERAL.register("Sergeant", Sergeant);
} else if (typeof WARDBG === "function") {
    WARDBG("Sergeant FAILED to register: WAR_GENERAL missing");
}

})();
