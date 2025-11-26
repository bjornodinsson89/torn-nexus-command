/*********************************************
 * WAR_SERGEANT v2.3 — External Comms Officer
 * Responsibilities:
 *   • Sync faction members to internal channels
 *   • Manage shared target list (local)
 *   • Relay commander orders (future Firebase integration)
 *********************************************/

(function() {

class Sergeant {

    constructor() {
        this.general = null;

        this.sharedTargets = [];
        this.factionId = null;

        this.listeners = [];
        this.intervals = [];

        this._pendingWrite = null;
    }

    init(G) {
        this.cleanup();
        this.general = G;

        this.loadShared();
        this.registerListeners();

        console.log("%c[Sergeant v2.3] Online", "color:#0a0");
    }

    /**************************************************************
     * LISTENERS — FIXED
     **************************************************************/
    registerListeners() {
        // FIX: Correct event is RAW_INTEL
        this.listen("RAW_INTEL", intel => {
            if (!intel || !intel.faction) return;

            this.factionId = intel.faction.faction_id || this.factionId;
            this.syncFactionMembers(intel.faction);
        });

        // User requests adding a shared target
        this.listen("REQUEST_ADD_SHARED_TARGET", t => {
            if (!t) return;
            this.addSharedTarget(t);
        });
    }

    listen(evt, fn) {
        const unsub = this.general.signals.listen(evt, fn);
        this.listeners.push(unsub);
        return unsub;
    }

    /**************************************************************
     * SHARED TARGETS MANAGEMENT
     **************************************************************/
    addSharedTarget(t) {
        this.sharedTargets.push(t);
        this.saveShared();
        this.general.signals.dispatch("SHARED_TARGETS_UPDATED", this.sharedTargets);
    }

    loadShared() {
        try {
            const raw = localStorage.getItem("war_shared_targets");
            if (!raw) return;
            this.sharedTargets = JSON.parse(raw);
        } catch {}
    }

    saveShared() {
        clearTimeout(this._pendingWrite);
        this._pendingWrite = setTimeout(() => {
            try {
                localStorage.setItem("war_shared_targets", JSON.stringify(this.sharedTargets));
            } catch {}
        }, 300);
    }

    /**************************************************************
     * FACTION MEMBER SYNC
     **************************************************************/
    syncFactionMembers(faction) {
        try {
            const members = faction.members || {};
            this.general.signals.dispatch("FACTION_MEMBERS_UPDATE", members);
        } catch (err) {
            console.error("[Sergeant] Faction sync error:", err);
        }
    }

    /**************************************************************
     * CLEANUP
     **************************************************************/
    cleanup() {
        this.listeners.forEach(u => u());
        this.listeners = [];

        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];
    }
}

/**************************************************************
 * REGISTER WITH GENERAL
 **************************************************************/
if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Sergeant", new Sergeant());
}

})();
