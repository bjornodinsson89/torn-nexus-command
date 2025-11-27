/********************************************************************
 * MAJOR v6.0 – WARLORD GUI (Cyber-Tactical Interface)
 * • Visuals: Neon HUD, Meltdown Animations, Gradient Bars
 * • Features: Full Roster, War Intel, Cloud Target Database
 ********************************************************************/

(function() {

class Major {

    constructor() {
        this.general = null;
        this.host = null;
        this.root = null;

        // UI Components
        this.drawer = null;
        this.toggleBtn = null;
        this.tabs = {};
        this.activeTab = "dashboard";

        // Settings (Persisted)
        this.settings = {
            drawerSide: localStorage.getItem("warroom_drawerSide") || "left",
            toggleX: Number(localStorage.getItem("war_toggle_x") || 25),
            toggleY: Number(localStorage.getItem("war_toggle_y") || 150),
            panicThreshold: Number(localStorage.getItem("war_panic_threshold") || 30)
        };

        // State Cache
        this.cache = {
            chain: { current: 0, max: 0, timeout: 0 },
            factionMembers: {},
            war: { wall: 0, score: {}, enemies: [] },
            sharedTargets: []
        };

        // Dragging State
        this._isDragging = false;
        this._dragMoved = false;
        
        // Throttling
        this._lastRender = 0;
        this._rafId = null;
    }

    /**************************************************************
     * INITIALIZATION
     **************************************************************/
    init(G) {
        this.cleanup();
        this.general = G;

        this.createHost();
        this.createShadow();
        this.injectStyles();

        this.createToggleButton();
        this.createDrawer();
        this.buildTabs();
        this.buildPanels();
        this.registerSignals();

        this.activateTab("dashboard");

        console.log("%c[Major v6.0] Warlord GUI Online", "color:#0f0; font-weight:bold;");
    }

    /**************************************************************
     * DOM ARCHITECTURE
     **************************************************************/
    createHost() {
        let host = document.getElementById("war-room-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "war-room-host";
            host.style.cssText = "position:fixed; top:0; left:0; width:0; height:0; z-index:999999;";
            document.body.appendChild(host);
        }
        this.host = host;
    }

    createShadow() {
        this.root = this.host.shadowRoot || this.host.attachShadow({ mode: "open" });
    }

    /**************************************************************
     * CYBER-TACTICAL CSS
     **************************************************************/
    injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
        :host {
            --bg: #050505;
            --panel: rgba(10, 10, 10, 0.95);
            --border: #00ff66;
            --text-main: #e0ffe0;
            --text-dim: #558866;
            --accent: #00ff66;
            --danger: #ff0033;
            --warn: #ffcc00;
            --font: "Segoe UI", Consolas, monospace;
            --glass: rgba(0, 255, 102, 0.05);
        }

        /* --- ANIMATIONS --- */
        @keyframes pulse-danger {
            0% { box-shadow: 0 0 10px rgba(255, 0, 51, 0.2) inset; border-color: #500; }
            50% { box-shadow: 0 0 30px rgba(255, 0, 51, 0.6) inset; border-color: #f00; }
            100% { box-shadow: 0 0 10px rgba(255, 0, 51, 0.2) inset; border-color: #500; }
        }

        @keyframes scanline {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
        }

        /* --- TOGGLE BUTTON --- */
        #wr-toggle-btn {
            position: fixed;
            width: 44px; height: 44px;
            background: #000;
            color: var(--accent);
            border: 2px solid var(--accent);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; cursor: pointer;
            box-shadow: 0 0 15px rgba(0,255,102, 0.3);
            z-index: 9999999;
            user-select: none;
            transition: transform 0.1s, box-shadow 0.2s;
        }
        #wr-toggle-btn:hover { box-shadow: 0 0 25px var(--accent); transform: scale(1.1); }
        #wr-toggle-btn:active { transform: scale(0.95); }

        /* --- DRAWER --- */
        #wr-drawer {
            position: fixed; top: 0; bottom: 0;
            width: 360px;
            background: var(--panel);
            backdrop-filter: blur(10px);
            border-right: 1px solid var(--accent);
            display: flex; flex-direction: column;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            font-family: var(--font);
            color: var(--text-main);
            box-shadow: 0 0 50px rgba(0,0,0,0.8);
        }
        #wr-drawer.right { left: auto; right: 0; border-left: 1px solid var(--accent); border-right: none; transform: translateX(100%); }
        #wr-drawer.open { transform: translateX(0); }

        /* --- HEADER --- */
        #wr-header {
            padding: 15px;
            background: linear-gradient(90deg, #000, #111);
            border-bottom: 1px solid var(--accent);
            text-align: center;
            font-size: 14px; letter-spacing: 2px;
            font-weight: 800; color: var(--accent);
            text-transform: uppercase;
            position: relative;
            overflow: hidden;
        }
        #wr-header::after {
            content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(rgba(0,255,102,0.1), transparent);
            animation: scanline 3s linear infinite;
            pointer-events: none;
        }

        /* --- TABS --- */
        #wr-tabs { display: flex; background: #080808; border-bottom: 1px solid #333; }
        .wr-tab {
            flex: 1; padding: 12px 0;
            text-align: center; font-size: 11px; font-weight: bold;
            color: var(--text-dim); cursor: pointer;
            text-transform: uppercase;
            transition: 0.2s;
            border-bottom: 2px solid transparent;
        }
        .wr-tab:hover { color: #fff; background: #111; }
        .wr-tab.active { color: var(--accent); border-bottom: 2px solid var(--accent); background: var(--glass); }

        /* --- PANELS --- */
        .wr-panel { flex: 1; overflow-y: auto; padding: 15px; display: none; }
        .wr-panel.active { display: block; animation: fade-in 0.2s; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        /* --- SCROLLBAR --- */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--accent); }

        /* --- CHAIN HUD --- */
        .hud-box {
            background: rgba(0,0,0,0.6);
            border: 1px solid #333;
            border-radius: 4px;
            padding: 12px; margin-bottom: 15px;
            position: relative;
        }
        .hud-title { font-size: 10px; color: var(--text-dim); margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase; }
        
        .chain-timer-big { font-size: 32px; font-weight: bold; color: #fff; text-align: right; line-height: 1; }
        .chain-meta { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4px; }
        
        .progress-track { height: 8px; background: #222; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #ccffcc); width: 0%; transition: width 0.3s ease-out; }
        
        /* PANIC STATE */
        .hud-box.panic {
            animation: pulse-danger 1s infinite;
            background: rgba(40, 0, 0, 0.3);
        }
        .hud-box.panic .progress-fill { background: var(--danger); }
        .hud-box.panic .chain-timer-big { color: var(--danger); }

        /* --- TABLES --- */
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; color: var(--text-dim); padding: 4px 8px; border-bottom: 1px solid #333; }
        td { padding: 6px 8px; border-bottom: 1px solid #222; color: #ccc; }
        tr:hover td { background: var(--glass); color: #fff; }
        
        .status-ok { color: var(--accent); }
        .status-hosp { color: var(--danger); font-weight: bold; }
        .status-travel { color: var(--warn); }

        /* --- INPUTS --- */
        input[type="text"], input[type="number"] {
            background: #111; border: 1px solid #333;
            color: var(--accent); padding: 8px;
            width: 100%; box-sizing: border-box;
            font-family: var(--font); margin-bottom: 8px;
        }
        input:focus { border-color: var(--accent); outline: none; }
        
        .btn {
            background: #111; border: 1px solid var(--accent);
            color: var(--accent); padding: 8px; width: 100%;
            cursor: pointer; font-weight: bold; text-transform: uppercase;
            font-size: 11px; transition: 0.2s;
        }
        .btn:hover { background: var(--accent); color: #000; }
        
        .btn-sm { width: auto; padding: 2px 6px; font-size: 10px; }

        .row-gap { margin-bottom: 10px; }
        `;
        this.root.appendChild(style);
    }

    /**************************************************************
     * COMPONENT BUILDERS
     **************************************************************/
    createToggleButton() {
        const btn = document.createElement("div");
        btn.id = "wr-toggle-btn";
        btn.innerHTML = "⚡"; 
        btn.style.top = this.settings.toggleY + "px";
        btn.style.left = this.settings.toggleX + "px";
        this.root.appendChild(btn);
        this.toggleBtn = btn;
        this.makeDraggable(btn);
        btn.onclick = () => { if(!this._isDragging) this.toggleDrawer(); };
    }

    createDrawer() {
        this.drawer = document.createElement("div");
        this.drawer.id = "wr-drawer";
        this.drawer.className = this.settings.drawerSide;
        this.drawer.innerHTML = `
            <div id="wr-header">WAR ROOM <span style="font-size:10px; opacity:0.5;">v6.0</span></div>
            <div id="wr-tabs"></div>
            <div id="wr-panel-dashboard" class="wr-panel"></div>
            <div id="wr-panel-targets" class="wr-panel"></div>
            <div id="wr-panel-roster" class="wr-panel"></div>
            <div id="wr-panel-war" class="wr-panel"></div>
            <div id="wr-panel-settings" class="wr-panel"></div>
        `;
        this.root.appendChild(this.drawer);
    }

    buildTabs() {
        const c = this.drawer.querySelector("#wr-tabs");
        const tabs = [
            { id: "dashboard", lbl: "Tac-Com" },
            { id: "targets", lbl: "Cloud" },
            { id: "roster", lbl: "Roster" },
            { id: "war", lbl: "War" },
            { id: "settings", lbl: "Sys" }
        ];
        tabs.forEach(t => {
            const el = document.createElement("div");
            el.className = "wr-tab";
            el.textContent = t.lbl;
            el.onclick = () => this.activateTab(t.id);
            c.appendChild(el);
            this.tabs[t.id] = el;
        });
    }

    buildPanels() {
        // --- DASHBOARD ---
        this.drawer.querySelector("#wr-panel-dashboard").innerHTML = `
            <div class="hud-box" id="hud-chain">
                <div class="chain-meta">
                    <div class="hud-title">CHAIN LINK</div>
                    <div id="hud-chain-hits" style="font-size:12px; color:#fff;">0 / 0</div>
                </div>
                <div class="chain-timer-big" id="hud-chain-timer">00.00</div>
                <div class="progress-track" style="margin-top:8px;">
                    <div class="progress-fill" id="hud-chain-bar"></div>
                </div>
            </div>

            <div class="hud-box">
                <div class="hud-title">WAR OVERVIEW</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="color:#aaa;">Our Score</span>
                    <span style="color:#fff; font-weight:bold;" id="hud-war-us">0</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="color:#aaa;">Enemy Score</span>
                    <span style="color:#fff; font-weight:bold;" id="hud-war-them">0</span>
                </div>
                <div style="height:1px; background:#333; margin:8px 0;"></div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#aaa;">Territory Wall</span>
                    <span style="color:var(--accent);" id="hud-war-wall">--</span>
                </div>
            </div>
            
            <div class="hud-box" style="border-color:#333;">
                 <div class="hud-title">SYSTEM STATUS</div>
                 <div style="font-size:11px; color:#666;">
                    • Sergeant: <span style="color:#0f0">ONLINE</span><br>
                    • Database: <span style="color:#0f0">CONNECTED</span><br>
                    • Silo ID: <span style="color:#fff" id="hud-silo-id">...</span>
                 </div>
            </div>
        `;

        // --- TARGETS (CLOUD) ---
        this.drawer.querySelector("#wr-panel-targets").innerHTML = `
            <div class="hud-box">
                <div class="hud-title">PUSH TARGET TO CLOUD</div>
                <input type="number" id="inp-target-id" placeholder="Torn ID" />
                <input type="text" id="inp-target-name" placeholder="Name (Optional)" />
                <button class="btn" id="btn-push-target">UPLOAD INTEL</button>
            </div>
            <div class="hud-title" style="margin-top:15px;">SHARED DATABASE</div>
            <table>
                <thead><tr><th>ID</th><th>Name</th><th>Age</th><th>Link</th></tr></thead>
                <tbody id="table-targets"></tbody>
            </table>
        `;
        
        // Target Logic
        const btnPush = this.drawer.querySelector("#btn-push-target");
        btnPush.onclick = () => {
            const id = this.drawer.querySelector("#inp-target-id").value;
            const name = this.drawer.querySelector("#inp-target-name").value || "Target-" + id;
            if(!id) return;
            // SIGNAL TO SERGEANT
            this.general.signals.dispatch("REQUEST_ADD_SHARED_TARGET", { 
                id: id, 
                name: name,
                timestamp: Date.now() 
            });
            // Clear inputs
            this.drawer.querySelector("#inp-target-id").value = "";
            this.drawer.querySelector("#inp-target-name").value = "";
        };

        // --- ROSTER ---
        this.drawer.querySelector("#wr-panel-roster").innerHTML = `
            <table>
                <thead><tr><th>Mbr</th><th>St</th><th>Time</th><th>Act</th></tr></thead>
                <tbody id="table-roster"></tbody>
            </table>
        `;

        // --- WAR ---
        this.drawer.querySelector("#wr-panel-war").innerHTML = `
            <table>
                <thead><tr><th>Enemy</th><th>Lvl</th><th>St</th><th>Time</th><th>Link</th></tr></thead>
                <tbody id="table-war"></tbody>
            </table>
        `;

        // --- SETTINGS ---
        this.drawer.querySelector("#wr-panel-settings").innerHTML = `
            <div class="row-gap">
                <div class="hud-title">PANIC THRESHOLD</div>
                <input type="range" id="inp-panic" min="5" max="60" style="width:100%" value="${this.settings.panicThreshold}">
                <div style="text-align:right; color:#fff;" id="lbl-panic">${this.settings.panicThreshold}s</div>
            </div>
            <button class="btn" id="btn-switch-side">SWITCH DRAWER SIDE</button>
        `;
        
        this.drawer.querySelector("#inp-panic").oninput = (e) => {
            this.settings.panicThreshold = Number(e.target.value);
            this.drawer.querySelector("#lbl-panic").innerText = e.target.value + "s";
            localStorage.setItem("war_panic_threshold", this.settings.panicThreshold);
            this.renderDashboard(); // Update visuals immediately
        };
        
        this.drawer.querySelector("#btn-switch-side").onclick = () => {
            this.settings.drawerSide = this.settings.drawerSide === "left" ? "right" : "left";
            localStorage.setItem("warroom_drawerSide", this.settings.drawerSide);
            this.drawer.className = this.settings.drawerSide;
        };
    }

    /**************************************************************
     * SIGNAL WIRING
     **************************************************************/
    registerSignals() {
        // From Colonel (Unified Data)
        this.general.signals.listen("SITREP_UPDATE", data => {
            if(!data) return;
            this.cache.chain = data.chain || this.cache.chain;
            this.cache.war = data.war || this.cache.war;
            if(data.faction) {
                this.cache.factionMembers = data.faction.members || {};
                // If Colonel sends faction ID, update UI
                if(data.faction.id) {
                    const el = this.drawer.querySelector("#hud-silo-id");
                    if(el) el.innerText = data.faction.id;
                }
            }
            this.requestRender();
        });

        // From Sergeant (Cloud Data)
        this.general.signals.listen("SHARED_TARGETS_UPDATED", list => {
            this.cache.sharedTargets = list || [];
            this.renderTargets();
        });
        
        // Also listen for raw roster updates from Sergeant
        this.general.signals.listen("FACTION_MEMBERS_UPDATE", members => {
            this.cache.factionMembers = members || {};
            this.renderRoster();
        });
    }

    /**************************************************************
     * RENDERING ENGINE (Throttled)
     **************************************************************/
    requestRender() {
        if(this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = requestAnimationFrame(() => {
            this.renderDashboard();
            this.renderRoster();
            this.renderWar();
        });
    }

    renderDashboard() {
        const c = this.cache.chain;
        const hud = this.drawer.querySelector("#hud-chain");
        
        // Update Chain Texts
        this.drawer.querySelector("#hud-chain-hits").innerText = `${c.current} / ${c.max || '∞'}`;
        this.drawer.querySelector("#hud-chain-timer").innerText = (c.timeout || 0).toFixed(0) + "s";
        
        // Update Bar
        const pct = c.max ? (c.current / c.max) * 100 : 0;
        this.drawer.querySelector("#hud-chain-bar").style.width = pct + "%";
        
        // Panic Logic
        const isPanic = (c.timeout > 0 && c.timeout <= this.settings.panicThreshold);
        if(isPanic) hud.classList.add("panic");
        else hud.classList.remove("panic");
        
        // War Stats
        const w = this.cache.war;
        this.drawer.querySelector("#hud-war-us").innerText = w.score?.faction || 0;
        this.drawer.querySelector("#hud-war-them").innerText = w.score?.enemy || 0;
        this.drawer.querySelector("#hud-war-wall").innerText = w.wall?.health || "--";
    }

    renderTargets() {
        const tbody = this.drawer.querySelector("#table-targets");
        if(!tbody) return;
        
        // Sort by newest
        const list = [...this.cache.sharedTargets].sort((a,b) => b.timestamp - a.timestamp);
        
        let html = "";
        list.forEach(t => {
            const ageMins = Math.floor((Date.now() - t.timestamp) / 60000);
            html += `
                <tr>
                    <td>${t.id}</td>
                    <td style="color:#fff">${t.name}</td>
                    <td style="color:#888">${ageMins}m</td>
                    <td><a href="https://www.torn.com/loader.php?sid=attack&userID=${t.id}" target="_blank" style="color:var(--accent)">⚔️</a></td>
                </tr>
            `;
        });
        tbody.innerHTML = list.length ? html : `<tr><td colspan="4" style="text-align:center; padding:10px;">No Cloud Targets</td></tr>`;
    }

    renderRoster() {
        const tbody = this.drawer.querySelector("#table-roster");
        if(!tbody) return;
        
        let html = "";
        Object.values(this.cache.factionMembers).forEach(m => {
            const s = m.status?.state || "N/A";
            let sClass = "status-ok";
            let time = "OK";
            
            if(s.includes("Hospital")) { sClass = "status-hosp"; time = this.fmtTime(m.status.until); }
            else if(s.includes("Travel")) { sClass = "status-travel"; }
            
            html += `
                <tr>
                    <td>${m.name}</td>
                    <td class="${sClass}">${s}</td>
                    <td>${time}</td>
                    <td style="font-size:10px">${m.last_action?.relative || '-'}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    renderWar() {
        const tbody = this.drawer.querySelector("#table-war");
        if(!tbody) return;
        
        const enemies = this.cache.war.enemies || [];
        let html = "";
        
        enemies.forEach(e => {
            const s = e.status?.state || "N/A";
            let sClass = "status-ok";
            let time = "OK";
            
            if(s.includes("Hospital")) { sClass = "status-hosp"; time = this.fmtTime(e.status.until); }
            else if(s.includes("Travel")) { sClass = "status-travel"; }

            html += `
                <tr>
                    <td>${e.name}</td>
                    <td>${e.level}</td>
                    <td class="${sClass}">${s}</td>
                    <td>${time}</td>
                    <td><a href="https://www.torn.com/loader.php?sid=attack&userID=${e.id}" target="_blank" style="color:var(--accent)">⚔️</a></td>
                </tr>
            `;
        });
        tbody.innerHTML = enemies.length ? html : `<tr><td colspan="5" style="text-align:center; padding:10px;">No Active Enemies</td></tr>`;
    }

    /**************************************************************
     * UTILS
     **************************************************************/
    fmtTime(ts) {
        if(!ts) return "--";
        const sec = ts - (Date.now()/1000);
        if(sec <= 0) return "0s";
        const m = Math.floor(sec / 60);
        return `${m}m ${Math.floor(sec%60)}s`;
    }

    makeDraggable(el) {
        let sx=0, sy=0, ox=0, oy=0;
        el.onmousedown = (e) => {
            this._isDragging = false;
            sx = e.clientX; sy = e.clientY;
            ox = el.offsetLeft; oy = el.offsetTop;
            
            const move = (ev) => {
                const dx = ev.clientX - sx;
                const dy = ev.clientY - sy;
                if(Math.abs(dx)>2 || Math.abs(dy)>2) this._isDragging = true;
                el.style.left = (ox + dx) + "px";
                el.style.top = (oy + dy) + "px";
            };
            const stop = () => {
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", stop);
                localStorage.setItem("war_toggle_x", el.style.left.replace("px",""));
                localStorage.setItem("war_toggle_y", el.style.top.replace("px",""));
            };
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", stop);
        };
    }

    activateTab(id) {
        this.activeTab = id;
        Object.values(this.tabs).forEach(el => el.classList.remove("active"));
        this.tabs[id].classList.add("active");
        
        this.drawer.querySelectorAll(".wr-panel").forEach(p => p.classList.remove("active"));
        this.drawer.querySelector(`#wr-panel-${id}`).classList.add("active");
        
        // Force render appropriate data
        if(id === "targets") this.renderTargets();
        if(id === "roster") this.renderRoster();
        if(id === "war") this.renderWar();
    }

    toggleDrawer() {
        this.drawer.classList.toggle("open");
    }

    cleanup() {
        if(this.host) this.host.remove();
        if(this._rafId) cancelAnimationFrame(this._rafId);
    }
}

if(window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Major", new Major());
}

})();
