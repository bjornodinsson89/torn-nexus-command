/**
 * CODENAME: WAR_SERGEANT v2.1
 * ROLE: Communications Officer
 * RESPONSIBILITY:
 *   - Firebase ↔ War Room sync
 *   - Faction members
 *   - Shared faction targets
 */

(function () {

    const Sergeant = {
        general:null,
        db:null,
        factionId:null,
        uid:null,

        init(General) {
            this.general = General;

            if (!firebase || !firebase.database) {
                console.error("[SERGEANT] Missing Firebase SDK");
                return;
            }
            this.db = firebase.database();

            // NEW: Listen for shared-target add requests
            General.signals.listen("REQUEST_ADD_SHARED_TARGET", t => {
                if (t && t.id) this.addTarget(t);
                else console.warn("[SERGEANT] Invalid shared target:", t);
            });

            // Sync user/faction
            General.signals.listen("RAW_INTEL", intel => this.trySyncFaction(intel));

            console.log("%c[Sergeant v2.2] Firebase Comms Online", "color:#0f0");
        },

        trySyncFaction(intel) {
            if (!intel || !intel.user) return;
            const u = intel.user;
            const uid = u.userID;
            const fid = u.factionID || null;

            if (this.uid !== uid) this.uid = uid;

            if (fid !== this.factionId) {
                this.detachListeners();
                this.factionId = fid;
                if (fid) this.attachListeners();
            }

            if (this.factionId) this.upsertMember(u);
        },

        attachListeners() {
            if (!this.factionId) return;

            this.membersRef = this.db.ref(`factions/${this.factionId}/members`);
            this.targetsRef = this.db.ref(`factions/${this.factionId}/targets`);

            this.membersRef.on("value", snap => this.handleMembers(snap));
            this.targetsRef.on("value", snap => this.handleTargets(snap));

            console.log(`[SERGEANT] Listening to faction ${this.factionId}`);
        },

        detachListeners() {
            if (this.membersRef) this.membersRef.off();
            if (this.targetsRef) this.targetsRef.off();
            this.membersRef=null; this.targetsRef=null;
        },

        upsertMember(u) {
            if (!this.factionId || !this.uid) return;
            const ref = this.db.ref(`factions/${this.factionId}/members/${this.uid}`);

            ref.set({
                userID:String(this.uid),
                name:u.name||"Unknown",
                level:u.level||0,
                role:u.role||"",
                status:u.status?.state||"Okay",
                until:u.status?.until||0,
                lastSeen:Date.now(),
                watching:u.watching||false
            }).catch(e=>console.error("[SERGEANT] upsert error:", e));
        },

        addTarget(t) {
            if (!this.factionId || !t || !t.id) return;

            const ref = this.db.ref(`factions/${this.factionId}/targets/${t.id}`);

            ref.set({
                id:String(t.id),
                name:t.name||"Unknown",
                level:t.level||null,
                faction:t.faction||"",
                status:t.status||"Okay",
                timer:t.timer||0,
                score:t.score||0,
                lastSeen:t.lastSeen||0
            }).catch(e=>console.error("[SERGEANT] addTarget error:", e));
        },

        handleMembers(snap) {
            const raw = snap.val()||{};
            const mem = {};
            for (const id in raw) {
                const m = raw[id];
                mem[id] = {
                    userID:m.userID,
                    name:m.name,
                    level:m.level,
                    role:m.role,
                    status:m.status,
                    until:m.until,
                    lastSeen:m.lastSeen,
                    watching:m.watching
                };
            }
            this.general.signals.dispatch("FACTION_MEMBERS_UPDATE", mem);
        },

        handleTargets(snap) {
            const raw = snap.val()||{};
            const out = {};
            for (const id in raw) out[id] = raw[id];
            this.general.signals.dispatch("FACTION_TARGETS_UPDATE", {targets:out});
        }
    };

    if (window.WAR_GENERAL) WAR_GENERAL.register("Sergeant", Sergeant);

})();
