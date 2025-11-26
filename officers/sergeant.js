/**
 * WAR_SERGEANT v2.3 — Final Deployment Build
 * Role:
 *   - Faction data sync
 *   - Shared target storage
 *   - Member roster updates
 *   - Re-init safe, debounced, hardened
 */

(function(){

    const Sergeant = {
        general: null,
        listeners: [],
        intervals: [],

        // local memory caches
        factionId: null,
        members: {},
        sharedTargets: [],

        debounceTimers: {
            memberWrite: null,
            targetWrite: null
        },

        init(General) {
            this.cleanup();
            this.general = General;

            this.registerListeners();

            console.log("%c[Sergeant v2.3] Logistics Online", "color:#7cf");
        },

        cleanup() {
            // clear timers
            Object.values(this.debounceTimers).forEach(t => {
                if (t) clearTimeout(t);
            });

            this.intervals.forEach(id => clearInterval(id));
            this.intervals = [];

            // remove bus listeners
            this.listeners.forEach(u => {
                try { u(); } catch {}
            });
            this.listeners = [];
        },

        /* --------------------------
           LISTENER WRAPPER
        --------------------------- */
        listen(ev, fn) {
            const unsub = this.general.signals.listen(ev, fn);
            this.listeners.push(unsub);
        },

        /* --------------------------
           REGISTER EVENT HANDLERS
        --------------------------- */
        registerListeners() {

            // When Major requests a shared target to be added
            this.listen("REQUEST_ADD_SHARED_TARGET", t => {
                if (!t) return;
                this.addSharedTarget(t);
            });

            // Faction SITREP from Colonel/General
            this.listen("FACTION_SITREP", sitrep => {
                if (!sitrep) return;
                this.factionId = sitrep.id || this.factionId;
                this.syncFactionMembers(sitrep);
            });

            // (Optional future) Shared target list updates
            // can be synced from remote datastore here:
            //
            // this.listen("REMOTE_SHARED_TARGET_UPDATE", tList => {
            //     this.sharedTargets = tList;
            //     this.general.signals.dispatch("SHARED_TARGETS_UPDATED", tList);
            // })
        },

        /* --------------------------
           FACTION MEMBER SYNC
        --------------------------- */
        syncFactionMembers(sitrep) {
            // sitrep.members is normalized by General
            const newMembers = sitrep.members || {};

            // merge into local cache
            Object.entries(newMembers).forEach(([id, m]) => {
                this.members[id] = {
                    ...(this.members[id] || {}),
                    ...m
                };
            });

            // schedule debounced write
            this.debouncedWrite("memberWrite", () => {
                this.writeFactionMembers();
            });

            // forward to Major UI
            this.general.factionMembers = this.members;
            this.general.signals.dispatch("FACTION_MEMBERS_UPDATE", this.members);
        },

        writeFactionMembers() {
            // FUTURE BACKEND: write to server/Firebase
            // For now — local only
            // console.log("[Sergeant] Writing faction members:", this.members);
        },

        /* --------------------------
           SHARED TARGETS
        --------------------------- */
        addSharedTarget(t) {
            if (!t || !t.id) return;

            const exists = this.sharedTargets.find(x => String(x.id) === String(t.id));
            if (exists) return;

            this.sharedTargets.push({
                id: t.id,
                name: t.name,
                level: t.level || 0,
                status: t.status || "Okay",
                added: Date.now()
            });

            this.debouncedWrite("targetWrite", () => {
                this.writeSharedTargets();
            });

            this.general.signals.dispatch("SHARED_TARGETS_UPDATED", this.sharedTargets);
        },

        writeSharedTargets() {
            // FUTURE: remote write
            // console.log("[Sergeant] Writing shared targets:", this.sharedTargets);
        },

        /* --------------------------
           DEBOUNCE UTILITY
        --------------------------- */
        debouncedWrite(key, fn, delay = 500) {
            if (this.debounceTimers[key]) clearTimeout(this.debounceTimers[key]);
            this.debounceTimers[key] = setTimeout(fn, delay);
        }

    };

    if (window.WAR_GENERAL) {
        WAR_GENERAL.register("Sergeant", Sergeant);
    } else {
        console.warn("[Sergeant v2.3] WAR_GENERAL not detected");
    }

})();
