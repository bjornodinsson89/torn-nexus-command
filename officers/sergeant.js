(function() {
    WARDBG("[OFFICER START] sergeant.js");
    const config = {
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
        shared: [],
        writeQueue: [],
        writeTimer: null,
        ready: false,

        init(G) {
            this.general = G;
            WARDBG("Sergeant init()");
            this.loadLocal();
            this.initFirebase().then(() => {
                this.ready = true;
                this.hook();
            });
        },

        loadLocal() {
            try {
                const raw = localStorage.getItem("nexus_shared_targets");
                if (raw) this.shared = JSON.parse(raw);
            } catch {}
        },

        saveLocal() {
            localStorage.setItem("nexus_shared_targets", JSON.stringify(this.shared));
        },

        async initFirebase() {
            const libs = [
                "https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js",
                "https://www.gstatic.com/firebasejs/10.13.1/firebase-database-compat.js",
                "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js"
            ];

            for (const u of libs) {
                WARDBG("Firebase library: " + u);
                await this.general.loadPlugin(u);
            }

            this.app = firebase.initializeApp(config);
            this.db = firebase.database();
            this.auth = firebase.auth();

            await this.auth.signInAnonymously().catch(() => {});
        },

        hook() {
            this.general.signals.listen("RAW_INTEL", d => this.syncIntel(d));
            this.general.signals.listen("REQUEST_ADD_SHARED_TARGET", t => this.addShared(t));
        },

        syncIntel(d) {
            if (!d?.faction?.id) return;
            this.factionId = d.faction.id;
            this.syncMembers(d.faction.members || {});
        },

        syncMembers(members) {
            if (!this.ready || !this.factionId) return;
            const base = `/factions/${this.factionId}/members`;

            for (const [id, m] of Object.entries(members)) {
                this.enqueue(`${base}/${id}`, {
                    id,
                    name: m.name,
                    level: m.level || 0,
                    updated: Date.now()
                });
            }
        },

        addShared(t) {
            if (!t?.id || !t?.name) return;
            t.timestamp = Date.now();

            this.shared = this.shared.filter(x => x.id !== t.id);
            this.shared.push(t);

            this.saveLocal();

            this.general.signals.dispatch("SHARED_TARGETS_UPDATED", this.shared);

            if (this.ready && this.factionId)
                this.enqueue(`/factions/${this.factionId}/targets/${t.id}`, t);
        },

        enqueue(path, value) {
            this.writeQueue.push({ path, value });
            clearTimeout(this.writeTimer);
            this.writeTimer = setTimeout(() => this.flush(), 1500);
        },

        flush() {
            if (!this.ready) return;

            const q = [...this.writeQueue];
            this.writeQueue.length = 0;

            q.forEach(item => {
                this.db.ref(item.path).set(item.value);
            });
        }
    };
    WARDBG("[OFFICER END] sergeant.js");

    if (window.WAR_GENERAL) WAR_GENERAL.register("Sergeant", Sergeant);
})();
