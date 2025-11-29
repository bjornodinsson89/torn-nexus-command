// ==UserScript==
// @name         WAR_GENERAL_NEXUS_v7.3
// @version      7.3
// @description  Torn War Room — Central Command Engine
// @author       Bjorn
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // SECTION 1 — VAULT / PRIVATE STATE (Invisible to plugins)
    // ============================================================

    let _secureKey = null;            // Decrypted Torn API Key (never exposed)
    const _officers = {};             // Loaded plugins
    const _events = {};               // Event Bus
    let _lastIntel = 0;               // Rate limiting

    const Crypto = {
        lock: t => btoa(t.split("").reverse().join("")),
        unlock: t => atob(t).split("").reverse().join("")
    };

    const stored = GM_getValue("WAR_API_KEY");
    if (stored) {
        try { _secureKey = Crypto.unlock(stored); }
        catch { _secureKey = null; }
    }

    // ============================================================
    // SECTION 2 — DEBUG OVERLAY (Silent, CSP-safe)
    // ============================================================

    GM_addStyle(`
        #war-debug-box {
            position:fixed; bottom:0; right:0;
            width:340px; height:180px;
            background:rgba(0,0,0,0.82);
            border:1px solid #0ff;
            font-family:monospace;
            font-size:11px;
            color:#0ff;
            overflow-y:auto; padding:4px;
            z-index:2147483647;
            pointer-events:none;
        }
    `);

    const debugBox = document.createElement("div");
    debugBox.id = "war-debug-box";
    document.body.appendChild(debugBox);

    function DBG(msg) {
        const t = new Date().toLocaleTimeString();
        debugBox.innerHTML += `<div>[${t}] ${msg}</div>`;
        debugBox.scrollTop = debugBox.scrollHeight;
    }

    window.WARDBG = DBG;  // Just for convenience console use

    // ============================================================
    // SECTION 3 — INTEL ENGINE (Torn API via GM_xmlhttpRequest)
    // ============================================================

    function performTornFetch(selections) {
        return new Promise((resolve, reject) => {

            if (!_secureKey)
                return reject("NO_KEY");

            const now = Date.now();
            if (now - _lastIntel < 500)    // 0.5s minimum throttle
                return reject("RATE_LIMIT");

            _lastIntel = now;

            const url =
                `https://api.torn.com/user/?selections=${selections}&key=${_secureKey}`;

            GM_xmlhttpRequest({
                method: "GET",
                url,
                onload: res => {
                    if (res.status !== 200)
                        return reject("HTTP_" + res.status);

                    let data;
                    try { data = JSON.parse(res.responseText); }
                    catch { return reject("PARSE"); }

                    if (data.error)
                        return reject("API_" + data.error.error);

                    resolve(data);
                },
                onerror: () => reject("NETWORK")
            });

        });
    }

    // ============================================================
    // SECTION 4 — PLUGIN LOADER (Officer Recruitment)
    // ============================================================

    function loadOfficer(url) {
        DBG("LOAD: " + url);

        GM_xmlhttpRequest({
            method: "GET",
            url: url + "?v=" + Date.now(),   // bypass caching
            onload: res => {
                try {
                    const exec = new Function("WAR_GENERAL", "WARDBG", res.responseText);
                    exec(WAR_GENERAL, DBG);   // officer executes in sandbox
                } catch (e) {
                    DBG("LOAD ERROR: " + e.message);
                }
            },
            onerror: e => DBG("LOAD FAIL: " + e)
        });
    }

    // ============================================================
    // SECTION 5 — PUBLIC INTERFACE TO PLUGINS
    // ============================================================

    const WAR_GENERAL = {

        // --- Registration ---
        register(name, module) {
            DBG("REGISTER: " + name);
            _officers[name] = module;
            if (module?.init) module.init(WAR_GENERAL);
        },

        // --- Event Bus ---
        signals: {
            listen(ev, fn) {
                if (!_events[ev]) _events[ev] = [];
                _events[ev].push(fn);
                return () => {
                    _events[ev] = _events[ev].filter(x => x !== fn);
                };
            },
            dispatch(ev, data) {
                const L = _events[ev];
                if (L) L.forEach(fn => fn(data));
            }
        },

        // --- Torn Intel ---
        intel: {
            request(selections) {
                return performTornFetch(selections);
            },
            setCredentials(raw) {
                _secureKey = raw;
                GM_setValue("WAR_API_KEY", Crypto.lock(raw));
                DBG("API KEY STORED");
            },
            hasCredentials() {
                return !!_secureKey;
            }
        },

        // --- Officer Loader ---
        loadOfficer
    };

    window.WAR_GENERAL = WAR_GENERAL;

    // ============================================================
    // SECTION 6 — API KEY AUTH POPUP
    // ============================================================

    function showAuthPopup() {
        const html = `
            <div id="war-auth-overlay"
                style="position:fixed; top:0; left:0; width:100%; height:100%;
                background:rgba(0,0,0,0.7); z-index:2147483646;">
            </div>

            <div id="war-auth-panel"
                style="position:fixed; top:50%; left:50%;
                transform:translate(-50%, -50%);
                width:320px; background:#050505;
                border:2px solid #00f3ff; padding:18px;
                z-index:2147483647; color:#00f3ff;
                font-family:'Courier New', monospace;">
                
                <div style="margin-bottom:10px; font-size:16px;">
                    <b>WAR ROOM // AUTHORIZATION</b>
                </div>

                <div style="font-size:12px; margin-bottom:14px; height:140px;
                    overflow-y:auto; padding:8px; border:1px solid #00f3ff;">
                    Enter your Torn API Key.<br><br>
                    This key is encrypted locally and never exposed
                    to any officer module.  
                </div>

                <input id="war-auth-input"
                    placeholder="Enter API Key"
                    style="width:100%; padding:7px; margin-bottom:10px;
                    background:#000; color:#00f3ff; border:1px solid #00f3ff;">

                <button id="war-auth-save"
                    style="width:100%; padding:8px; background:#00f3ff;
                    color:#000; font-weight:bold; cursor:pointer;">
                    AUTHORIZE
                </button>
            </div>
        `;

        const wrap = document.createElement("div");
        wrap.innerHTML = html;
        document.body.appendChild(wrap);

        document.getElementById("war-auth-save").onclick = () => {
            const key = document.getElementById("war-auth-input").value.trim();
            if (key.length > 0) {
                WAR_GENERAL.intel.setCredentials(key);
                wrap.remove();
                deployOfficers();
            }
        };
    }

    // ============================================================
    // SECTION 7 — OFFICER DEPLOYMENT
    // ============================================================

    function deployOfficers() {
        DBG("DEPLOYING OFFICERS");

        const urls = [
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/lieutenant.js",
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/colonel.js",
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/sergeant_rest.js", // R2 REST VERSION
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/major.js"
        ];

        urls.forEach(loadOfficer);
    }

    // ============================================================
    // SECTION 8 — BOOT
    // ============================================================

    if (!_secureKey) showAuthPopup();
    else deployOfficers();

})();
