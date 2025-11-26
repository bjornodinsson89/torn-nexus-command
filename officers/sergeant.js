/*********************************************
 * WAR_SERGEANT v2.3 
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
     * FIXED LISTENER – RAW_INTEL INSTEAD OF FACTION_SITREP
     **************************************************************/
    registerListeners() {
        // Fix #1: was FACTION_SITREP (never fired)
        this.listen("RAW_INTEL", intel => {
            if (!intel || !intel.faction) return;
            this.factionId = intel.faction.faction_id || this.factionId;
            this.syncFactionMembers(intel.faction);
        });

        // Add-shared-target remains unchanged
        this.listen("REQUEST_ADD_SHARED_TARGET", t => {
            if (!t) return;
            this.addSharedTarget(t);
        });
    }

    listen(evt, fn) {
        const unsub = this.general.signals.listen(evt, fn);
        this.listeners.push(unsub);
    }

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
            localStorage.setItem("war_shared_targets", JSON.stringify(this.sharedTargets));
        }, 300);
    }

    syncFactionMembers(faction) {
        try {
            const members = faction.members || {};
            this.general.signals.dispatch("FACTION_MEMBERS_UPDATE", members);
        } catch {}
    }

    cleanup() {
        this.listeners.forEach(u => u());
        this.listeners = [];

        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];
    }
}

/**************************************************************
 * REGISTER
 **************************************************************/
if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Sergeant", new Sergeant());
}

})();
