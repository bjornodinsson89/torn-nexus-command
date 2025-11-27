/********************************************************************
 * MAJOR v5.0 – GUI Officer 
 ********************************************************************/

(function() {
    class Major {
        constructor() {
            this.general = null;
            this.host = null;
            this.root = null;
            this.drawer = null;
            this.toggleBtn = null;
            this.tabs = {};
            this.activeTab = "dashboard";
            this.settings = {
                drawerSide: localStorage.getItem("warroom_drawerSide") || "left",
                toggleX: Number(localStorage.getItem("war_toggle_x") || 25),
                toggleY: Number(localStorage.getItem("war_toggle_y") || 150),
                panicThreshold: Number(localStorage.getItem("war_panic_threshold") || 25)
            };
            this.listeners = [];
            this.cache = { chain: null, factionMembers: {}, war: null };
            this._lastRender = 0;
        }

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
            console.log("%c[Major v5.0] GUI Online", "color:#0f6");
        }

        createHost() {
            let host = document.getElementById("war-room-host");
            if (!host) {
                host = document.createElement("div");
                host.id = "war-room-host";
                host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:999999;";
                document.body.appendChild(host);
            }
            this.host = host;
        }

        createShadow() {
            this.root = this.host.shadowRoot || this.host.attachShadow({ mode: "open" });
        }

        injectStyles() {
            const style = document.createElement("style");
            style.textContent = `:host{--bg:#0e0e0e;--panel:#1a1a1a;--accent:#00ff66;--danger:#ff3355;--text:#e0ffe0;--subtext:#88cc99;--border:#00cc55;font-family:Consolas,monospace}#wr-toggle-btn{position:fixed;width:42px;height:42px;background:#0f0f0f;color:var(--accent);font-size:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:2px solid var(--accent);cursor:pointer;z-index:9999999;user-select:none;box-shadow:0 0 8px var(--accent);transition:box-shadow .2s}#wr-drawer{position:fixed;top:0;height:100vh;width:350px;background:var(--panel);color:var(--text);border-right:2px solid var(--accent);transform:translateX(-100%);transition:transform .25s;z-index:9999998;display:flex;flex-direction:column}#wr-drawer.right{border-left:2px solid var(--accent);border-right:none;transform:translateX(100%)}#wr-drawer.open{transform:translateX(0)!important}#wr-header{padding:12px;background:#111;border-bottom:2px solid var(--accent);text-align:center;font-weight:bold}#wr-tabs{display:flex;background:#111;border-bottom:1px solid var(--accent)}.wr-tab{padding:10px 14px;cursor:pointer;flex:1;text-align:center;color:var(--subtext)}.wr-tab.active{background:#0a0a0a;color:var(--accent);border-bottom:2px solid var(--accent)}.wr-panel{flex:1;overflow-y:auto;padding:14px;display:none;background:var(--bg)}.wr-panel.active{display:block}.chain-hud{padding:12px;border:1px solid var(--accent);border-radius:6px;background:#000;margin-bottom:12px}.chain-bar{background:#222;height:20px;border-radius:10px;overflow:hidden;position:relative}.chain-bar-fill{height:100%;background:var(--accent);transition:width .25s}.chain-bar-text{position:absolute;top:0;left:0;width:100%;text-align:center;line-height:20px;color:#000;font-weight:bold}.panic{box-shadow:0 0 12px var(--danger);border-color:var(--danger)}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:4px;border-bottom:1px solid #1a1}tr:hover{background:rgba(0,255,102,0.07)}.row-danger{color:var(--danger)}`;
            this.root.appendChild(style);
        }

        createToggleButton() {
            const btn = document.createElement("div");
            btn.id = "wr-toggle-btn";
            btn.textContent = "WAR";
            btn.style.top = this.settings.toggleY + "px";
            btn.style.left = this.settings.toggleX + "px";
            this.root.appendChild(btn);
            this.toggleBtn = btn;
            this.makeDraggable(btn);
            btn.addEventListener("click", () => this.toggleDrawer());
        }

        makeDraggable(btn) {
            let sx, sy, ox, oy;
            btn.addEventListener("mousedown", e => {
                sx = e.clientX; sy = e.clientY;
                ox = parseInt(btn.style.left);
                oy = parseInt(btn.style.top);
                const move = ev => {
                    btn.style.left = (ox + ev.clientX - sx) + "px";
                    btn.style.top = (oy + ev.clientY - sy) + "px";
                };
                const up = () => {
                    localStorage.setItem("war_toggle_x", btn.style.left.replace("px",""));
                    localStorage.setItem("war_toggle_y", btn.style.top.replace("px",""));
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
            });
        }

        createDrawer() {
            const drawer = document.createElement("div");
            drawer.id = "wr-drawer";
            drawer.className = this.settings.drawerSide;
            drawer.innerHTML = `<div id="wr-header">WAR ROOM</div><div id="wr-tabs"></div><div id="wr-panel-dashboard" class="wr-panel"></div><div id="wr-panel-roster" class="wr-panel"></div><div id="wr-panel-war" class="wr-panel"></div><div id="wr-panel-settings" class="wr-panel"></div>`;
            this.root.appendChild(drawer);
            this.drawer = drawer;
        }

        buildTabs() {
            const tabs = this.root.querySelector("#wr-tabs");
            ["dashboard", "roster", "war", "settings"].forEach(id => {
                const tab = document.createElement("div");
                tab.className = "wr-tab";
                tab.textContent = id.charAt(0).toUpperCase() + id.slice(1);
                tab.onclick = () => this.activateTab(id);
                tabs.appendChild(tab);
                this.tabs[id] = tab;
            });
        }

        activateTab(name) {
            this.activeTab = name;
            Object.entries(this.tabs).forEach(([k, t]) => t.classList.toggle("active", k === name));
            ["dashboard", "roster", "war", "settings"].forEach(id => {
                this.root.querySelector(`#wr-panel-${id}`).classList.toggle("active", id === name);
            });
        }

        buildPanels() {
            // FIXED: Broken template literals corrected here
            this.root.querySelector("#wr-panel-dashboard").innerHTML = `<div class="chain-hud"><div class="chain-title">CHAIN <span id="dash-chain-timer">--</span></div><div class="chain-bar"><div class="chain-bar-fill" id="dash-chain-fill"></div><div class="chain-bar-text" id="dash-chain-text">-- / --</div></div></div><div class="chain-hud">WAR STATUS<br>Wall: <span id="dash-wall">--</span><br>Score: <span id="dash-score">--</span></div>`;
            this.root.querySelector("#wr-panel-roster").innerHTML = `<table><thead><tr><th>Name</th><th>Status</th><th>Time</th><th>Activity</th></tr></thead><tbody id="faction-table"></tbody></table>`;
            this.root.querySelector("#wr-panel-war").innerHTML = `<table><thead><tr><th>Enemy</th><th>Lvl</th><th>Status</th><th>Time</th><th>Link</th></tr></thead><tbody id="war-table"></tbody></table>`;
            
            // FIXED: Corrected value interpolation for range input
            this.root.querySelector("#wr-panel-settings").innerHTML = `<div class="setting-row"><div class="setting-label">Panic Threshold (s)</div><input type="range" id="panicSlider" min="5" max="60" value="${this.settings.panicThreshold}"><div id="panicValue">${this.settings.panicThreshold}s</div></div><button id="drawerSideBtn">Switch Side</button>`;
            
            this.root.querySelector("#panicSlider").oninput = e => {
                this.settings.panicThreshold = +e.target.value;
                localStorage.setItem("war_panic_threshold", e.target.value);
                this.root.querySelector("#panicValue").textContent = e.target.value + "s";
                this.renderChainHUD();
            };
            this.root.querySelector("#drawerSideBtn").onclick = () => {
                this.settings.drawerSide = this.settings.drawerSide === "left" ? "right" : "left";
                localStorage.setItem("warroom_drawerSide", this.settings.drawerSide);
                this.drawer.classList.toggle("right");
            };
        }

        registerSignals() {
            this.listen("SITREP_UPDATE", sitrep => {
                if (sitrep?._processed) return;
                this.cache.chain = sitrep.chain || null;
                this.cache.war = sitrep.war || null;
                if (sitrep.faction?.members) this.cache.factionMembers = sitrep.faction.members;
                this.throttledRender();
            });
            this.listen("FACTION_MEMBERS_UPDATE", members => {
                this.cache.factionMembers = members || {};
                this.renderRoster();
            });
        }

        listen(evt, fn) {
            const unsub = this.general.signals.listen(evt, fn);
            this.listeners.push(unsub);
        }

        throttledRender() {
            const now = Date.now();
            if (now - this._lastRender < 500) return;
            this._lastRender = now;
            this.renderAll();
        }

        renderAll() {
            this.renderChainHUD();
            this.renderRoster();
            this.renderWar();
        }

        renderChainHUD() {
            const c = this.cache.chain || {};
            const timer = this.root.querySelector("#dash-chain-timer");
            const fill = this.root.querySelector("#dash-chain-fill");
            const text = this.root.querySelector("#dash-chain-text");
            const hud = timer.parentElement.parentElement;
            timer.textContent = c.timeout ?? "--";
            // FIXED: Broken template literals corrected
            text.textContent = `${c.current ?? "--"} / ${c.max ?? "--"}`;
            const pct = (c.max && c.max > 0) ? (c.current / c.max) * 100 : 0;
            fill.style.width = pct + "%";
            hud.classList.toggle("panic", (c.timeout || 0) <= this.settings.panicThreshold);
        }

        renderRoster() {
            const tbody = this.root.querySelector("#faction-table");
            if (!tbody) return;
            const members = this.cache.factionMembers;
            let html = "";
            Object.values(members).forEach(m => {
                const hosp = m.status?.state === "Hospital";
                const time = hosp ? this.formatTime(m.status?.until || 0) : "OK";
                // FIXED: Broken template literals corrected
                html += `<tr class="${hosp ? "row-danger" : ""}"><td>${m.name || "??"}</td><td>${m.status?.state || "--"}</td><td>${time}</td><td>${m.last_action?.relative || "--"}</td></tr>`;
            });
            tbody.innerHTML = html;
        }

        renderWar() {
            const war = this.cache.war || {};
            const tbody = this.root.querySelector("#war-table");
            const wallEl = this.root.querySelector("#dash-wall");
            const scoreEl = this.root.querySelector("#dash-score");
            if (!tbody) return;

            wallEl.textContent = war.wall?.health || "--";
            const s = war.score || {};
            // FIXED: Broken template literals corrected
            scoreEl.textContent = `${s.faction || 0} / ${s.enemy || 0}`;

            if (!war.enemies || !Object.keys(war.enemies).length) {
                tbody.innerHTML = "<tr><td colspan=5>No enemies</td></tr>";
                return;
            }

            let html = "";
            Object.values(war.enemies).forEach(e => {
                const hosp = e.status?.state === "Hospital";
                const time = e.status?.until ? this.formatTime(e.status.until) : "--";
                // FIXED: Broken template literals corrected
                html += `<tr class="${hosp ? "row-danger" : ""}"><td>${e.name}</td><td>${e.level}</td><td>${e.status?.state || "--"}</td><td>${time}</td><td><a href="https://www.torn.com/loader.php?sid=attack&userID=${e.id}" target="_blank">Attack</a></td></tr>`;
            });
            tbody.innerHTML = html;
        }

        formatTime(ts) {
            const diff = Math.max(0, ts - Math.floor(Date.now() / 1000));
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            // FIXED: Broken template literals corrected
            return `${m}m ${s}s`;
        }

        toggleDrawer() {
            this.drawer.classList.toggle("open");
        }

        cleanup() {
            this.listeners.forEach(u => u());
            this.listeners = [];
            this.host?.remove();
        }
    }

    if (window.WAR_GENERAL) {
        window.WAR_GENERAL.register("Major", new Major());
    }
})();
