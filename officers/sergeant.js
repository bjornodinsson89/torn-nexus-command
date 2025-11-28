// === WAR_SERGEANT vΣ — NEXUS EXTERNAL COMMS ===

(function() {
    const firebaseConfig = {
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
        app: null,
        db: null,
        auth: null,
        factionId: null,
        sharedTargets: [],
        listeners: [],
        writeQueue: [],
        writeTimer: null,
        ready: false,

        init(G) {
            this.general = G;
            this.loadLocal();
            this.initFirebase().then(() => {
                this.ready = true;
                this.register();
            });
        },

        loadLocal() {
            try {
                const raw = localStorage.getItem("nexus_shared_targets");
                if (raw) this.sharedTargets = JSON.parse(raw);
            } catch {}
        },

        saveLocal() {
            localStorage.setItem("nexus_shared_targets", JSON.stringify(this.sharedTargets));
        },

        async initFirebase() {
            const urls = [
                'https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/10.13.1/firebase-database-compat.js',
                'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js'
            ];
            for (const u of urls) await this.general.loadPlugin(u);
            this.app = firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();
            this.auth = firebase.auth();
            await this.auth.signInAnonymously().catch(() => {});
        },

        register() {
            this.listen("RAW_INTEL", d => this.syncIntel(d));
            this.listen("REQUEST_ADD_SHARED_TARGET", t => this.addSharedTarget(t));
        },

        listen(ev, fn) {
            const u = this.general.signals.listen(ev, fn);
            this.listeners.push(u);
        },

        syncIntel(d) {
            if (!d?.faction?.id) return;
            this.factionId = d.faction.id;
            this.syncFactionMembers(d.faction.members || {});
        },

        syncFactionMembers(members) {
            if (!this.ready || !this.factionId) return;
            const base = `/factions/${this.factionId}/members`;
            Object.entries(members).forEach(([uid, m]) => {
                this.enqueueWrite(`${base}/${uid}`, {
                    id: uid,
                    name: m.name,
                    level: m.level || 0,
                    updated: Date.now()
                });
            });
        },

        addSharedTarget(t) {
            if (!t?.id || !t?.name) return;
            t.timestamp = Date.now();
            this.sharedTargets = this.sharedTargets.filter(x => x.id !== t.id);
            this.sharedTargets.push(t);
            this.saveLocal();
            this.general.signals.dispatch("SHARED_TARGETS_UPDATED", this.sharedTargets);
            if (this.ready && this.factionId) {
                this.enqueueWrite(`/factions/${this.factionId}/targets/${t.id}`, t);
            }
        },

        enqueueWrite(path, value) {
            this.writeQueue.push({ path, value });
            clearTimeout(this.writeTimer);
            this.writeTimer = setTimeout(() => this.flushWrites(), 1500);
        },

        flushWrites() {
            if (!this.ready) return;
            const q = [...this.writeQueue];
            this.writeQueue = [];
            q.forEach(item => {
                this.db.ref(item.path).set(item.value).catch(() => {});
            });
        }
    };

    if (window.WAR_GENERAL) window.WAR_GENERAL.register("Sergeant", Sergeant);
})();
