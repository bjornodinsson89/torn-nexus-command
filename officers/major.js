/********************************************************************
 *  MAJOR v3.2.2 – GUI Officer
 ********************************************************************/

(function() {

class Major {

    constructor() {
        this.general = null;

        this.host = null;
        this.root = null;

        this.drawer = null;
        this.toggleBtn = null;

        this.settings = {
            drawerSide: localStorage.getItem("warroom_drawerSide") || "left",
            toggleX: Number(localStorage.getItem("war_toggle_x") || 25),
            toggleY: Number(localStorage.getItem("war_toggle_y") || 150),
        };

        this.listeners = [];
        this.intervals = [];

        this._isDragging = false;     // <-- NEW
        this._dragMoved = false;      // <-- NEW
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

        console.log("%c[Major v3.2.2] GUI Online", "color:#0af");
    }

    /**************************************************************
     * HOST CREATION
     **************************************************************/
    createHost() {
        let host = document.getElementById("war-room-host");

        if (!host) {
            host = document.createElement("div");
            host.id = "war-room-host";
            host.style.position = "fixed";
            host.style.top = "0";
            host.style.left = "0";
            host.style.width = "0";
            host.style.height = "0";
            host.style.zIndex = "999999";
            document.body.appendChild(host);
        }

        this.host = host;
    }

    /**************************************************************
     * SHADOW ROOT
     **************************************************************/
    createShadow() {
        this.root = this.host.shadowRoot || this.host.attachShadow({ mode: "open" });
    }

    /**************************************************************
     * STYLES (unchanged)
     **************************************************************/
    injectStyles() {
        const s = document.createElement("style");
        s.textContent = `
        /* full original CSS unchanged */
        #wr-toggle-btn {
            position: fixed;
            width: 40px;
            height: 40px;
            background: #b00;
            color: #fff;
            font-size: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            border: 2px solid #e44;
            cursor: pointer;
            z-index: 9999999;
            user-select: none;
        }

        #wr-drawer {
            position: fixed;
            top: 0;
            height: 100vh;
            width: 320px;
            background: #111;
            color: #ccc;
            font-family: Arial, sans-serif;
            border-right: 2px solid #a00;
            border-left: 2px solid #a00;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            z-index: 9999998;
            display: flex;
            flex-direction: column;
        }

        #wr-drawer.right {
            left: auto;
            right: 0;
            border-right: none;
            border-left: 2px solid #a00;
            transform: translateX(100%);
        }

        #wr-drawer.open.left {
            transform: translateX(0);
        }
        #wr-drawer.open.right {
            transform: translateX(0);
        }

        #wr-tabs {
            display: flex;
            background: #222;
            border-bottom: 1px solid #444;
        }

        .wr-tab {
            padding: 8px 12px;
            cursor: pointer;
            color: #aaa;
            font-size: 13px;
        }

        .wr-tab.active {
            background: #a00;
            color: #fff;
        }

        .wr-panel {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: none;
        }

        .wr-panel.active {
            display: block;
        }
        `;
        this.root.appendChild(s);
    }

    /**************************************************************
     * TOGGLE BUTTON (Drag/Click Separation Fixed)
     **************************************************************/
    createToggleButton() {
        const btn = document.createElement("div");
        btn.id = "wr-toggle-btn";
        btn.textContent = "⚔️";

        btn.style.top = this.settings.toggleY + "px";
        btn.style.left = this.settings.toggleX + "px";

        this.root.appendChild(btn);
        this.toggleBtn = btn;

        this.makeDraggable(btn);

        // PREVENT toggle if dragging occurred
        btn.addEventListener("click", () => {
            if (this._isDragging) return;
            this.toggleDrawer();
        });
    }

    /**************************************************************
     * MAKE DRAGGABLE — FIXED
     **************************************************************/
    makeDraggable(btn) {
        let sx, sy, ox, oy;

        btn.addEventListener("mousedown", (e) => {
            this._dragMoved = false;
            this._isDragging = false;

            sx = e.clientX;
            sy = e.clientY;
            ox = parseInt(btn.style.left);
            oy = parseInt(btn.style.top);

            const move = (ev) => {
                const dx = ev.clientX - sx;
                const dy = ev.clientY - sy;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    this._dragMoved = true;
                    this._isDragging = true;
                }

                if (this._dragMoved) {
                    btn.style.left = (ox + dx) + "px";
                    btn.style.top = (oy + dy) + "px";
                }
            };

            const up = () => {
                if (this._dragMoved) {
                    localStorage.setItem("war_toggle_x", btn.style.left.replace("px", ""));
                    localStorage.setItem("war_toggle_y", btn.style.top.replace("px", ""));
                }

                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);

                // dragging ends
                setTimeout(() => { this._isDragging = false; }, 50);
            };

            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        });
    }

    /**************************************************************
     * (Other functions unchanged)
     **************************************************************/
    createDrawer() { /* unchanged */ }
    buildTabs() { /* unchanged */ }
    buildPanels() { /* unchanged */ }
    buildSettingsPanel(panel) { /* unchanged */ }
    updateDrawerSide() { /* unchanged */ }
    activateTab(name) { /* unchanged */ }
    toggleDrawer() { /* unchanged */ }
    registerSignals() { /* unchanged */ }

    /**************************************************************
     * CLEANUP — FIXED
     **************************************************************/
    cleanup() {
        this.listeners.forEach(u => u());
        this.listeners = [];

        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];

        if (this.host) {
            this.host.remove();   // <-- FIXED: removes Shadow DOM properly
        }

        this.host = null;
        this.root = null;
    }
}

/**************************************************************
 * REGISTER
 **************************************************************/
if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Major", new Major());
} else {
    console.warn("[Major v3.2.2] WAR_GENERAL not found.");
}

})();
