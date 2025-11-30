// ==UserScript==
// @name         WAR_Nexus
// @namespace    WarNexus_General
// @version      3.0.6
// @description  WAR NEXUS Command Core — The General (DARK OPS Edition)
// @author       Bjorn
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
//
// @require      https://cdn.jsdelivr.net/npm/chart.js
//
// @require      https://raw.githubusercontent.com/bjornodinsson89/torn-nexus-command/main/officers/lieutenant.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/torn-nexus-command/main/officers/colonel.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/torn-nexus-command/main/officers/sergeant.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/torn-nexus-command/main/officers/major.js
// ==/UserScript==

(function(){
"use strict";

/* ============================================================================
   STATE
   Core runtime state for WAR NEXUS.
   ============================================================================
*/
const STATE = {
    apiKey: null,
    settings: {},
    events: {},
    officers: {},
    lastRequest: 0,
    capabilities: null,
    ready: false
};

/* ============================================================================
   ENCRYPTION UTILITIES
   Simple reversible encryption for storing API keys locally.
   ============================================================================
*/
const Crypto = {
    lock(t){
        return btoa([...t].reverse().join(""));
    },
    unlock(t){
        try {
            return atob(t).split("").reverse().join("");
        } catch {
            return null;
        }
    }
};

/* ============================================================================
   LOAD STORED VALUES
   Loads API key and settings from GM storage.
   ============================================================================
*/
(function loadStored(){
    const storedKey = GM_getValue("WN_API_KEY");
    if (storedKey){
        STATE.apiKey = Crypto.unlock(storedKey) || null;
    }

    const storedSettings = GM_getValue("WN_SETTINGS");
    if (storedSettings){
        try { STATE.settings = JSON.parse(storedSettings); }
        catch { STATE.settings = {}; }
    }
})();

/* ============================================================================
   LOGGING
   Improved internal logging with enhanced error reporting.
   Passed through to Major UI’s log panel.
   ============================================================================
*/
function log(msg){
    const t = `[${new Date().toLocaleTimeString()}] GENERAL: ${msg}`;

    try {
        const bus = window.WAR_NEXUS?.events;
        if (bus){
            bus.emit("ERROR", msg);
        }
    } catch {}

    console.log(t);
}

/* ============================================================================
   EVENT BUS
   Reliable pub/sub system for inter-module communication.
   ============================================================================
*/
const Events = {
    on(name, fn){
        if (!STATE.events[name]) STATE.events[name] = [];
        STATE.events[name].push(fn);
        return ()=>{
            STATE.events[name] = STATE.events[name].filter(x=>x!==fn);
        };
    },
    emit(name, data){
        const list = STATE.events[name];
        if (!list) return;
        for (const fn of list){
            try { fn(data); }
            catch(e){
                log(`Event error in '${name}': ${e.message}`);
            }
        }
    }
};

/* ============================================================================
   API WRAPPER — V1 and V2 (safe)
   Improved with stricter error codes and stable return handling.
   ============================================================================
*/
const API_V1 = "https://api.torn.com";
const API_V2 = "https://api.torn.com/v2";

async function apiCall(url, tag){
    return new Promise((resolve, reject)=>{
        if (!STATE.apiKey) return reject("NO_KEY");

        const now = Date.now();
        if (now - STATE.lastRequest < 250){
            return reject("RATE_LIMIT");
        }
        STATE.lastRequest = now;

        GM_xmlhttpRequest({
            method:"GET",
            url,
            onload:r=>{
                if (r.status !== 200){
                    log(`${tag} HTTP_${r.status}`);
                    reject("HTTP_"+r.status);
                    return;
                }
                try {
                    const data = JSON.parse(r.responseText);
                    if (data.error) reject("API_"+data.error.error);
                    else resolve(data);
                } catch(e){
                    reject("PARSE");
                }
            },
            onerror:()=>reject("NETWORK")
        });
    });
}

const Intel = {
    hasCredentials(){ return !!STATE.apiKey; },

    setCredentials(raw){
        STATE.apiKey = raw;
        GM_setValue("WN_API_KEY", Crypto.lock(raw));
        log("API KEY STORED");
    },

    requestV2(path, params){
        const qs = new URLSearchParams();
        qs.set("key", STATE.apiKey);
        if (params){
            for (const k in params){
                if (params[k] != null) qs.set(k, params[k]);
            }
        }
        const clean = path.startsWith("/") ? path : ("/"+path);
        const url = `${API_V2}${clean}?${qs}`;
        return apiCall(url, `V2 ${clean}`);
    },

    requestV1(section, selections, id){
        const qs = new URLSearchParams();
        qs.set("selections", selections);
        qs.set("key", STATE.apiKey);
        const base = id ? `/${section}/${id}` : `/${section}/`;
        const url = `${API_V1}${base}?${qs}`;
        return apiCall(url, `V1 ${section}`);
    }
};

/* ============================================================================
   WAR NEXUS CORE OBJECT
   Exposed globally for all officers to access.
   ============================================================================
*/
const WAR_NEXUS = {
    log,
    events: Events,
    intel: Intel,
    settings: STATE.settings,
    state: STATE,

    registerOfficer(name, module){
        STATE.officers[name] = module;
        log(`OFFICER REGISTERED: ${name}`);

        try {
            if (module && typeof module.init === "function"){
                module.init(WAR_NEXUS);
            }
        } catch(e){
            log(`INIT ERROR ${name}: ${e.message}`);
        }
    }
};

window.WAR_NEXUS = WAR_NEXUS;

/* ============================================================================
   API AUTH POPUP
   ============================================================================
*/
function showApiPopup(){
    GM_addStyle(`
        #wn-api-overlay {
            position:fixed; inset:0; background:rgba(0,0,0,0.65);
            z-index:2147483646;
        }
        #wn-api-box {
            position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
            width:380px; max-width:90%;
            background:#0e0e0e; border:1px solid #111;
            box-shadow:0 0 20px rgba(0,0,0,0.7);
            color:#ddd; font-family:var(--font,Segoe UI,Arial);
            border-radius:4px;
            z-index:2147483647;
        }
        #wn-api-header {
            padding:12px; background:#000; color:#4ac3ff;
            border-bottom:1px solid #111; font-size:14px; font-weight:600;
        }
        #wn-api-body { padding:12px; font-size:12px; }
        #wn-api-body input {
            width:100%; padding:8px; margin-top:12px;
            background:#080808; color:#ddd;
            border:1px solid #333; border-radius:3px;
        }
        #wn-api-footer {
            padding:12px; border-top:1px solid #111; text-align:right;
        }
        .wn-btn {
            padding:6px 10px; margin-left:6px;
            border-radius:3px; cursor:pointer; font-size:12px;
        }
        .wn-btn-primary {
            background:#4ac3ff; color:#000; border:1px solid #3ab5ee;
        }
        .wn-btn-secondary {
            background:#222; color:#ddd; border:1px solid #333;
        }
    `);

    const overlay = document.createElement("div");
    overlay.id = "wn-api-overlay";

    const box = document.createElement("div");
    box.id = "wn-api-box";

    box.innerHTML = `
        <div id="wn-api-header">WAR NEXUS — API Authorization</div>
        <div id="wn-api-body">
            <p>Enter your Torn API key (stored encrypted locally).</p>
            <input type="password" id="wn-api-input" placeholder="Paste API Key">
        </div>
        <div id="wn-api-footer">
            <button class="wn-btn wnx-btn-secondary" id="wn-api-cancel">Cancel</button>
            <button class="wn-btn wnx-btn-primary" id="wn-api-save">Authorize</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(box);

    box.querySelector("#wn-api-cancel").onclick = ()=>{
        overlay.remove(); box.remove();
    };
    box.querySelector("#wn-api-save").onclick = ()=>{
        const key = box.querySelector("#wn-api-input").value.trim();
        if (!key){
            alert("Enter a valid key.");
            return;
        }
        Intel.setCredentials(key);
        overlay.remove(); box.remove();
        boot();
    };
}

/* ============================================================================
   OFFICER LOADING
   ============================================================================
*/
function registerOfficers(){
    if (!window.__NEXUS_OFFICERS){
        log("NO OFFICERS DETECTED");
        return;
    }
    for (const off of window.__NEXUS_OFFICERS){
        if (!off || !off.name || !off.module) continue;
        WAR_NEXUS.registerOfficer(off.name, off.module);
    }
}

/* ============================================================================
   BOOT SEQUENCE
   Now capability-aware:
   - Step 1: API popup (if needed)
   - Step 2: Register officers
   - Step 3: Wait for Lieutenant capability scan
   - Step 4: Emit NEXUS_READY
   ============================================================================
*/
function boot(){
    log("WAR NEXUS BOOT (3.0.3)");

    registerOfficers();

    // Wait for capability scan
    WAR_NEXUS.events.on("API_CAPABILITIES_READY", caps=>{
        STATE.capabilities = caps;
        log("Capabilities: " + JSON.stringify(caps));

        STATE.ready = true;
        WAR_NEXUS.events.emit("NEXUS_READY");

        log("WAR NEXUS READY");
    });
}

/* ============================================================================
   STARTUP
   ============================================================================
*/
if (!STATE.apiKey){
    showApiPopup();
} else {
    boot();
}

})();
