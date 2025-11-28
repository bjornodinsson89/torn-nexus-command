/*********************************************
 * WAR_SERGEANT v2.3 — External Comms + Firebase
 *********************************************/

(function() {
    "use strict";

    const firebaseConfig = {
        apiKey: "AIzaSyAXIP665pJj4g9L9i-G-XVBrcJ0eU5V4uw",
        authDomain: "torn-war-room.firebaseapp.com",
        databaseURL: "https://torn-war-room-default-rtdb.firebaseio.com",
        projectId: "torn-war-room",
        storageBucket: "torn-war-room.firebasestorage.app",
        messagingSenderId: "559747349324",
        appId: "1:559747349324:web:ec1c7d119e5fd50443ade9"
    };

    const firebaseScripts = [
        'https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/10.13.1/firebase-database-compat.js',
        'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js'
    ];

    class Sergeant {
        constructor() {
            this.general = null;
            this.sharedTargets = [];
            this.factionId = null;
            this.listeners = [];
            this._pendingWrite = null;

            // Firebase
            this.app = null;
            this.db = null;
            this.auth = null;
            this._isReady = false;
            this._writeQueue = [];
            this._writeTimer = null;
            this._loadingScripts = false;

            // Fixed: initialize missing array to prevent cleanup errors
            this.intervals = [];
        }

        async init(G) {
            this.cleanup();
            this.general = G;
            this.loadShared();
            await this._initFirebase();
            this.registerListeners();

            if (window.Colonel?.setDatabaseAdapter) {
                window.Colonel.setDatabaseAdapter(this.getAdapter());
            }

            console.log("%c[Sergeant v2.3] Online (Firebase Active)", "color:#0a0");
        }

        async _initFirebase() {
            if (window.firebase?.initializeApp) return this._setupFirebase();
            
            if (this.general?.loadPlugin) {
                this._loadingScripts = true;
                try {
                    await Promise.all(firebaseScripts.map(url => this.general.loadPlugin(url)));
                } catch (e) { console.warn("[Sergeant] Plugin load failed:", e); }
                this._loadingScripts = false;
            } else {
                await this._injectScripts();
            }

            if (window.firebase) await this._setupFirebase();
            else console.warn("[Sergeant] Firebase SDK not loaded — localStorage only");
        }

        async _injectScripts() {
            return new Promise((resolve, reject) => { 
                let loaded = 0;
                firebaseScripts.forEach(url => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = () => {
                        if (++loaded === firebaseScripts.length) {
                            // Critical fix: 100ms delay to prevent Firebase race condition
                            setTimeout(() => resolve(), 100);
                        }
                    };
                    script.onerror = () => reject(new Error("Failed to load Firebase script: " + url));
                    document.head.appendChild(script);
                });
            });
        }

        async _setupFirebase() {
            const { initializeApp } = window.firebase;
            const { getDatabase, ref, onValue, set, remove } = window.firebase.database;
            const { getAuth, signInAnonymously } = window.firebase.auth;

            this.app = initializeApp(firebaseConfig);
            this.db = getDatabase(this.app);
            this.auth = getAuth(this.app);

            // Anonymous Auth
            await signInAnonymously(this.auth).catch(e => console.warn("[Sergeant] Auth failed:", e));
            this._isReady = true;
        }

        getAdapter() {
            if (!this._isReady) return null;
            return { get: this._get.bind(this), set: this._set.bind(this), remove: this._remove.bind(this) };
        }

        _get(path) {
            return new Promise(resolve => {
                if (!this._isReady) return resolve(null);
                const r = ref(this.db, path);
                onValue(r, snap => resolve(snap.val()), { onlyOnce: true }, () => resolve(null));
            });
        }

        _set(path, value) {
            return new Promise((resolve, reject) => {
                if (!this._isReady) return reject("Not ready");
                this._writeQueue.push({ path, value, resolve, reject });
                this._scheduleWrite();
            });
        }

        _scheduleWrite() {
            clearTimeout(this._writeTimer);
            this._writeTimer = setTimeout(async () => {
                for (const item of this._writeQueue) {
                    try { 
                        const r = ref(this.db, item.path);
                        await set(r, item.value); 
                        item.resolve(true); 
                    }
                    catch (e) { 
                        console.warn("[Sergeant] Write failed:", e); 
                        item.reject(e); 
                    }
                }
                this._writeQueue = [];
            }, 2000);
        }

        _remove(path) {
            return new Promise(resolve => {
                if (!this._isReady) return resolve(false);
                const r = ref(this.db, path);
                remove(r).then(() => resolve(true)).catch(() => resolve(false));
            });
        }

        registerListeners() {
            this.listen("RAW_INTEL", intel => {
                if (intel?._processed) return;
                if (intel?.faction) {
                    this.factionId = intel.faction.faction_id || this.factionId;
                    this.syncFactionMembers(intel.faction);
                }
            });

            this.listen("REQUEST_ADD_SHARED_TARGET", t => t && this.addSharedTarget(t));
        }

        listen(evt, fn) {
            const unsub = this.general.signals.listen(evt, fn);
            this.listeners.push(unsub);
            return unsub;
        }

        addSharedTarget(t) {
            if (!t.id || !t.name) return;
            if (Date.now() - (t.timestamp || 0) > 604800000) return;
            this.sharedTargets.push(t);
            this.saveShared();
            this.general.signals.dispatch("SHARED_TARGETS_UPDATED", this.sharedTargets);
        }

        loadShared() {
            try {
                const raw = localStorage.getItem("war_shared_targets");
                if (raw) this.sharedTargets = JSON.parse(raw);
                else if (this._isReady && this.factionId) {
                    this._get(`/factions/${this.factionId}/targets`).then(data => {
                        if (data) this.sharedTargets = Object.values(data);
                    });
                }
            } catch {}
        }

        saveShared() {
            clearTimeout(this._pendingWrite);
            this._pendingWrite = setTimeout(() => {
                try {
                    localStorage.setItem("war_shared_targets", JSON.stringify(this.sharedTargets));
                    if (this._isReady && this.factionId) {
                        this.sharedTargets.forEach(t => {
                            this._set(`/factions/\( {this.factionId}/targets/ \){t.id}`, {
                                id: t.id,
                                name: t.name,
                                timestamp: Date.now()
                            });
                        });
                    }
                } catch {}
            }, 300);
        }

        syncFactionMembers(faction) {
            try {
                const members = faction.members || {};
                this.general.signals.dispatch("FACTION_MEMBERS_UPDATE", members);
                if (this._isReady && this.factionId) {
                    Object.entries(members).forEach(([uid, m]) => {
                        this._set(`/factions/\( {this.factionId}/members/ \){uid}`, {
                            factionID: this.factionId,
                            name: m.name
                        });
                    });
                }
            } catch (e) { console.error("[Sergeant] Sync error:", e); }
        }

        cleanup() {
            this.listeners.forEach(u => u());
            this.intervals.forEach(id => clearInterval(id));
            clearTimeout(this._writeTimer);
            this._writeQueue = [];
            this.listeners = [];
            this.intervals = [];
        }
    }

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Sergeant", new Sergeant());
    }
})();
