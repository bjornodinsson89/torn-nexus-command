WARDBG("[OFFICER RAW LOAD] Sergeant.js");

function NEXUS_SERGEANT_MODULE() {

WARDBG("[OFFICER START] Sergeant.js");

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
    ready: false,
    app: null,
    db: null,
    auth: null,

    factionId: null,

    sharedTargets: [],

    init(G) {
        this.general = G;
        WARDBG("Sergeant init()");

        this.loadLocal();

        this.loadFirebase()
            .then(() => this.initFirebase())
            .catch(e => WARDBG("Firebase load failed: " + e));
    },

    /************************************************************
     * LOCAL FALLBACK
     ************************************************************/
    loadLocal() {
        try {
            const raw = localStorage.getItem("nexus_shared");
            if (raw) {
                this.sharedTargets = JSON.parse(raw);
                WARDBG("Local shared targets loaded.");
            }
        } catch {
            WARDBG("Local shared load failed.");
        }
    },

    saveLocal() {
        localStorage.setItem("nexus_shared", JSON.stringify(this.sharedTargets));
        WARDBG("Local shared targets saved.");
    },

    /************************************************************
     * REMOTE LIBRARY LOADING (CSP-SAFE)
     ************************************************************/
    async loadFirebase() {
        const libs = [
            "https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/10.13.1/firebase-database-compat.js",
            "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js"
        ];

        for (const url of libs) {
            WARDBG("Loading Firebase lib: " + url);
            await this.general.loadPlugin(url);  // uses TM sandbox + new Function()
        }
    },

    /************************************************************
     * FIREBASE INITIALIZATION
     ************************************************************/
    async initFirebase() {
        WARDBG("Initializing Firebase...");

        try {
            this.app = firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();
            this.auth = firebase.auth();

            await this.auth.signInAnonymously();
            WARDBG("Firebase anonymous auth successful.");

            this.ready = true;

            this.beginSync();

        } catch (e) {
            WARDBG("Firebase init failure: " + e);
        }
    },

    /************************************************************
     * SHARED TARGET SYNC
     ************************************************************/
    beginSync() {
        WARDBG("Sergeant sync activated.");

        const ref = this.db.ref("sharedTargets");

        ref.on("value", snapshot => {
            const data = snapshot.val() || [];
            WARDBG("Remote shared target update received.");
            this.sharedTargets = data;
            this.saveLocal();
            this.general.signals.dispatch("SHARED_TARGETS_UPDATED", data);
        });
    },

    /************************************************************
     * PUBLIC ACTIONS
     ************************************************************/
    pushSharedTargets(list) {
        if (!this.ready) {
            WARDBG("Sergeant not ready for upload.");
            return;
        }

        this.sharedTargets = list;
        this.saveLocal();

        this.db.ref("sharedTargets").set(list)
            .then(() => WARDBG("Shared targets uploaded."))
            .catch(e => WARDBG("Upload failed: " + e));
    }
};

WARDBG("[OFFICER END] Sergeant.js");

if (window.WAR_GENERAL)
    window.WAR_GENERAL.register("Sergeant", Sergeant);

}

NEXUS_SERGEANT_MODULE();
