/********************************************************************
 * MAJOR v7.3 DELUXE 
 ********************************************************************/

(function() {
"use strict";

/* ============================================================
   SAFE BOOTSTRAP
   ============================================================ */
function waitForGeneral(attempt = 0) {
    if (window.WAR_GENERAL && typeof window.WAR_GENERAL.register === "function") {
        console.log("[MAJOR] WAR_GENERAL detected. Initializing.");
        startMajor();
        return;
    }

    const delay = Math.min(1000, 100 * Math.pow(1.5, attempt)); // exponential backoff
    if (attempt < 120) { // ~60 seconds max
        setTimeout(() => waitForGeneral(attempt + 1), delay);
    } else {
        console.error("[MAJOR] WAR_GENERAL not found after ~60 seconds. Aborting.");
    }
}
waitForGeneral();

/* ============================================================
   START MAJOR
   ============================================================ */
function startMajor() {

class Major {
    constructor() {
        this.general = null;
        
        this.host = null;
        this.shadow = null;

        this.drawerEl = null;
        this.drawerOpen = false;
        this.drawerSide = "left";

        this.buttonEl = null;
        this.buttonPosition = { bottom: 20, left: 20 };

        this.dragging = false;
        this._isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.activeTab = "main";
        this.targetSubTab = "personal";
        this.tabsContainer = null;
        this.panelsContainer = null;

        this.mutationObserver = null;

        this.officerStatus = {
            general: "ONLINE", // Implicit
            lieutenant: "OFFLINE",
            sergeant: "OFFLINE",
            major: "ONLINE",
            colonel: "OFFLINE"
        };

        this.intervals = [];
        this.boundHandlers = new Map();
    }

    /* ============================================================
       UI FINALIZATION
       ============================================================ */
    finalizeUI() {
        if (typeof this.applyExtendedStyles === "function") this.applyExtendedStyles();
        if (typeof this.buildColonelPanel === "function") this.buildColonelPanel();
        if (typeof this.buildSettingsPanel === "function") this.buildSettingsPanel();
        if (typeof this.attachSettingsLogic === "function") this.attachSettingsLogic();
        
        // Render initial active panel
        this.renderActivePanel();
    }

    /* ============================================================
       SANITIZATION HELPER (XSS DEFENSE)
       ============================================================ */
    sanitize(value) {
        if (value === null || value === undefined) return "";
        const s = String(value);
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
    }

    /* ============================================================
       INIT
       ============================================================ */
    init(General) {
        this.general = General;

        this.createHost();
        this.renderBaseHTML();
        this.applyBaseStyles();

        this.attachButtonLogic();
        this.attachDragLogic();
        this.attachResizeObserver();

        this.updateDrawerSide();
        this.applyAnimationPreferences();

        this.startInlineScanner();
       
        this.startSitrepRouter();

        if (typeof this.startOfficerReadyListener === "function") {
            this.startOfficerReadyListener();
        }

        this.finalizeUI();

        if (this.general?.signals) {
            this.general.signals.dispatch("UI_READY", {});
            this.general.signals.dispatch("MAJOR_READY", {});
            console.log("[MAJOR] System Online.");
        }
    }

    /* ============================================================
       DESTROY 
       ============================================================ */
    destroy() {
        console.log("[MAJOR] Destroy — cleaning up.");
        
        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        this.boundHandlers.forEach((handler, event) => {
            window.removeEventListener(event, handler);
        });
        this.boundHandlers.clear();

        if (this.host?.parentNode) {
            this.host.remove();
        }

        this.host = this.shadow = this.drawerEl = this.buttonEl = null;
    }

    /* ============================================================
       HOST + SHADOW DOM
       ============================================================ */
    createHost() {
        if (this.host) return;

        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "999999";
        this.host.style.top = "0";
        this.host.style.left = "0";

        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    renderBaseHTML() {
        this.shadow.innerHTML = `
            <div id="nexus-container">
                <button id="nexus-toggle" class="nexus-btn">N</button>
                <div id="nexus-drawer">
                    <div class="drawer-header">
                        <span class="drawer-title">WAR NEXUS // v7.3</span>
                        <span id="close-drawer" style="cursor:pointer; float:right;">&times;</span>
                    </div>
                    <div id="nexus-tabs"></div>
                    <div id="nexus-panels"></div>
                </div>
            </div>
        `;

        this.drawerEl = this.shadow.querySelector("#nexus-drawer");
        this.buttonEl = this.shadow.querySelector("#nexus-toggle");
        this.tabsContainer = this.shadow.querySelector("#nexus-tabs");
        this.panelsContainer = this.shadow.querySelector("#nexus-panels");
        
        // Quick close listener
        const closeBtn = this.shadow.querySelector("#close-drawer");
        if(closeBtn) closeBtn.addEventListener("click", () => this.toggleDrawer());

        this.buildTabs();
        this.buildPanels();
    }
    
    applyBaseStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
            * { box-sizing: border-box; }
            #nexus-container {
                position: fixed;
                bottom: 0; left: 0;
                pointer-events: none;
                --drawer-transition: 0.32s;
                --button-transition: 0.15s;
                --c-primary: #00c8ff;
                --c-bg: rgba(10, 14, 18, 0.95);
                --c-panel: rgba(255,255,255,0.03);
            }
            .nexus-btn {
                pointer-events: auto;
                position: fixed;
                width: 50px; height: 50px;
                border-radius: 50%;
                font-size: 20px;
                border: 2px solid var(--c-primary);
                background: #000;
                color: var(--c-primary);
                box-shadow: 0 0 8px var(--c-primary);
                cursor: pointer;
                transition: transform var(--button-transition), box-shadow var(--button-transition);
                user-select: none;
                bottom: 20px; left: 20px;
                z-index: 1000000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }
            .nexus-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 0 12px #00e1ff;
            }
            #nexus-drawer {
                position: fixed;
                top: 0;
                width: 380px;
                height: 100vh;
                background: var(--c-bg);
                backdrop-filter: blur(8px);
                border-right: 2px solid var(--c-primary);
                transform: translateX(-100%);
                transition: transform var(--drawer-transition);
                pointer-events: auto;
                display: flex;
                flex-direction: column;
                color: #eee;
            }
            #nexus-drawer.right {
                border-right: none;
                border-left: 2px solid var(--c-primary);
                transform: translateX(100%);
            }
            .drawer-open-left { transform: translateX(0) !important; }
            .drawer-closed-left { transform: translateX(-100%) !important; }
            .drawer-open-right { transform: translateX(0) !important; }
            .drawer-closed-right { transform: translateX(100%) !important; }
            
            .drawer-header {
                padding: 15px;
                border-bottom: 1px solid #333;
                font-size: 16px;
                font-weight: bold;
                letter-spacing: 1px;
                color: var(--c-primary);
                background: rgba(0,0,0,0.5);
            }
            #nexus-tabs {
                display: flex;
                flex-wrap: wrap;
                background: rgba(0,0,0,0.3);
                border-bottom: 1px solid #333;
            }
            #nexus-panels {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
            }
            /* Scrollbar */
            #nexus-panels::-webkit-scrollbar { width: 6px; }
            #nexus-panels::-webkit-scrollbar-track { background: #000; }
            #nexus-panels::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        `;
        this.shadow.appendChild(style);
    }
    
    /* ============================================================
       EXTENDED STYLES (POLISH)
       ============================================================ */
    applyExtendedStyles() {
        const style = document.createElement("style");
        style.textContent = `
            /* Tabs */
            .nexus-tab {
                flex: 1 1 auto;
                background: transparent;
                border: none;
                border-bottom: 2px solid transparent;
                color: #888;
                padding: 10px 5px;
                cursor: pointer;
                font-size: 12px;
                transition: 0.2s;
            }
            .nexus-tab:hover { color: #fff; }
            .nexus-tab.active {
                color: var(--c-primary);
                border-bottom: 2px solid var(--c-primary);
            }

            /* Panels & Tiles */
            .tile {
                background: var(--c-panel);
                border: 1px solid #333;
                border-radius: 4px;
                padding: 10px;
                margin-bottom: 10px;
            }
            .tile h3 {
                margin: 0 0 8px 0;
                font-size: 12px;
                text-transform: uppercase;
                color: #aaa;
                border-bottom: 1px solid #222;
                padding-bottom: 4px;
            }
            .tile p { margin: 4px 0; font-size: 13px; }
            .tile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

            /* Tables */
            .nexus-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .nexus-table th { text-align: left; color: #888; border-bottom: 1px solid #444; padding: 4px; }
            .nexus-table td { padding: 4px; border-bottom: 1px solid #222; vertical-align: middle; }
            .nexus-table tr:last-child td { border-bottom: none; }
            
            /* Badges & Dots */
            .badge { padding: 2px 4px; border-radius: 3px; font-size: 10px; font-weight: bold; }
            .badge-hos { background: #820000; color: #fff; }
            .badge-jail { background: #c55; color: #fff; }
            .badge-travel { background: #555; color: #fff; }
            .badge-ok { background: #004400; color: #cfc; }
            .badge-off { background: #222; color: #777; }
            
            .badge-xtr { background: #f00; color: #fff; animation: pulse 1s infinite; }
            .badge-hi { background: #d60; color: #fff; }
            .badge-med { background: #aa0; color: #000; }
            .badge-lo { background: #262; color: #ada; }
            
            .badge-lv { border: 1px solid #444; color: #aaa; }
            .badge-rank { color: var(--c-primary); }

            .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
            .dot-on { background: #0f0; box-shadow: 0 0 5px #0f0; }
            .dot-recent { background: #fa0; }
            .dot-danger { background: #f00; }
            .dot-off { background: #444; }

            /* Buttons within Tables */
            .nib-att, .nib-ana, .nib-add { cursor: pointer; opacity: 0.7; transition: 0.2s; font-size: 14px; margin: 0 2px; }
            .nib-att:hover { opacity: 1; color: #f55; transform: scale(1.2); }
            .nib-ana:hover { opacity: 1; color: #5af; transform: scale(1.2); }
            .nib-add:hover { opacity: 1; color: #5f5; transform: scale(1.2); }

            /* Target Subtabs */
            .target-subtabs { display: flex; gap: 4px; margin-bottom: 8px; }
            .target-tab {
                background: #222; border: 1px solid #444; color: #888;
                padding: 4px 8px; cursor: pointer; flex: 1; font-size: 11px;
            }
            .target-tab:hover { background: #333; }

            /* Inline Buttons on Page */
            .nexus-inline-buttons {
                display: inline-flex; gap: 4px; margin-left: 8px; vertical-align: middle;
            }
            .nexus-inline-buttons .nib {
                font-size: 0; width: 16px; height: 16px; border-radius: 50%;
                cursor: pointer; border: 1px solid #555; display: inline-block;
                position: relative;
            }
            .nib-attack { background: #500; } 
            .nib-analyze { background: #005; }
            .nib-add { background: #050; }
            .nib::after { font-size: 10px; color: #fff; position: absolute; top: 0; left: 4px; content: ''; }
            
            /* Colonel Chat */
            .col-user { 
                align-self: flex-end; text-align: right; 
                background: rgba(0, 200, 255, 0.1); 
                padding: 6px; border-radius: 4px; 
                border-left: 2px solid var(--c-primary);
                font-size: 13px; color: #def;
            }
            .col-reply { 
                align-self: flex-start; text-align: left; 
                background: rgba(255, 160, 0, 0.1); 
                padding: 6px; border-radius: 4px; 
                border-right: 2px solid #f90;
                font-size: 13px; color: #fdba;
            }
            #col-send, #col-input {
                background: #111; border: 1px solid #333; color: #eee; padding: 6px;
            }
            #col-send { cursor: pointer; margin-top: 4px; width: 100%; }
            #col-send:hover { background: #222; }

            @keyframes pulse { 0% { opacity:1; } 50% { opacity:0.6; } 100% { opacity:1; } }
        `;
        this.shadow.appendChild(style);
    }

    /* ============================================================
       TABS & PANELS 
       ============================================================ */
    buildTabs() {
        this.tabsContainer.innerHTML = `
            <button class="nexus-tab active" data-tab="main">Main</button>
            <button class="nexus-tab" data-tab="chain">Chain</button>
            <button class="nexus-tab" data-tab="faction">Faction</button>
            <button class="nexus-tab" data-tab="enemy">Enemies</button>
            <button class="nexus-tab" data-tab="targets">Targets</button>
            <button class="nexus-tab" data-tab="colonel">Colonel</button>
            <button class="nexus-tab" data-tab="settings">Settings</button>
        `;

        this.tabsContainer.querySelectorAll(".nexus-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                // Update active state
                this.tabsContainer.querySelectorAll(".nexus-tab").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                
                this.activeTab = btn.dataset.tab;
                this.renderActivePanel();
            });
        });
    }

    buildPanels() {
        this.panelsContainer.innerHTML = `
            <div id="panel-main">Loading Nexus Main...</div>
            <div id="panel-chain">Chain Inactive</div>
            <div id="panel-faction">Loading Faction...</div>
            <div id="panel-enemy">Loading Enemies...</div>
            <div id="panel-targets">Loading Targets...</div>
            <div id="panel-colonel">Connecting to Colonel...</div>
            <div id="panel-settings">Settings</div>
        `;
        this.renderActivePanel();
    }

    renderActivePanel() {
        if (!this.panelsContainer) return;
        this.panelsContainer.querySelectorAll("div[id^='panel-']").forEach(panel => {
            panel.style.display = (panel.id === `panel-${this.activeTab}`) ? "block" : "none";
        });
    }

    /* ============================================================
       OFFICER LISTENER
       ============================================================ */
    startOfficerReadyListener() {
        if (!this.general?.signals) return;

        this.general.signals.listen("OFFICER_READY", (data) => {
            if (data && data.name) {
                const name = data.name.toLowerCase();
                if (this.officerStatus.hasOwnProperty(name)) {
                    this.officerStatus[name] = "ONLINE";
                    // If we have a status UI component, update it here
                    console.log(`[MAJOR] Officer connected: ${data.name}`);
                }
            }
        });
        
        // Announce myself again just in case late listeners join
        setTimeout(() => {
            this.general.signals.dispatch("OFFICER_READY", { name: "Major", version: "7.3" });
        }, 1000);
    }

    /* ============================================================
       BUTTON & DRAWER LOGIC
       ============================================================ */
    attachButtonLogic() {
        this.buttonEl.addEventListener("click", (e) => {
            if (this._isDragging || this.dragging) return;
            e.preventDefault();
            this.toggleDrawer();
        });
    }

    toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
        this.applyDrawerClasses();
    }

    applyDrawerClasses() {
        const side = this.drawerSide === "right" ? "right" : "left";

        if (side === "right") {
            this.drawerEl.className = this.drawerOpen ? "drawer-open-right" : "drawer-closed-right";
            this.drawerEl.classList.add("right");
        } else {
            this.drawerEl.className = this.drawerOpen ? "drawer-open-left" : "drawer-closed-left";
            this.drawerEl.classList.remove("right");
        }
    }

    updateDrawerSide() {
        this.applyDrawerClasses();
    }

    /* ============================================================
       DRAG LOGIC 
       ============================================================ */
    attachDragLogic() {
        const startDrag = (e) => {
            if (e.button !== 0 && e.type !== 'touchstart') return; 
            if(e.cancelable) e.preventDefault();

            this.dragging = true;
            this._isDragging = true;

            const pt = (e.touches && e.touches.length) ? e.touches[0] : e;
            const rect = this.buttonEl.getBoundingClientRect();
            this.dragOffsetX = pt.clientX - rect.left;
            this.dragOffsetY = pt.clientY - rect.top;

            const moveHandler = (e) => {
                const pt = (e.touches && e.touches.length) ? e.touches[0] : e;
                let x = pt.clientX - this.dragOffsetX;
                let y = pt.clientY - this.dragOffsetY;

                const clamped = this.clampButtonPosition(x, y);
                this.buttonEl.style.left = clamped.x + "px";
                this.buttonEl.style.top = clamped.y + "px";
                this.buttonEl.style.bottom = "auto";
                this.buttonEl.style.right = "auto";
            };

            const endDrag = () => {
                this.dragging = false;
                setTimeout(() => this._isDragging = false, 120);

                window.removeEventListener("mousemove", moveHandler);
                window.removeEventListener("mouseup", endDrag);
                window.removeEventListener("touchmove", moveHandler);
                window.removeEventListener("touchend", endDrag);
                window.removeEventListener("touchcancel", endDrag);

                this.boundHandlers.delete("mousemove");
                this.boundHandlers.delete("mouseup");
                this.boundHandlers.delete("touchmove");
                this.boundHandlers.delete("touchend");
                this.boundHandlers.delete("touchcancel");
            };

            // Attach only now
            window.addEventListener("mousemove", moveHandler);
            window.addEventListener("mouseup", endDrag);
            window.addEventListener("touchmove", moveHandler, { passive: false });
            window.addEventListener("touchend", endDrag);
            window.addEventListener("touchcancel", endDrag);

            // Store for destroy()
            this.boundHandlers.set("mousemove", moveHandler);
            this.boundHandlers.set("mouseup", endDrag);
            this.boundHandlers.set("touchmove", moveHandler);
            this.boundHandlers.set("touchend", endDrag);
            this.boundHandlers.set("touchcancel", endDrag);
        };

        this.buttonEl.addEventListener("mousedown", startDrag);
        this.buttonEl.addEventListener("touchstart", startDrag, { passive: false });
    }

    clampButtonPosition(x, y) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const rect = this.buttonEl.getBoundingClientRect();
        const size = 50 + 16; // 50px button + 16px buffer

        return {
            x: Math.max(8, Math.min(w - size, x)),
            y: Math.max(8, Math.min(h - size, y))
        };
    }

    attachResizeObserver() {
        window.addEventListener("resize", () => this.updateDrawerSide());
    }

    applyAnimationPreferences() { 
        // Simple preference check
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (mediaQuery.matches) {
            this.host.style.setProperty("--drawer-transition", "0s");
            this.host.style.setProperty("--button-transition", "0s");
        }
    }

    /* ============================================================
       MUTATIONOBSERVER
       ============================================================ */
    startInlineScanner() {
        if (this.mutationObserver) return;

        const processNode = (node) => {
            if (!(node instanceof HTMLAnchorElement)) return;
            if (!node.href.includes("profiles.php") || !node.href.includes("XID=")) return;
            if (node.dataset.nexusEnhanced) return;

            const id = this.extractInlineId(node.href);
            if (!id) return;

            const box = document.createElement("span");
            box.className = "nexus-inline-buttons";
            // Icons provided as empty spans with colors in CSS
            box.innerHTML = `
                <span class="nib nib-attack" title="Attack" data-id="${id}"></span>
                <span class="nib nib-analyze" title="Analyze" data-id="${id}"></span>
                <span class="nib nib-add" title="Add Target" data-id="${id}"></span>
            `;

            node.insertAdjacentElement("afterend", box);
            node.dataset.nexusEnhanced = "1";
            this.attachInlineEvents(box);
        };

        const observer = new MutationObserver((mutations) => {
            for (const mut of mutations) {
                for (const node of mut.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches("a[href*='profiles.php?XID=']")) {
                            processNode(node);
                        }
                        // Also check children
                        node.querySelectorAll?.("a[href*='profiles.php?XID=']").forEach(processNode);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.mutationObserver = observer;

        // Initial scan
        document.querySelectorAll("a[href*='profiles.php?XID=']").forEach(processNode);
    }

    extractInlineId(url) {
        const m = url.match(/XID=(\d+)/);
        return m ? m[1] : null;
    }

    attachInlineEvents(node) {
        if (!node) return;

        const attack = node.querySelector(".nib-attack");
        const analyze = node.querySelector(".nib-analyze");
        const add = node.querySelector(".nib-add");

        attack?.addEventListener("click", e => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            if (!id) return;
            window.location.href = `/loader.php?sid=attack&user2ID=${id}`;
        });

        analyze?.addEventListener("click", e => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            if (!id || !this.general?.signals) return;
            this.general.signals.dispatch("REQUEST_PLAYER_SITREP", { id });
        });

        add?.addEventListener("click", e => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            if (!id || !this.general?.signals) return;
            this.general.signals.dispatch("ADD_TARGET", { id });
        });
    }

    /* ============================================================
       HEATMAP
       ============================================================ */
    drawHeatmap(canvas, arr) {
        if (!canvas || !Array.isArray(arr) || arr.length === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const bw = w / arr.length;

        ctx.clearRect(0, 0, w, h);

        const valid = arr.filter(n => typeof n === "number" && !isNaN(n));
        const max = valid.length > 0 ? Math.max(...valid) : 1;

        arr.forEach((v, i) => {
            const val = typeof v === "number" ? v : 0;
            const pct = max > 0 ? val / max : 0;
            const alpha = Math.min(Math.max(pct, 0.05), 1);
            ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
            ctx.fillRect(i * bw, 0, bw - 1, h);
        });
    }

    /* ============================================================
       SITREP ROUTING
       ============================================================ */
    startSitrepRouter() {
        if (!this.general?.signals) return;

        this.general.signals.listen("SITREP_UPDATE", d => this.routeSitrep(d));
        this.general.signals.listen("TARGETS_SCORED", d => this.updateTargetScores(d));
        this.general.signals.listen("PLAYER_SITREP_READY", d => this.updateAnalyzeResult(d));
        this.general.signals.listen("GLOBAL_SITREP_READY", d => this.routeGlobalSitrep(d));
        this.general.signals.listen("FACTION_SITREP_READY", d => this.routeFactionSitrep(d));
        this.general.signals.listen("ASK_COLONEL_RESPONSE", d => this.updateColonelAnswer(d));
    }

    routeSitrep(s) {
        if (!s) return;

        if (s.user) this.updateUserUI(s.user);
        if (s.factionMembers) this.renderFactionTable(s.factionMembers);
        if (s.enemyFactionMembers) this.renderEnemyTable(s.enemyFactionMembers);
        if (s.targets) this.renderTargetTables(s.targets);
        if (s.chain) this.updateChainUI(s.chain);
        if (s.chainLog) this.renderChainLog(s.chainLog);
    }

    /* ============================================================
       BADGES
       ============================================================ */
    renderStatusBadge(st) {
        const s = (st || "").toLowerCase();
        if (s.includes("hospital")) return `<span class="badge badge-hos">HOSP</span>`;
        if (s.includes("jail")) return `<span class="badge badge-jail">JAIL</span>`;
        if (s.includes("travel")) return `<span class="badge badge-travel">TRAVEL</span>`;
        if (s.includes("online") || s.includes("okay")) return `<span class="badge badge-ok">OK</span>`;
        return `<span class="badge badge-off">OFF</span>`;
    }

    renderThreatBadge(level) {
        if (level >= 80) return `<span class="badge badge-xtr">EXTREME</span>`;
        if (level >= 50) return `<span class="badge badge-hi">HIGH</span>`;
        if (level >= 25) return `<span class="badge badge-med">MED</span>`;
        return `<span class="badge badge-lo">LOW</span>`;
    }

    renderLevelBadge(lv) {
        return `<span class="badge badge-lv">Lv ${this.sanitize(lv)}</span>`;
    }

    renderFactionRankChip(rank) {
        return `<span class="badge badge-rank">${this.sanitize(rank || "--")}</span>`;
    }

    renderOnlineIndicator(type) {
        if (type === "online") return `<span class="dot dot-on"></span>`;
        if (type === "recent") return `<span class="dot dot-recent"></span>`;
        if (type === "danger") return `<span class="dot dot-danger"></span>`;
        return `<span class="dot dot-off"></span>`;
    }

    /* ============================================================
       DASHBOARD
       ============================================================ */
    updateUserUI(user) {
        const p = this.shadow.querySelector("#panel-main");
        if (!p) return;

        p.innerHTML = `
            <div class="tile-grid">
                <div class="tile">
                    <h3>Your Status</h3>
                    <p><b>Name:</b> ${this.sanitize(user.name)}</p>
                    <p><b>Level:</b> ${this.renderLevelBadge(user.level)}</p>
                    <p><b>Status:</b> ${this.renderStatusBadge(user.status)}</p>
                </div>
                <div class="tile">
                    <h3>Threat</h3>
                    <p>${this.renderThreatBadge(user.threat)}</p>
                </div>
                <div class="tile" style="grid-column: span 2;">
                    <h3>Activity Heatmap</h3>
                    <canvas id="heatmap-main" width="340" height="60" style="width:100%;height:60px;"></canvas>
                </div>
            </div>
        `;
    }

    /* ============================================================
       FACTION TABLE
       ============================================================ */
    renderFactionTable(list = []) {
        const p = this.shadow.querySelector("#panel-faction");
        if (!p) return;

        const rows = list.map(m => `
            <tr>
                <td>${this.renderOnlineIndicator(m.onlineState)}</td>
                <td>${this.sanitize(m.name)}</td>
                <td>${this.renderLevelBadge(m.level)}</td>
                <td>${this.renderStatusBadge(m.status)}</td>
                <td>${this.renderFactionRankChip(m.rank)}</td>
            </tr>
        `).join("");

        p.innerHTML = `
            <div class="tile">
                <h3>Faction Members</h3>
                <table class="nexus-table">
                    <thead>
                        <tr><th>On</th><th>Name</th><th>Lv</th><th>Status</th><th>Rank</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    /* ============================================================
       ENEMY TABLE
       ============================================================ */
    renderEnemyTable(list = []) {
        const p = this.shadow.querySelector("#panel-enemy");
        if (!p) return;

        const rows = list.map(m => `
            <tr>
                <td>${this.renderOnlineIndicator(m.onlineState)}</td>
                <td>${this.sanitize(m.name)}</td>
                <td>${this.renderLevelBadge(m.level)}</td>
                <td>${this.renderStatusBadge(m.status)}</td>
                <td><span class="nib-att" data-id="${m.id}" title="Attack">⚔</span></td>
            </tr>
        `).join("");

        p.innerHTML = `
            <div class="tile">
                <h3>Enemy Faction Members</h3>
                <table class="nexus-table">
                    <thead>
                        <tr><th>On</th><th>Name</th><th>Lv</th><th>Status</th><th>A</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        this.attachAttackButtons(p);
    }

    /* ============================================================
       TARGETS TABLE
       ============================================================ */
    renderTargetTables(targets = { personal:[], war:[], shared:[] }) {
        const p = this.shadow.querySelector("#panel-targets");
        if (!p) return;

        p.innerHTML = `
            <div class="target-subtabs">
                <button class="target-tab" data-sub="personal">Personal</button>
                <button class="target-tab" data-sub="war">War</button>
                <button class="target-tab" data-sub="shared">Shared</button>
            </div>
            <div id="target-content"></div>
        `;

        p.querySelectorAll(".target-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                this.targetSubTab = btn.dataset.sub;
                this.renderTargetSubpanel(targets);
            });
        });

        this.renderTargetSubpanel(targets);
    }

    renderTargetSubpanel(targets) {
        const dest = this.shadow.querySelector("#target-content");
        if (!dest) return;

        const list =
            this.targetSubTab === "personal" ? targets.personal :
            this.targetSubTab === "war"      ? targets.war :
                                               targets.shared;

        if (!list || list.length === 0) {
            dest.innerHTML = `<div style="padding:10px;text-align:center;color:#666;">No targets in this category.</div>`;
            return;
        }

        const rows = list.map(t => `
            <tr>
                <td>${this.renderOnlineIndicator(t.onlineState)}</td>
                <td>${this.sanitize(t.name)}</td>
                <td>${this.renderLevelBadge(t.level)}</td>
                <td>${this.renderStatusBadge(t.status)}</td>
                <td>${(t.colonelScore || 0).toFixed(1)}</td>
                <td style="white-space:nowrap;">
                    <span class="nib-att" data-id="${t.id}">⚔</span>
                    <span class="nib-ana" data-id="${t.id}">🔍</span>
                    <span class="nib-add" data-id="${t.id}">➕</span>
                </td>
            </tr>
        `).join("");

        dest.innerHTML = `
            <table class="nexus-table">
                <thead>
                    <tr><th>On</th><th>Name</th><th>Lv</th><th>Status</th><th>Scr</th><th>Act</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        this.attachAttackButtons(dest);
        this.attachAnalyzeButtons(dest);
        this.attachAddTargetButtons(dest);
    }

    /* ============================================================
       CHAIN UI
       ============================================================ */
    updateChainUI(chain = {}) {
        const p = this.shadow.querySelector("#panel-chain");
        if (!p) return;

        p.innerHTML = `
            <div class="tile-grid">
                <div class="tile">
                    <h3>Chain Status</h3>
                    <p><b>Hits:</b> ${chain.hits || 0}</p>
                    <p><b>Timeout:</b> ${chain.timeLeft || "00:00"}</p>
                    <p><b>Pace:</b> ${chain.currentPace || 0}/min</p>
                </div>
                <div class="tile">
                    <h3>Directives</h3>
                    <p>${this.sanitize(chain.warning || "Maintain pace.")}</p>
                </div>
            </div>
        `;
    }

    renderChainLog(log = []) {
        const p = this.shadow.querySelector("#panel-chain");
        if (!p) return;

        const entries = log.map(rec => `
            <div class="chain-log-entry" style="font-size:11px; padding:2px 0; border-bottom:1px solid #222;">
                <b>${this.sanitize(rec.player)}</b> → +${this.sanitize(rec.respect)}
                <span style="float:right;color:#666;">${new Date(rec.time).toLocaleTimeString()}</span>
            </div>
        `).join("");

        const box = document.createElement("div");
        box.className = "tile";
        box.innerHTML = `<h3>Chain Log</h3><div class="chain-log" style="max-height:150px;overflow-y:auto;">${entries}</div>`;
        p.appendChild(box);
    }

    /* ============================================================
       TABLE BUTTONS
       ============================================================ */
    attachAttackButtons(container) {
        container.querySelectorAll(".nib-att").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                if (!id) return;
                window.location.href = `/loader.php?sid=attack&user2ID=${id}`;
            });
        });
    }

    attachAnalyzeButtons(container) {
        container.querySelectorAll(".nib-ana").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                if (!id) return;
                this.general?.signals?.dispatch("REQUEST_PLAYER_SITREP", { id });
            });
        });
    }

    attachAddTargetButtons(container) {
        container.querySelectorAll(".nib-add").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                if (!id) return;
                this.general?.signals?.dispatch("ADD_TARGET", { id });
            });
        });
    }

    /* ============================================================
       COLONEL PANEL
       ============================================================ */
    buildColonelPanel() {
        const panel = this.shadow.querySelector("#panel-colonel");
        if (!panel) return;

        panel.innerHTML = `
            <div class="tile">
                <h3>Ask the Colonel</h3>
                <div class="col-msgs" style="height:300px;overflow-y:auto;border:1px solid #333;padding:8px;margin-bottom:8px;background:#050505;display:flex;flex-direction:column;gap:8px;"></div>
                <input id="col-input" type="text" placeholder="Ask for strategy or status..." style="width:100%;box-sizing:border-box;margin-bottom:6px;">
                <button id="col-send">TRANSMIT</button>
            </div>
        `;

        const input = panel.querySelector("#col-input");
        const send = panel.querySelector("#col-send");

        const sendMsg = () => {
            const q = input.value.trim();
            if (!q) return;
            input.value = "";
            this.addColonelMessage("user", q);
            this.general?.signals?.dispatch("ASK_COLONEL", { question: q });
        };

        send.addEventListener("click", sendMsg);
        input.addEventListener("keydown", e => e.key === "Enter" && sendMsg());
    }

    addColonelMessage(side, msg) {
        const panel = this.shadow.querySelector("#panel-colonel .col-msgs");
        if (!panel) return;

        const div = document.createElement("div");
        div.className = side === "user" ? "col-user" : "col-reply";
        div.textContent = msg;

        panel.appendChild(div);
        panel.scrollTop = panel.scrollHeight;
    }

    updateColonelAnswer(data) {
        if (data?.answer) this.addColonelMessage("colonel", data.answer);
    }

    updateAnalyzeResult(data) {
        if (data?.summary) this.addColonelMessage("colonel", "Analysis: " + data.summary);
    }

    /* ============================================================
       SETTINGS
       ============================================================ */
    buildSettingsPanel() {
        const panel = this.shadow.querySelector("#panel-settings");
        if (!panel) return;

        panel.innerHTML = `
            <div class="tile">
                <h3>UI Configuration</h3>
                <label style="display:block;margin-bottom:10px;">Drawer Side:
                    <select id="drawer-side" style="float:right;background:#222;color:#eee;border:1px solid #444;">
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                    </select>
                </label>
                <p style="font-size:10px;color:#666;margin-top:20px;">Major v7.3 Deluxe Build. Connected to Nexus Core.</p>
            </div>
        `;
    }

    attachSettingsLogic() {
        const sideSelect = this.shadow.querySelector("#drawer-side");
        if (!sideSelect) return;

        sideSelect.value = this.drawerSide;

        sideSelect.addEventListener("change", () => {
            this.drawerSide = sideSelect.value;
            this.updateDrawerSide();
        });
    }

    /* ============================================================
       HEATMAP UPDATES
       ============================================================ */
    updateHeatmaps(data = {}) {
        const main = this.shadow.querySelector("#heatmap-main");
        if (main && Array.isArray(data.onlineHeatmap)) {
            this.drawHeatmap(main, data.onlineHeatmap);
        }
    }

    updateTargetScores(data = {}) {
        if (!data.scored) return;
        const targets = {
            personal: data.scored.filter(t => t.type === "personal"),
            war:      data.scored.filter(t => t.type === "war"),
            shared:   data.scored.filter(t => t.type === "shared")
        };
        this.renderTargetTables(targets);
    }

    routeGlobalSitrep(data) {
        if (data) {
            this.updateHeatmaps({
                onlineHeatmap: data.heatmap,
                statusHeatmap: data.statusHeatmap,
                attackHeatmap: data.attackHeatmap,
                anomalyHeatmap: data.anomalyHeatmap
            });
        }
    }

    routeFactionSitrep(data) {
        if (data?.members) this.renderFactionTable(data.members);
    }

} // END CLASS Major

/* ============================================================
   REGISTER WITH GENERAL
   ============================================================ */
if (window.WAR_GENERAL && typeof window.WAR_GENERAL.register === "function") {
    window.WAR_GENERAL.register("Major", Major);
}

} // END startMajor

})();
