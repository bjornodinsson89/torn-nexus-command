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
        console.log("[MAJOR] WAR_GENERAL detected.");
        startMajor();
        return;
    }

    const delay = Math.min(1000, 100 * Math.pow(1.5, attempt)); // exponential backoff
    if (attempt < 120) { // ~60 seconds max
        setTimeout(() => waitForGeneral(attempt + 1), delay);
    } else {
        console.error("[MAJOR] WAR_GENERAL not found after ~60 seconds.");
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
            general: "OFFLINE",
            lieutenant: "OFFLINE",
            sergeant: "OFFLINE",
            major: "OFFLINE",
            colonel: "OFFLINE"
        };

        this.intervals = [];
        this.boundHandlers = new Map();
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
        this.startOfficerReadyListener();

        this.finalizeUI();

        if (this.general?.signals) {
            this.general.signals.dispatch("UI_READY", {});
            this.general.signals.dispatch("MAJOR_READY", {});
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

        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    renderBaseHTML() {
        this.shadow.innerHTML = `
            <div id="nexus-container">
                <button id="nexus-toggle" class="nexus-btn">Menu</button>
                <div id="nexus-drawer">
                    <div class="drawer-header">
                        <span class="drawer-title">WAR NEXUS</span>
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

        this.buildTabs();
        this.buildPanels();
    }
    
    applyBaseStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; }
            #nexus-container {
                position: fixed;
                bottom: 0; left: 0;
                pointer-events: none;
                --drawer-transition: 0.32s;
                --button-transition: 0.15s;
            }
            .nexus-btn {
                pointer-events: auto;
                position: fixed;
                width: 50px; height: 50px;
                border-radius: 50%;
                font-size: 20px;
                border: none;
                background: #0a0a0a;
                color: #00c8ff;
                box-shadow: 0 0 8px #00c8ff;
                cursor: pointer;
                transition: transform var(--button-transition), box-shadow var(--button-transition);
                user-select: none;
                bottom: 20px; left: 20px;
            }
            .nexus-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 0 12px #00e1ff;
            }
            #nexus-drawer {
                position: fixed;
                top: 0;
                width: 360px;
                height: 100vh;
                background: rgba(0,0,0,0.92);
                backdrop-filter: blur(6px);
                border-right: 2px solid #00c8ff;
                transform: translateX(-100%);
                transition: transform var(--drawer-transition);
                pointer-events: auto;
            }
            #nexus-drawer.right {
                border-right: none;
                border-left: 2px solid #00c8ff;
                transform: translateX(100%);
            }
            .drawer-open-left { transform: translateX(0) !important; }
            .drawer-closed-left { transform: translateX(-100%) !important; }
            .drawer-open-right { transform: translateX(0) !important; }
            .drawer-closed-right { transform: translateX(100%) !important; }
        `;
        this.shadow.appendChild(style);
    }

    /* ============================================================
       TABS & PANELS 
       ============================================================ */
    buildTabs() { }
    buildPanels() { }
    renderActivePanel() { }

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
        this.drawerEl.className = this.drawerOpen 
            ? `drawer-open-${side === "right" ? "open-right" : "open-left"}`
            : `drawer-closed-${side === "right" ? "right" : "left"}`;
        if (side === "right") this.drawerEl.classList.add("right");
        else this.drawerEl.classList.remove("right");
    }

    updateDrawerSide() {
        this.applyDrawerClasses();
    }

    /* ============================================================
       DRAG LOGIC 
       ============================================================ */
    attachDragLogic() {
        const startDrag = (e) => {
            if (e.button !== 0) return; 
            e.preventDefault();

            this.dragging = true;
            this._isDragging = true;

            const pt = e.touches ? e.touches[0] : e;
            const rect = this.buttonEl.getBoundingClientRect();
            this.dragOffsetX = pt.clientX - rect.left;
            this.dragOffsetY = pt.clientY - rect.top;

            const moveHandler = (e) => {
                const pt = e.touches ? e.touches[0] : e;
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
        const size = 50 + 16;

        return {
            x: Math.max(8, Math.min(w - size, x)),
            y: Math.max(8, Math.min(h - size, y))
        };
    }

    attachResizeObserver() {
        window.addEventListener("resize", () => this.updateDrawerSide());
    }

    applyAnimationPreferences() { }

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
            box.innerHTML = `
                <span class="nib nib-attack" data-id="${id}">Sword</span>
                <span class="nib nib-analyze" data-id="${id}">Magnifying Glass</span>
                <span class="nib nib-add" data-id="${id}">Plus</span>
                <span class="nib nib-share" data-id="${id}">Share</span>
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

    attachInlineEvents(node) {  }

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
    startSitrepRouter() { }
    routeSitrep(s) { }
    renderStatusBadge(st) { }
    renderThreatBadge(level) { }
    renderLevelBadge(lv) { }
    renderFactionRankChip(rank) { }
    renderOnlineIndicator(type) { }

    updateUserUI(user) { }
    renderFactionTable(list) { }
    renderEnemyTable(list) { }
    renderTargetTables(targets) { }
    renderTargetSubpanel(targets) { }
    updateChainUI(chain) { }
    renderChainLog(log) { }

    attachAttackButtons(container) { }
    attachAnalyzeButtons(container) { }
    attachAddTargetButtons(container) { }

    buildColonelPanel() { }
    addColonelMessage(side, msg) { }
    updateColonelAnswer(data) { }
    updateAnalyzeResult(data) { }

    buildSettingsPanel() { }
    loadSettings() { }
    saveSettings(cfg) { }
    attachSettingsLogic() { }
    setDrawerSide(side) { }

    updateHeatmaps(data) { }
    updateTargetScores(data) { }
    routeGlobalSitrep(data) { }
    routeFactionSitrep(data) { }

    applyExtendedStyles() { }

    finalizeUI() {
        this.buildColonelPanel();
        this.buildSettingsPanel();
        this.attachSettingsLogic();
        this.applyExtendedStyles();
    }

/* ============================================================
   REGISTER WITH GENERAL
   ============================================================ */
if (window.WAR_GENERAL && typeof window.WAR_GENERAL.register === "function") {
    window.WAR_GENERAL.register("Major", Major);
}

} 

})();
