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
        this.tabs = {};
    }

    /**************************************************************
     * INIT
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

        console.log("%c[Major v3.2.2] GUI Online", "color:#0af");
    }

    /**************************************************************
     * HOST CREATION (Always overlays, always exists)
     **************************************************************/
    createHost() {
        let host = document.getElementById("war-room-host");

        if (!host) {
            host = document.createElement("div");
            host.id = "war-room-host";
            // absolute overlay
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
     * SHADOW ROOT (Always attaches)
     **************************************************************/
    createShadow() {
        this.root = this.host.shadowRoot || this.host.attachShadow({ mode: "open" });
    }

    /**************************************************************
     * STYLES
     **************************************************************/
    injectStyles() {
        const s = document.createElement("style");
        s.textContent = `
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

            /* Settings section */
            .wr-setting-row {
                margin-bottom: 12px;
            }

            .wr-setting-row label {
                display: block;
                color: #ddd;
                margin-bottom: 4px;
            }
        `;
        this.root.appendChild(s);
    }

    /**************************************************************
     * TOGGLE BUTTON (Always visible)
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

        btn.addEventListener("click", () => {
            if (!this._dragging) this.toggleDrawer();
        });
    }

    /**************************************************************
     * DRAWER + TABS + PANELS
     **************************************************************/
    createDrawer() {
        const drawer = document.createElement("div");
        drawer.id = "wr-drawer";

        // add left/right mode
        drawer.classList.add(this.settings.drawerSide);

        this.drawer = drawer;
        this.root.appendChild(drawer);

        const tabs = document.createElement("div");
        tabs.id = "wr-tabs";
        drawer.appendChild(tabs);

        this.tabsContainer = tabs;
    }

    buildTabs() {
        const tabNames = [
            "Overview", "Targets", "Faction", "War", "Chain", "AI", "Settings"
        ];

        tabNames.forEach(name => {
            const t = document.createElement("div");
            t.className = "wr-tab";
            t.textContent = name;

            t.addEventListener("click", () => this.activateTab(name));

            this.tabsContainer.appendChild(t);
            this.tabs[name] = t;
        });

        // default tab
        this.activateTab("Overview");
    }

    buildPanels() {
        const panelNames = [
            "Overview", "Targets", "Faction", "War", "Chain", "AI", "Settings"
        ];

        this.panels = {};

        panelNames.forEach(name => {
            const p = document.createElement("div");
            p.className = "wr-panel";

            p.id = "wr-panel-" + name.toLowerCase();

            if (name === "Settings") this.buildSettingsPanel(p);

            this.panels[name] = p;
            this.drawer.appendChild(p);
        });
    }

    buildSettingsPanel(panel) {
        const row = document.createElement("div");
        row.className = "wr-setting-row";

        const label = document.createElement("label");
        label.textContent = "Drawer Side";

        const select = document.createElement("select");
        select.innerHTML = `
            <option value="left">Left</option>
            <option value="right">Right</option>
        `;
        select.value = this.settings.drawerSide;

        select.addEventListener("change", () => {
            this.settings.drawerSide = select.value;
            localStorage.setItem("warroom_drawerSide", select.value);
            this.updateDrawerSide();
        });

        row.appendChild(label);
        row.appendChild(select);

        panel.appendChild(row);
    }

    updateDrawerSide() {
        this.drawer.classList.remove("left", "right");
        this.drawer.classList.add(this.settings.drawerSide);
    }

    /**************************************************************
     * TAB SWITCHING
     **************************************************************/
    activateTab(name) {
        for (const n in this.tabs) {
            this.tabs[n].classList.remove("active");
            this.panels[n].classList.remove("active");
        }
        this.tabs[name].classList.add("active");
        this.panels[name].classList.add("active");
    }

    /**************************************************************
     * DRAWER OPEN/CLOSE
     **************************************************************/
    toggleDrawer() {
        this.drawer.classList.toggle("open");
    }

    /**************************************************************
     * DRAGGABLE BUTTON
     **************************************************************/
    makeDraggable(btn) {
        let sx, sy, ox, oy;

        btn.addEventListener("mousedown", (e) => {
            this._dragging = true;
            sx = e.clientX;
            sy = e.clientY;
            ox = parseInt(btn.style.left);
            oy = parseInt(btn.style.top);

            const move = (ev) => {
                const dx = ev.clientX - sx;
                const dy = ev.clientY - sy;
                btn.style.left = (ox + dx) + "px";
                btn.style.top = (oy + dy) + "px";
            };

            const up = () => {
                this._dragging = false;

                localStorage.setItem("war_toggle_x", btn.style.left.replace("px", ""));
                localStorage.setItem("war_toggle_y", btn.style.top.replace("px", ""));

                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
            };

            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        });
    }

    /**************************************************************
     * SIGNALS (unchanged)
     **************************************************************/
    registerSignals() {
        this.listeners.push(
            this.general.signals.listen("CHAIN_SITREP", s => {
                // up to you to populate overview/chain panel
            })
        );

        this.listeners.push(
            this.general.signals.listen("WAR_SITREP", s => {
                // update war panel
            })
        );
    }

    /**************************************************************
     * CLEANUP
     **************************************************************/
    cleanup() {
        this.listeners.forEach(u => u());
        this.listeners = [];

        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];

        if (this.host) this.host.innerHTML = "";
    }
}

/**************************************************************
 * REGISTER OFFICER
 **************************************************************/
if (window.WAR_GENERAL) {
    window.WAR_GENERAL.register("Major", new Major());
} else {
    console.warn("[Major v3.2.2] WAR_GENERAL not found.");
}

})();
