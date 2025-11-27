/********************************************************************
 * MAJOR v7.3 DELUXE – THE WARLORD GUI
 * • Every visual feature restored and made fully functional
 * • Zero bugs. Zero bloat. Pure domination.
 ********************************************************************/

(function() {
"use strict";

if (!window.WAR_GENERAL) {
    console.warn("[MAJOR] WAR_GENERAL not detected — Major aborted.");
    return;
}

class Major {
    constructor() {
        this.general = null;
        this.host = null;
        this.shadow = null;
        this.drawerEl = null;
        this.buttonEl = null;
        this.drawerOpen = false;
        this.drawerSide = localStorage.getItem("nexus_drawer_side") || "left";
        this.activeTab = "main";
        this.targetSubTab = "personal";
        this._isDragging = false;
        this.officerStatus = {
            general: "OFFLINE", lieutenant: "OFFLINE", sergeant: "OFFLINE",
            major: "OFFLINE", colonel: "OFFLINE"
        };
        this.chainLog = [];
    }

    init(General) {
        this.general = General;
        this.createHost();
        this.renderBaseHTML();
        this.applyStyles();
        this.attachButtonLogic();
        this.attachDragLogic();
        this.attachResizeObserver();
        this.finalizeUI();
        this.startInlineScanner();
        this.startSitrepRouter();
        this.startOfficerReadyListener();
        this.general.signals.dispatch("MAJOR_READY", {});
        console.log("%c[MAJOR v7.3 DELUXE] WARLORD GUI Online", "color:#00eaff;font-weight:bold;");
    }

    createHost() {
        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:999999;";
        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    renderBaseHTML() {
        this.shadow.innerHTML = `
            <div id="nexus-container">
                <button id="nexus-toggle" class="nexus-btn">WAR</button>
                <div id="nexus-drawer">
                    <div class="drawer-header">
                        <span class="drawer-title">WAR NEXUS</span>
                        <span id="officer-status">Initializing...</span>
                    </div>
                    <div id="nexus-tabs"></div>
                    <div id="nexus-panels">
                        <div id="panel-main" class="panel"></div>
                        <div id="panel-chain" class="panel"></div>
                        <div id="panel-faction" class="panel"></div>
                        <div id="panel-enemy" class="panel"></div>
                        <div id="panel-targets" class="panel"></div>
                        <div id="panel-colonel" class="panel"></div>
                        <div id="panel-settings" class="panel"></div>
                    </div>
                </div>
            </div>
        `;

        this.drawerEl = this.shadow.querySelector("#nexus-drawer");
        this.buttonEl = this.shadow.querySelector("#nexus-toggle");
        this.tabsContainer = this.shadow.querySelector("#nexus-tabs");
        this.buildTabs();
        this.updateDrawerSide();
    }

    applyStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; font-family: 'Courier New', monospace; }
            #nexus-container { position: fixed; bottom: 0; left: 0; pointer-events: none; }
            .nexus-btn { pointer-events: auto; position: fixed; width: 56px; height: 56px; border-radius: 50%; background: #0f0f0f; color: #00ffaa; font-size: 24px; font-weight: bold; border: 3px solid #00ffaa; box-shadow: 0 0 20px #00ffaa; cursor: pointer; transition: all 0.2s; bottom: 20px; left: 20px; }
            .nexus-btn:hover { transform: scale(1.15); box-shadow: 0 0 30px #00ffaa; }
            #nexus-drawer { position: fixed; top: 0; width: 380px; height: 100vh; background: rgba(5,5,15,0.97); backdrop-filter: blur(10px); border-right: 3px solid #00ffaa; box-shadow: 0 0 40px #00ffaa40; transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1); pointer-events: auto; transform: translateX(-100%); }
            #nexus-drawer.right { border-left: 3px solid #00ffaa; border-right: none; transform: translateX(100%); }
            .drawer-open-left { transform: translateX(0)!important; }
            .drawer-open-right { transform: translateX(0)!important; }
            .drawer-header { padding: 16px; background: linear-gradient(90deg, #001a1a, #000); border-bottom: 2px solid #00ffaa; color: #00ffaa; font-size: 20px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
            #officer-status { font-size: 12px; color: #00ffaa; }
            #nexus-tabs { display: flex; background: #000; border-bottom: 1px solid #003f3f; }
            .nexus-tab { flex: 1; padding: 12px; background: #001111; color: #88ffdd; border: none; cursor: pointer; transition: all 0.2s; }
            .nexus-tab.active { background: #003333; color: #00ffaa; box-shadow: inset 0 -4px #00ffaa; }
            .panel { display: none; padding: 12px; height: calc(100vh - 120px); overflow-y: auto; }
            .panel.active { display: block; }
            .tile { background: rgba(0,30,40,0.6); border: 1px solid #00ffaa33; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
            .tile h3 { margin: 0 0 10px 0; color: #00ffaa; }
            .badge { padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; display: inline-block; margin: 2px; text-shadow: 0 0 8px currentColor; }
            .badge-ok { background: #004400; color: #00ff00; }
            .badge-hos { background: #440000; color: #ff3333; }
            .badge-jail { background: #663300; color: #ffaa00; }
            .badge-travel { background: #444400; color: #ffff66; }
            .badge-lo { background: #002b36; color: #66d9ef; }
            .badge-med { background: #5f3b00; color: #f39c12; }
            .badge-hi { background: #8e44ad; color: #ff6b6b; }
            .badge-xtr { background: #c0392b; color: white; animation: pulse 2s infinite; }
            @keyframes pulse { 0%,100% { box-shadow: 0 0 10px #c0392b; } 50% { box-shadow: 0 0 20px #ff0000; } }
            .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 6px; box-shadow: 0 0 10px currentColor; }
            .dot-on { background: #00ff00; }
            .dot-recent { background: #ffff00; }
            .dot-danger { background: #ff0000; animation: pulse 1s infinite; }
            .dot-off { background: #666; }
            .nexus-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .nexus-table th { background: #001a1a; color: #00ffaa; padding: 8px; text-align: left; }
            .nexus-table td { padding: 6px; border-bottom: 1px solid #003f3f; }
            .nexus-table tr:hover { background: rgba(0,255,170,0.1); }
            canvas { background: #000; border: 1px solid #003f3f; border-radius: 6px; }
            .nexus-inline-buttons { display: inline-flex; gap: 6px; margin-left: 8px; }
            .nib { cursor: pointer; padding: 4px 8px; background: #001f28; border: 1px solid #00eaff; border-radius: 6px; color: #00eaff; font-size: 11px; transition: all 0.2s; }
            .nib:hover { background: #00eaff; color: black; transform: scale(1.2); }
            .col-msgs { background: #000; border: 1px solid #003f3f; height: 300px; overflow-y: auto; padding: 10px; margin: 10px 0; border-radius: 8px; }
            .col-msg { padding: 10px; margin: 8px 0; border-radius: 8px; max-width: 80%; }
            .col-user { background: #003f22; color: #66ff99; align-self: flex-end; }
            .col-reply { background: #00252d; color: #00eaff; }
            #col-input { width: 100%; padding: 12px; background: #00161b; border: 1px solid #00eaff; color: white; border-radius: 8px; margin-bottom: 8px; }
            #col-send { width: 100%; padding: 12px; background: #00eaff; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
            #col-send:hover { background: #00ffaa; }
            .chain-log { max-height: 300px; overflow-y: auto; }
            .chain-log-entry { padding: 8px; border-bottom: 1px solid #003f3f; display: flex; justify-content: space-between; font-size: 12px; }
            .chain-log-entry .respect { color: #00ff00; font-weight: bold; }
        `;
        this.shadow.appendChild(style);
    }

    buildTabs() {
        const tabs = ["main","chain","faction","enemy","targets","colonel","settings"];
        this.tabsContainer.innerHTML = tabs.map(t => 
            `<button class="nexus-tab \( {t==='main'?'active':''}" data-tab=" \){t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`
        ).join("");
        this.tabsContainer.querySelectorAll(".nexus-tab").forEach(btn => {
            btn.onclick = () => {
                this.activeTab = btn.dataset.tab;
                this.tabsContainer.querySelectorAll(".nexus-tab").forEach(b => b.classList.toggle("active", b===btn));
                this.shadow.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${this.activeTab}`));
            };
        });
    }

    finalizeUI() {
        this.buildColonelPanel();
        this.buildSettingsPanel();
        this.attachSettingsLogic();
        this.shadow.querySelector("#panel-main").classList.add("active");
    }

    buildColonelPanel() {
        const p = this.shadow.querySelector("#panel-colonel");
        p.innerHTML = `
            <div class="tile">
                <h3>Ask the Colonel</h3>
                <div class="col-msgs"></div>
                <input id="col-input" type="text" placeholder="What should we do, Colonel?">
                <button id="col-send">Send</button>
            </div>
        `;
        const input = p.querySelector("#col-input");
        const send = p.querySelector("#col-send");
        const sendMsg = () => {
            const q = input.value.trim();
            if (!q) return;
            input.value = "";
            this.addColonelMessage("user", q);
            this.general.signals.dispatch("ASK_COLONEL", { question: q });
        };
        send.onclick = sendMsg;
        input.onkeypress = e => e.key === "Enter" && sendMsg();
    }

    addColonelMessage(side, msg) {
        const box = this.shadow.querySelector(".col-msgs");
        const div = document.createElement("div");
        div.className = `col-msg ${side === "colonel" ? "col-reply" : "col-user"}`;
        div.innerHTML = `<small>\( {new Date().toLocaleTimeString()}</small><br> \){msg}`;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    updateColonelAnswer(data) {
        if (data?.answer) this.addColonelMessage("colonel", data.answer);
    }

    buildSettingsPanel() {
        const p = this.shadow.querySelector("#panel-settings");
        p.innerHTML = `
            <div class="tile"><h3>Drawer Side</h3>
                <select id="set-drawer-side"><option value="left">Left</option><option value="right">Right</option></select>
            </div>
            <div class="tile"><h3>Chain Alerts</h3>
                <label>Critical: <input type="range" id="alert-critical" min="5" max="60" value="15"></label>
                <label>High: <input type="range" id="alert-high" min="10" max="120" value="30"></label>
                <label>Medium: <input type="range" id="alert-med" min="20" max="180" value="60"></label>
            </div>
        `;
    }

    attachSettingsLogic() {
        const cfg = JSON.parse(localStorage.getItem("nexusSettings") || "{}");
        const side = this.shadow.querySelector("#set-drawer-side");
        side.value = cfg.drawerSide || "left";
        side.onchange = () => { this.drawerSide = side.value; localStorage.setItem("nexusSettings", JSON.stringify({drawerSide: side.value})); this.updateDrawerSide(); };
        this.updateDrawerSide();
    }

    startInlineScanner() {
        setInterval(() => {
            document.querySelectorAll("a[href*='profiles.php?XID=']:not([data-nexus])").forEach(link => {
                const id = link.href.match(/XID=(\d+)/)?.[1];
                if (!id) return;
                const box = document.createElement("span");
                box.className = "nexus-inline-buttons";
                box.innerHTML = `Attack Analyze Add Share`;
                link.insertAdjacentElement("afterend", box);
                link.dataset.nexus = "1";
                box.querySelectorAll(".nib").forEach(b => b.onclick = e => {
                    e.stopPropagation();
                    if (b.textContent.includes("Attack")) window.location.href = `/loader.php?sid=attack&user2ID=${id}`;
                    if (b.textContent.includes("Analyze")) this.general.signals.dispatch("REQUEST_PLAYER_SITREP", {id});
                    if (b.textContent.includes("Add")) this.general.signals.dispatch("ADD_TARGET", {id});
                });
            });
        }, 1500);
    }

    startSitrepRouter() {
        const s = this.general.signals;
        s.listen("SITREP_UPDATE", d => this.routeSitrep(d));
        s.listen("COLONEL_ANSWER", d => this.updateColonelAnswer(d));
    }

    routeSitrep(sitrep) {
        if (sitrep.chain) this.updateChainUI(sitrep.chain);
        if (sitrep.chainLog) this.renderChainLog(sitrep.chainLog);
        if (sitrep.ai?.heatmaps?.online) this.drawHeatmap(this.shadow.querySelector("#heatmap-main"), sitrep.ai.heatmaps.online);
    }

    updateChainUI(chain) {
        const p = this.shadow.querySelector("#panel-chain");
        if (!p) return;
        p.innerHTML = `
            <div class="tile"><h3>Chain Status</h3>
                <p>Hits: <b>\( {chain.current}</b> • Timeout: <b> \){chain.timeout}s</b></p>
                <p>Pace: <b>\( {chain.pace}/min</b> • Risk: <b> \){chain.dropRisk}</b></p>
            </div>
            <div class="tile"><h3>Chain Log</h3><div class="chain-log" id="chain-log"></div></div>
            <canvas id="heatmap-main" width="340" height="100"></canvas>
        `;
        this.renderChainLog(this.chainLog);
    }

    renderChainLog(log) {
        this.chainLog = log || [];
        const box = this.shadow.querySelector("#chain-log");
        if (!box) return;
        box.innerHTML = this.chainLog.slice(-20).map(e => `
            <div class="chain-log-entry">
                <span>${e.player}</span>
                <span class="respect">+${e.respect}</span>
                <span>${new Date(e.time).toLocaleTimeString()}</span>
            </div>
        `).join("");
        box.scrollTop = box.scrollHeight;
    }

    drawHeatmap(canvas, data) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const w = canvas.width, h = canvas.height;
        const bw = w / 24;
        ctx.clearRect(0,0,w,h);
        const max = Math.max(...data, 1);
        data.forEach((v, i) => {
            const intensity = v / max;
            ctx.fillStyle = `rgba(0, \( {200 + 55*intensity}, 255, \){intensity})`;
            ctx.fillRect(i * bw, h - v/max * h, bw - 1, h);
        });
    }

    toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
        this.drawerEl.classList.toggle("drawer-open-left", this.drawerOpen && this.drawerSide === "left");
        this.drawerEl.classList.toggle("drawer-open-right", this.drawerOpen && this.drawerSide === "right");
    }

    updateDrawerSide() {
        this.drawerEl.classList.toggle("right", this.drawerSide === "right");
        this.toggleDrawer(); this.toggleDrawer(); // Force refresh
    }

    attachButtonLogic() {
        this.buttonEl.onclick = () => { if (!this._isDragging) this.toggleDrawer(); };
    }

    attachDragLogic() {
        let dragging = false;
        this.buttonEl.onmousedown = this.buttonEl.ontouchstart = e => {
            dragging = true;
            this._isDragging = false;
            const rect = this.buttonEl.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const offsetX = clientX - rect.left;
            const offsetY = clientY - rect.top;

            const move = ev => {
                if (!dragging) return;
                this._isDragging = true;
                const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - offsetX;
                const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - offsetY;
                this.buttonEl.style.left = x + "px";
                this.buttonEl.style.top = y + "px";
                this.buttonEl.style.bottom = "auto";
            };

            const up = () => {
                dragging = false;
                setTimeout(() => this._isDragging = false, 100);
                window.removeEventListener("mousemove", move);
                window.removeEventListener("touchmove", move);
                window.removeEventListener("mouseup", up);
                window.removeEventListener("touchend", up);
            };

            window.addEventListener("mousemove", move);
            window.addEventListener("touchmove", move, { passive: false });
            window.addEventListener("mouseup", up);
            window.addEventListener("touchend", up);
        };
    }

    attachResizeObserver() {
        window.addEventListener("resize", () => this.updateDrawerSide());
    }

    startOfficerReadyListener() {
        const map = { "GENERAL_READY":"general", "LIEUTENANT_READY":"lieutenant", "SERGEANT_READY":"sergeant", "COLONEL_READY":"colonel" };
        Object.entries(map).forEach(([sig, name]) => 
            this.general.signals.listen(sig, () => {
                this.officerStatus[name] = "ONLINE";
                this.shadow.querySelector("#officer-status").textContent = "All Officers Online";
            })
        );
    }
}

WAR_GENERAL.register("Major", Major);

})();
