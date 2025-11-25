/**
 * CODENAME: WAR_SERGEANT
 * RANK: 🎖 (NCO)
 * MISSION: External Comms & Firebase Sync
 * BASE: War Room Database Uplink v2
 */

(function() {
    "use strict";

    const FB_CONFIG = {
        apiKey: "AIzaSyAXIP665pJj4g9L9i-G-XVBrcJ0eU5V4uw",
        authDomain: "torn-war-room.firebaseapp.com",
        databaseURL: "https://torn-war-room-default-rtdb.firebaseio.com",
        projectId: "torn-war-room",
        storageBucket: "torn-war-room.firebasestorage.app",
        messagingSenderId: "559747349324",
        appId: "1:559747349324:web:ec1c7d119e5fd50443ade9"
    };

    const Sergeant = {
        general: null,
        db: null,
        auth: null,
        uid: null,
        fid: null,
        membersRef: null,
        membersCb: null,
        targetsRef: null,
        targetsCb: null,

        init(G) {
            this.general = G;
            this.loadFirebase()
                .then(() => this.initFirebase())
                .then(() => this.initAuth())
                .then(() => this.bindSignals());
        },

        loadFirebase() {
            return new Promise((resolve, reject) => {
                const s1 = document.createElement("script");
                s1.src = "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js";
                s1.onload = () => {
                    const s2 = document.createElement("script");
                    s2.src = "https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js";
                    s2.onload = () => {
                        const s3 = document.createElement("script");
                        s3.src = "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js";
                        s3.onload = resolve;
                        s3.onerror = reject;
                        document.head.appendChild(s3);
                    };
                    s2.onerror = reject;
                    document.head.appendChild(s2);
                };
                s1.onerror = reject;
                document.head.appendChild(s1);
            });
        },

        initFirebase() {
            if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
            this.db = firebase.database();
            this.auth = firebase.auth();
        },

        initAuth() {
            return new Promise(resolve => {
                this.auth.onAuthStateChanged(user => {
                    if (user) {
                        this.uid = user.uid;
                        resolve();
                    } else {
                        this.auth.signInAnonymously();
                    }
                });
            });
        },

        bindSignals() {
            const S = this;
            S.general.signals.listen("RAW_INTEL", d => S.handleIntel(d));
            S.general.signals.listen("REQUEST_SHARE_TARGET", t => S.shareTarget(t));
            S.general.signals.listen("SET_WATCH_STATUS", v => S.setWatch(v));
        },

        handleIntel(raw) {
            const r = raw.raw || raw;
            const tornId = r.player_id || r.userID;
            const name = r.name || r.playername || "Unknown";
            const factionId = r.faction?.faction_id || r.faction_id || null;

            if (!tornId || !this.uid) return;

            const intel = {
                tornId: String(tornId),
                name: name,
                factionId: factionId ? String(factionId) : null
            };
            this.syncMembership(intel);
        },

        async syncMembership(i) {
            const uid = this.uid;
            const fid = i.factionId;

            if (!fid) {
                if (this.fid) {
                    await this.removeMember(this.fid, uid);
                    this.detach();
                }
                this.fid = null;
                return;
            }

            if (this.fid && this.fid !== fid) {
                await this.removeMember(this.fid, uid);
                this.detach();
            }

            this.fid = fid;
            await this.saveMember(fid, uid, i.tornId, i.name);
            this.attach(fid);
        },

        async saveMember(fid, uid, tornId, name) {
            const now = Date.now();
            const ref = this.db.ref(`factions/${fid}/members/${uid}`);
            const snap = await ref.get();
            const existing = snap.exists() ? snap.val() : {};

            await ref.set({
                userID: tornId,
                name: name,
                factionID: fid,
                watching: existing.watching === true,
                lastSeen: now,
                updatedAt: now
            });
        },

        removeMember(fid, uid) {
            return this.db.ref(`factions/${fid}/members/${uid}`).remove();
        },

        setWatch(state) {
            if (!this.fid || !this.uid) return;
            this.db.ref(`factions/${this.fid}/members/${this.uid}/watching`).set(state === true);
        },

        async shareTarget(t) {
            if (!this.fid || !this.uid || !t?.id) return;
            const tid = String(t.id);
            const ref = this.db.ref(`factions/${this.fid}/targets/${tid}`);
            const snap = await ref.get();
            const now = Date.now();

            const existing = snap.exists() ? snap.val() : {};

            const p = {
                id: tid,
                name: t.name || existing.name || "Unknown",
                level: t.level ?? existing.level ?? null,
                faction: t.faction ?? existing.faction ?? null,
                addedBy: existing.addedBy || this.uid,
                addedAt: existing.addedAt || now,
                spyIntel: existing.spyIntel || null
            };
            await ref.set(p);
        },

        attach(fid) {
            this.detach();

            const memRef = this.db.ref(`factions/${fid}/members`);
            const tarRef = this.db.ref(`factions/${fid}/targets`);

            this.membersCb = snap => {
                this.general.signals.dispatch("FACTION_MEMBERS_UPDATE", snap.val() || {});
            };
            this.targetsCb = snap => {
                this.general.signals.dispatch("FACTION_TARGETS_UPDATE", snap.val() || {});
            };

            memRef.on("value", this.membersCb);
            tarRef.on("value", this.targetsCb);

            this.membersRef = memRef;
            this.targetsRef = tarRef;
        },

        detach() {
            if (this.membersRef && this.membersCb) this.membersRef.off("value", this.membersCb);
            if (this.targetsRef && this.targetsCb) this.targetsRef.off("value", this.targetsCb);
            this.membersRef = null;
            this.targetsRef = null;
            this.membersCb = null;
            this.targetsCb = null;
        }
    };

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Sergeant", Sergeant);
    }

})();
