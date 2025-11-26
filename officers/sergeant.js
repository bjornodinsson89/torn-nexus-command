/**
 * CODENAME: WAR_SERGEANT v2.1
 * ROLE: Communications Officer
 * RESPONSIBILITY:
 *   - Firebase ↔ War Room sync
 *   - Faction members
 *   - Shared faction targets
 *   - Watcher flags
 *   - Live timestamps (lastSeen)
 *   - Enforce faction isolation
 */

(function () {

    const Sergeant = {
        general: null,
        db: null,
        factionId: null,
        uid: null,

        membersRef: null,
        targetsRef: null,

        /* ------------------------------ Init ------------------------------ */
        init(General) {
            this.general = General;

            if (!firebase || !firebase.database) {
                console.error("[SERGEANT] Firebase SDK missing");
                return;
            }

            this.db = firebase.database();

            // Detect user + faction from the General signal bus
            General.signals.listen("RAW_INTEL", intel => {
                this.trySyncFaction(intel);
            });
        },

        /* ----------------------- Faction Sync Logic ----------------------- */
        trySyncFaction(intel) {
            if (!intel || !intel.user) return;

            const tornID = intel.user.userID;
            const factionID = intel.user.factionID || null;

            if (this.uid !== tornID) {
                this.uid = tornID;
            }

            // If user left faction
            if (!factionID && this.factionId) {
                this.detachFactionListeners();
                this.factionId = null;
                return;
            }

            // If first time joining or switching
            if (factionID && factionID !== this.factionId) {
                this.detachFactionListeners();
                this.factionId = factionID;
                this.attachFactionListeners();
            }

            // Upsert user's membership entry
            if (this.factionId) {
                this.upsertMember(intel.user);
            }
        },

        /* ----------------------- Firebase Listeners ----------------------- */
        attachFactionListeners() {
            if (!this.factionId) return;

            this.membersRef = this.db.ref(`factions/${this.factionId}/members`);
            this.targetsRef = this.db.ref(`factions/${this.factionId}/targets`);

            this.membersRef.on("value", snap => this.handleMembersSnapshot(snap));
            this.targetsRef.on("value", snap => this.handleTargetsSnapshot(snap));

            console.log(`[SERGEANT] Attached listeners for faction ${this.factionId}`);
        },

        detachFactionListeners() {
            if (this.membersRef) this.membersRef.off();
            if (this.targetsRef) this.targetsRef.off();
            this.membersRef = null;
            this.targetsRef = null;
        },

        /* ------------------------- Write Members -------------------------- */
        upsertMember(user) {
            if (!this.factionId || !this.uid) return;

            const ref = this.db.ref(`factions/${this.factionId}/members/${this.uid}`);

            const payload = {
                userID: String(this.uid),
                name: user.name || user.playername || "Unknown",
                level: user.level || null,
                role: user.role || "",
                status: user.status || "Okay",
                lastSeen: Date.now(),
                watching: user.watching || false,
                until: user.until || 0,
                factionID: this.factionId
            };

            ref.set(payload).catch(err => {
                console.error("[SERGEANT] Failed to upsert member:", err);
            });
        },

        /* ------------------------- Snapshot: Members ------------------------ */
        handleMembersSnapshot(snap) {
            const val = snap.val() || {};
            const members = {};

            Object.keys(val).forEach(uid => {
                const m = val[uid];
                members[uid] = {
                    userID: String(m.userID || uid),
                    name: m.name || "Unknown",
                    level: m.level || null,
                    role: m.role || "",
                    status: m.status || "Okay",
                    until: m.until || 0,
                    lastSeen: m.lastSeen || 0,
                    watching: !!m.watching
                };
            });

            this.general.signals.dispatch("FACTION_MEMBERS_UPDATE", members);
        },

        /* ------------------------- Snapshot: Targets ------------------------ */
        handleTargetsSnapshot(snap) {
            const val = snap.val() || {};
            const targets = {};

            Object.keys(val).forEach(tid => {
                const t = val[tid];
                targets[tid] = {
                    id: String(t.id || tid),
                    name: t.name || "Unknown",
                    level: t.level || null,
                    faction: t.faction || "",
                    status: t.status || "Okay",
                    timer: t.timer || 0,
                    score: t.score || 0,
                    lastSeen: t.lastSeen || 0
                };
            });

            this.general.signals.dispatch("FACTION_TARGETS_UPDATE", { targets });
        },

        /* ------------------------ Add Shared Target ------------------------ */
        addTarget(t) {
            if (!this.factionId) return;

            const tid = t.id;
            const ref = this.db.ref(`factions/${this.factionId}/targets/${tid}`);

            const payload = {
                id: tid,
                name: t.name || "Unknown",
                level: t.level || null,
                faction: t.faction || "",
                status: t.status || "Okay",
                timer: t.timer || 0,
                score: t.score || 0,
                lastSeen: t.lastSeen || 0
            };

            ref.set(payload).catch(err => {
                console.error("[SERGEANT] Failed to save shared target:", err);
            });
        },

        /* ------------------------ Toggle Watcher Flag ------------------------ */
        toggleWatcher(state) {
            if (!this.factionId || !this.uid) return;

            this.db
                .ref(`factions/${this.factionId}/members/${this.uid}/watching`)
                .set(state)
                .catch(err => console.error("[SERGEANT] Watch flag update failed:", err));
        }
    };

    /* ---------------------- Register with General ----------------------- */
    if (window.WAR_GENERAL) {
        WAR_GENERAL.register("Sergeant", Sergeant);
    } else {
        console.warn("[WAR_SERGEANT] WAR_GENERAL missing – Sergeant not registered.");
    }

})();
