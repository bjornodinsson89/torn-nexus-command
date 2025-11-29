// major.js — Full Command Console UI for Torn War Nexus

////////////////////////////////////////////////////////////
// MAJOR — FULL COMMAND CONSOLE UI
// Receives SITREP from Colonel via WAR_GENERAL.signals.
////////////////////////////////////////////////////////////

(function(){
"use strict";

class MajorUI {
    constructor() {
        this.general = null;

        // DOM Elements
        this.host = null;
        this.shadow = null;

        // State
        this.activeTab = "overview";
        this.docked = true;          // starts attached to the side
        this.dockSide = "left";       // left or right
        this.detached = false;        // floating window mode
        this.dragging = false;
        this.offsetX = 0;
        this.offsetY = 0;

        // Dimensions for floating window
        this.floatWidth = 380;
        this.floatHeight = 520;
        this.floatX = 40;
        this.floatY = 60;
    }

    // -------------------------------------------------------
    // INIT (called by General)
    // -------------------------------------------------------
    init(G) {
        this.general = G;
        this.createHost();
        this.renderBase();
        this.renderStyles();
        this.initEvents();

        WARDBG("Major v8.0 (Phase 1 UI Framework) online");
    }

    // -------------------------------------------------------
    // CREATE SHADOW HOST
    // -------------------------------------------------------
    createHost() {
        if (document.getElementById("nexus-major-host")) return;

        this.host = document.createElement("div");
        this.host.id = "nexus-major-host";
        this.host.style.position = "fixed";
        this.host.style.zIndex = "2147483647";

        this.shadow = this.host.attachShadow({ mode: "open" });
        document.body.appendChild(this.host);
    }

    // -------------------------------------------------------
    // RENDER BASE HTML STRUCTURE
    // -------------------------------------------------------
    renderBase() {
        this.shadow.innerHTML = `
            <div id="btn">N</div>

            <div id="panel">
                <div id="header">
                    <div id="drag-handle"></div>
                    <div id="title">WAR ROOM v8</div>
                </div>

                <div id="tabs">
                    <button data-tab="overview" class="on">OVERVIEW</button>
                    <button data-tab="faction">FACTION</button>
                    <button data-tab="enemy">ENEMY</button>
                    <button data-tab="war">WAR</button>
                    <button data-tab="chain">CHAIN</button>
                    <button data-tab="targets">TARGETS</button>
                    <button data-tab="ai">AI</button>
                    <button data-tab="settings">SETTINGS</button>
                </div>

                <div id="content">
                    <div class="tab-panel" id="t-overview">OVERVIEW PANEL</div>
                    <div class="tab-panel" id="t-faction">FACTION PANEL</div>
                    <div class="tab-panel" id="t-enemy">ENEMY PANEL</div>
                    <div class="tab-panel" id="t-war">WAR PANEL</div>
                    <div class="tab-panel" id="t-chain">CHAIN PANEL</div>
                    <div class="tab-panel" id="t-targets">TARGETS PANEL</div>
                    <div class="tab-panel" id="t-ai">AI PANEL</div>
                    <div class="tab-panel" id="t-settings">
                        <b>Settings (Phase 1)</b><br><br>
                        <button id="opt-dock-left">Dock Left</button><br><br>
                        <button id="opt-dock-right">Dock Right</button><br><br>
                        <button id="opt-detach">Detach / Float</button><br><br>
                        <button id="opt-attach">Attach</button><br><br>
                    </div>
                </div>
            </div>
        `;

        this.applyDockPosition();
    }

    // -------------------------------------------------------
    // STYLING
    // -------------------------------------------------------
    renderStyles() {
        const css = `
            :host { all: initial; }

            #btn {
                position: fixed;
                width: 48px;
                height: 48px;
                border: 2px solid #00f3ff;
                border-radius: 50%;
                background: rgba(0,0,0,0.8);
                bottom: 20px;
                left: 20px;
                color: #00f3ff;
                font-family: sans-serif;
                font-size: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
            }

            #panel {
                position: fixed;
                width: 380px;
                height: 60vh; /* mid-height slide panel */
                background: #050505;
                border: 2px solid #00f3ff;
                border-radius: 12px;
                box-shadow: 0 0 12px #00f3ff;
                overflow: hidden;
                display: none;
            }

            #panel.on {
                display: block;
            }

            #header {
                height: 38px;
                background: #000;
                border-bottom: 1px solid #00f3ff;
                display: flex;
                align-items: center;
                padding: 0 10px;
                cursor: move;
            }

            #drag-handle {
                width: 16px;
                height: 16px;
                background: #00f3ff;
                border-radius: 50%;
                margin-right: 10px;
            }

            #title {
                color: #00f3ff;
                font-family: sans-serif;
                font-size: 15px;
            }

            #tabs {
                display: flex;
                border-bottom: 1px solid #00f3ff;
            }

            #tabs button {
                flex: 1;
                background: #000;
                color: #00f3ff;
                padding: 8px;
                border: none;
                cursor: pointer;
                font-size: 12px;
            }

            #tabs button.on {
                background: #00f3ff;
                color: #000;
            }

            #content {
                height: calc(60vh - 78px);
                overflow-y: auto;
                padding: 10px;
                color: #fff;
                font-family: sans-serif;
            }

            .tab-panel {
                display: none;
            }

            .tab-panel.on {
                display: block;
            }
        `;

        const style = document.createElement("style");
        style.textContent = css;
        this.shadow.appendChild(style);
    }

    // -------------------------------------------------------
    // EVENT BINDINGS
    // -------------------------------------------------------
    initEvents() {
        const btn = this.shadow.getElementById("btn");
        const panel = this.shadow.getElementById("panel");

        btn.addEventListener("click", () => {
            panel.classList.toggle("on");
        });

        // Tab switching
        this.shadow.querySelectorAll("#tabs button").forEach(b => {
            b.addEventListener("click", () => {
                this.setTab(b.dataset.tab);
            });
        });

        // Draggable floating mode
        const header = this.shadow.getElementById("header");
        header.addEventListener("mousedown", e => this.startDrag(e));
        window.addEventListener("mousemove", e => this.onDrag(e));
        window.addEventListener("mouseup", () => this.endDrag());

        // Settings actions
        this.shadow.getElementById("opt-dock-left").onclick = () => {
            this.docked = true;
            this.dockSide = "left";
            this.detached = false;
            this.applyDockPosition();
        };

        this.shadow.getElementById("opt-dock-right").onclick = () => {
            this.docked = true;
            this.dockSide = "right";
            this.detached = false;
            this.applyDockPosition();
        };

        this.shadow.getElementById("opt-detach").onclick = () => {
            this.detached = true;
            this.docked = false;
            this.applyFloating();
        };

        this.shadow.getElementById("opt-attach").onclick = () => {
            this.detached = false;
            this.docked = true;
            this.applyDockPosition();
        };
    }

    // -------------------------------------------------------
    // TAB SWITCHING
    // -------------------------------------------------------
    setTab(name) {
        this.activeTab = name;

        this.shadow.querySelectorAll("#tabs button")
            .forEach(b => b.classList.remove("on"));
        this.shadow.querySelector(`[data-tab="${name}"]`).classList.add("on");

        this.shadow.querySelectorAll(".tab-panel")
            .forEach(p => p.classList.remove("on"));
        this.shadow.getElementById(`t-${name}`).classList.add("on");
    }

    // -------------------------------------------------------
    // DOCKED MODE POSITIONING
    // -------------------------------------------------------
    applyDockPosition() {
        const panel = this.shadow.getElementById("panel");

        panel.style.display = "none"; // allow reposition before showing

        if (this.dockSide === "left") {
            panel.style.left = "0";
        } else {
            panel.style.left = "";
            panel.style.right = "0";
        }

        // Vertical middle
        panel.style.top = "20vh";

        panel.classList.add("on");
    }

    // -------------------------------------------------------
    // FLOATING WINDOW MODE
    // -------------------------------------------------------
    applyFloating() {
        const panel = this.shadow.getElementById("panel");

        panel.style.left = this.floatX + "px";
        panel.style.top = this.floatY + "px";
        panel.style.width = this.floatWidth + "px";
        panel.style.height = this.floatHeight + "px";

        panel.classList.add("on");
    }

    // -------------------------------------------------------
    // DRAG HANDLING
    // -------------------------------------------------------
    startDrag(e) {
        if (!this.detached) return;

        this.dragging = true;
        this.offsetX = e.clientX - this.floatX;
        this.offsetY = e.clientY - this.floatY;
    }

    onDrag(e) {
        if (!this.dragging) return;

        this.floatX = e.clientX - this.offsetX;
        this.floatY = e.clientY - this.offsetY;

        this.applyFloating();
    }

    endDrag() {
        this.dragging = false;
    }
}

// -----------------------------------------------------------
// REGISTRATION (auto retry)
// -----------------------------------------------------------
function register() {
    if (window.WAR_GENERAL && WAR_GENERAL.register) {
        WAR_GENERAL.register("Major", new MajorUI());
        return true;
    }
    return false;
}

if (!register()) {
    let tries = 0;
    const timer = setInterval(() => {
        if (register() || ++tries > 20) clearInterval(timer);
    }, 200);
}

})();
