// ==UserScript==
// @name         WAR_GENERAL v4.0 — FINAL FIXED & HARDENED
// @namespace    WAR_ROOM
// @version      4.0
// @description  Nexus Core – Event Bus, Officer Loader, Credential Vault, Safe Fetch, Full Officer Comms
// @match        https://www.torn.com/*
// @match        https://www2.torn.com/*
// @connect      api.torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    /************************************************************
     * EVENT BUS
     ************************************************************/
    const signals = {
        _listeners: {},

        listen(event, fn) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(fn);

            return () => {
                const arr = this._listeners[event];
                if (!arr) return;
                const idx = arr.indexOf(fn);
                if (idx !== -1) arr.splice(idx, 1);
                if (arr.length === 0) delete this._listeners[event];
            };
        },

        dispatch(event, payload) {
            const arr = this._listeners[event];
            if (!arr) return;
            // Copy array to prevent mutation during dispatch
            arr.slice().forEach(fn => {
                try { fn(payload); }
                catch (err) { console.error(`[WAR_GENERAL] Listener error on "${event}":`, err); }
            });
        }
    };

    /************************************************************
     * OFFICER REGISTRY 
     ************************************************************/
    const officers = {};
    const readyOfficers = new Set();

    function register(name, officer) {
        if (!name || typeof officer !== "object" || officer === null) {
            console.error(`[WAR_GENERAL] Invalid officer registration: ${name}`);
            return false;
        }

        officers[name] = officer;
        console.log(`%c[WAR_GENERAL] Officer "${name}" registered.`, "color:#0f0");

        // Auto-init if General is already online
        if (window.WAR_GENERAL && officer.init) {
            try {
                officer.init(window.WAR_GENERAL);
                readyOfficers.add(name);
                signals.dispatch("OFFICER_READY", { name, officer });
            } catch (err) {
                console.error(`[WAR_GENERAL] Officer "${name}" failed to init:`, err);
            }
        }
        return true;
    }

    /************************************************************
     * CREDENTIAL VAULT 
     ************************************************************/
    function getCredentials() {
        return GM_getValue("torn_api_key") ||
               document.querySelector("input[name='api-key']")?.value ||
               localStorage.getItem("torn_api_key") ||
               "";
    }

    function hasCredentials() {
        return !!getCredentials().trim();
    }

    /************************************************************
     * SAFE FETCH LAYER 
     ************************************************************/
    async function safeFetch(url, opts = {}) {
        return new Promise((resolve, reject) => {
            const key = opts.apiKey || getCredentials();
            if (!key) return reject(new Error("No API key"));

            GM_xmlhttpRequest({
                method: "GET",
                url: url.includes("?") ? `\( {url}&key= \){key}` : `\( {url}?key= \){key}`,
                timeout: opts.timeout || 10000,
                headers: { "Accept": "application/json" },
                onload: res => {
                    if (res.status !== 200) return reject(new Error(`HTTP ${res.status}`));
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) reject(new Error(data.error.code + ": " + data.error.error));
                        else resolve(data);
                    } catch (e) { reject(e); }
                },
                onerror: () => reject(new Error("Network error")),
                ontimeout: () => reject(new Error("Request timeout"))
            });
        });
    }

    /************************************************************
     * INTEL LAYER 
     ************************************************************/
    const intel = {
        hasCredentials,
        getCredentials,

        async request({ selections = ["basic"], normalize = false, id } = {}) {
            const sel = Array.isArray(selections) ? selections.join(",") : selections;
            const base = id ? `user/${id}` : "user";
            const url = `https://api.torn.com/\( {base}/?selections= \){sel}`;
            const data = await safeFetch(url);

            if (normalize) {
                return this.normalize(data);
            }
            return data;
        },

        normalize(raw) {
            if (!raw) return null;
            return {
                user: raw.player_id ? {
                    id: raw.player_id,
                    name: raw.name,
                    level: raw.level,
                    status: raw.status?.description || raw.status || "Unknown",
                    hp: raw.status?.state === "Hospital" ? raw.status?.hospital_timestamp : raw.life?.current || 0,
                    max_hp: raw.life?.maximum || 100,
                    energy: raw.energy?.current || 0,
                    nerve: raw.nerve?.current || 0
                } : null,
                chain: raw.chain ? {
                    current: raw.chain.current || 0,
                    timeout: raw.chain.timeout || 0
                } : null,
                faction: raw.faction ? {
                    faction_id: raw.faction.faction_id,
                    name: raw.faction.faction_name,
                    members: raw.faction.members || {}
                } : null,
                war: raw.war ? {
                    state: raw.war.state || "PEACE",
                    enemyMembers: Object.values(raw.war.enemies || {}),
                    targets: raw.war.targets || []
                } : null
            };
        }
    };

    /************************************************************
     * PLUGIN LOADER 
     ************************************************************/
    function loadPlugin(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load plugin: ${url}`));
            document.head.appendChild(script);
        });
    }

    /************************************************************
     * WAR_GENERAL
     ************************************************************/
    const WAR_GENERAL = {
        version: "4.0",
        signals,
        officers,
        register,
        intel,
        loadPlugin,

        // Legacy compatibility
        getOfficer(name) { return officers[name] || null; },

        // Init all registered officers when General comes online
        _initOfficers() {
            Object.entries(officers).forEach(([name, officer]) => {
                if (!readyOfficers.has(name) && officer.init) {
                    try {
                        officer.init(this);
                        readyOfficers.add(name);
                        signals.dispatch("OFFICER_READY", { name, officer });
                    } catch (err) {
                        console.error(`[WAR_GENERAL] Failed to init officer "${name}":`, err);
                    }
                }
            });
        }
    };

    /************************************************************
     * BOOT SEQUENCE 
     ************************************************************/
    function boot() {
        if (window.WAR_GENERAL) {
            console.warn("[WAR_GENERAL] Already loaded!");
            return;
        }

        window.WAR_GENERAL = WAR_GENERAL;

        console.log("%c[WAR_GENERAL v4.0] COMMAND ONLINE — OFFICERS, REPORT IN!", "color:#0f0; font-weight:bold; font-size:14px;");

        // Expose for debugging
        window.WG = WAR_GENERAL;

        // Initialize all officers that registered early
        WAR_GENERAL._initOfficers();

        // Final readiness broadcast
        signals.dispatch("GENERAL_READY", WAR_GENERAL);
    }

    // Run immediately
    boot();

})();
