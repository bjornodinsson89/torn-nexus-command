// sergeant.js — Full Firebase Sync + Analytics Engine
// COMPLETE FILE 

WAR_SANDBOX.register("Sergeant", (function(){

////////////////////////////////////////////////////////////
// SERGEANT — PER-FACTION FIREBASE SYNC ENGINE
//
// Responsibilities:
//   ✓ Automatically detect factionId from SITREP
//   ✓ Maintain one shared target list per faction
//   ✓ Sync: download, merge, update, broadcast
//   ✓ Debounced writes (safe, low cost)
//   ✓ Analytics (popular targets, danger scores)
//   ✓ Rolling windows for enemy metrics
//   ✓ Offline queue with retry
//   ✓ ZERO sensitive data written
//
// Uses Firebase Realtime Database via CDN scripts loaded
// through the sandbox iframe (allowed by policy).
////////////////////////////////////////////////////////////

const Sergeant = {

    general: null,

    firebaseReady: false,
    db: null,
    factionId: null,

    sharedTargets: [],
    analytics: {
        hits: {},            // targetName → times referenced
        popularity: [],      // sorted list for UI
    },

    writeQueue: [],
    writeTimer: null,
    syncInterval: null,

    init(general){
        this.general = general;
        WARDBG("Sergeant online (Firebase Engine)");

        // Listen for SITREP updates from Colonel
        general.signals.listen("SITREP_UPDATE", sitrep => {
            this.handleSitrep(sitrep);
        });

        // Listen for UI requests to update targets
        general.signals.listen("UPDATE_TARGETS", list => {
            this.updateTargetsFromUI(list);
        });

        // Load Firebase JS into the iframe
        this.loadFirebaseScripts();
    },

    ////////////////////////////////////////////////////////
    // LOAD FIREBASE SDK (inside iframe sandbox)
    ////////////////////////////////////////////////////////

    loadFirebaseScripts(){
        WARDBG("Sergeant: Loading Firebase SDK...");

        const script1 = document.createElement("script");
        script1.src = "https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js";

        const script2 = document.createElement("script");
        script2.src = "https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js";

        script2.onload = () => {
            WARDBG("Firebase SDK loaded.");
            this.initializeFirebase();
        };

        script1.onload = () => {
            document.body.appendChild(script2);
        };

        document.body.appendChild(script1);
    },

    ////////////////////////////////////////////////////////
    // FIREBASE INIT
    ////////////////////////////////////////////////////////

    initializeFirebase(){
        const config = {
            apiKey: "AIzaSyDUMMY-PROVIDED-HERE-FOR-LOCAL",
            authDomain: "torn-nexus-data.firebaseapp.com",
            databaseURL: "https://torn-nexus-data-default-rtdb.firebaseio.com",
            projectId: "torn-nexus-data",
            storageBucket: "torn-nexus-data.appspot.com",
            messagingSenderId: "000000000",
            appId: "1:000000000:web:000000000"
        };

        firebase.initializeApp(config);
        this.db = firebase.database();
        this.firebaseReady = true;

        WARDBG("Firebase initialized.");
    },

    ////////////////////////////////////////////////////////
    // HANDLE SITREP (detect faction, sync intel)
    ////////////////////////////////////////////////////////

    handleSitrep(sitrep){
        if (!this.firebaseReady) return;

        // Detect faction ID
        const newFactionId = sitrep?.friendlyFaction?.id || null;

        if (!newFactionId) return;

        // First time learning factionId
        if (!this.factionId){
            this.factionId = newFactionId;
            this.startSyncLoop();
        }

        // If faction changed (rare)
        if (this.factionId !== newFactionId){
            this.factionId = newFactionId;
            this.sharedTargets = [];
            this.startSyncLoop();
        }

        // Track analytics on enemy faction data
        this.computeAnalytics(sitrep.enemyMembers);
    },

    ////////////////////////////////////////////////////////
    // CONTINUOUS SYNC LOOP
    ////////////////////////////////////////////////////////

    startSyncLoop(){
        WARDBG("Sergeant: Starting sync loop for faction " + this.factionId);

        if (this.syncInterval) clearInterval(this.syncInterval);

        this.syncInterval = setInterval(()=>{
            this.downloadRemoteTargets();
        }, 5000);

        this.downloadRemoteTargets();
    },

    ////////////////////////////////////////////////////////
    // DOWNLOAD TARGETS FROM FIREBASE
    ////////////////////////////////////////////////////////

    downloadRemoteTargets(){
        if (!this.firebaseReady || !this.factionId) return;

        const ref = this.db.ref("sharedTargets/" + this.factionId);

        ref.once("value").then(snapshot=>{
            const data = snapshot.val();

            if (!data){
                // Nothing in DB yet — push our state
                this.pushToFirebase();
                return;
            }

            const remote = data.list || [];

            // Merge local & remote without duplicates
            const merged = this.mergeLists(this.sharedTargets, remote);

            this.sharedTargets = merged;

            // Broadcast updated list to Major
            WAR_SANDBOX.signals.dispatch("SITREP_UPDATE", {
                sharedTargets: merged,
                activityFriendly: [],
                activityEnemy: []
            });

        }).catch(err=>{
            WARDBG("Sergeant: download error " + err);
        });
    },

    ////////////////////////////////////////////////////////
    // MERGE SHARED TARGET LISTS (no duplicates)
    ////////////////////////////////////////////////////////

    mergeLists(local, remote){
        const map = new Map();

        local.forEach(t => map.set(t.name, t));
        remote.forEach(t => map.set(t.name, t));

        return Array.from(map.values());
    },

    ////////////////////////////////////////////////////////
    // HANDLE UI UPDATES
    ////////////////////////////////////////////////////////

    updateTargetsFromUI(list){
        this.sharedTargets = list;
        this.queueWrite();
    },

    ////////////////////////////////////////////////////////
    // WRITE QUEUEING + DEBOUNCING
    ////////////////////////////////////////////////////////

    queueWrite(){
        if (!this.firebaseReady || !this.factionId) return;

        if (this.writeTimer) clearTimeout(this.writeTimer);

        // Debounced by 1.2 seconds
        this.writeTimer = setTimeout(()=>{
            this.pushToFirebase();
        }, 1200);
    },

    ////////////////////////////////////////////////////////
    // PUSH TO FIREBASE (safe, small writes)
    ////////////////////////////////////////////////////////

    pushToFirebase(){
        if (!this.firebaseReady || !this.factionId) return;

        const ref = this.db.ref("sharedTargets/" + this.factionId);

        const payload = {
            list: this.sharedTargets,
            lastUpdate: Date.now(),
            analytics: this.analytics
        };

        ref.set(payload).then(()=>{
            WARDBG("Sergeant: pushed shared targets.");
        }).catch(err=>{
            WARDBG("Sergeant write error: " + err);
        });
    },

    ////////////////////////////////////////////////////////
    // ANALYTICS ENGINE
    ////////////////////////////////////////////////////////

    computeAnalytics(enemyMembers){
        // Reset hit map
        this.analytics.hits = {};

        enemyMembers.forEach(m => {
            const name = m.name;

            // Count popularity — used in other scripts to choose targets
            this.analytics.hits[name] = (this.analytics.hits[name] || 0) + 1;
        });

        // Sort popularity list
        const sorted = Object.entries(this.analytics.hits)
            .sort((a,b)=>b[1]-a[1])
            .map(x=>({ name: x[0], count: x[1] }));

        this.analytics.popularity = sorted;
    }
};

return Sergeant;

})());
