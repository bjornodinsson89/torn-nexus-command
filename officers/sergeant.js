WARDBG("[OFFICER RAW LOAD] Sergeant.js");

function NEXUS_SERGEANT_MODULE() {

    WARDBG("[OFFICER START] Sergeant.js");

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
        ready: false,

        init(G) {
            this.general = G;
            WARDBG("Sergeant init()");
            this.loadLocal();
            this.initFirebase().then(() => {
                this.ready = true;
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

            try { await this.auth.signInAnonymously(); } catch {}
        }
    };

    WARDBG("[OFFICER END] Sergeant.js");

    if (window.WAR_GENERAL) {
        WARDBG("Sergeant registering with WAR_GENERAL");
        window.WAR_GENERAL.register("Sergeant", Sergeant);
    } else {
        WARDBG("ERROR: window.WAR_GENERAL missing during Sergeant registration.");
    }
}

NEXUS_SERGEANT_MODULE();
