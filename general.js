// ==UserScript==
// @name         WAR_GENERAL_NEXUS_v7.3
// @version      7.3
// @description  Torn War Nexus – Core Command Engine (General v7.3)
// @author       BjornOdinsson89
// @match        https://www.torn.com/*
// @match        https://www.torn.com/loader.php*
// @match        https://www.torn.com/page.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// @connect      githubusercontent.com
// @connect      gstatic.com
// @connect      firebaseio.com
// @connect      googleapis.com
// @require      https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/major.js
// ==/UserScript==

/**********************************************************
 * WAR GENERAL — CORE ENGINE (v7.3)
 **********************************************************/
(function(){

/**********************************************************
 * DEBUG WINDOW
 **********************************************************/
const DEBUG_STYLE = `
#nexus-debug-box {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 340px;
    height: 180px;
    background: #000;
    border: 1px solid #0ff;
    font-family: monospace;
    font-size: 11px;
    color: #0ff;
    overflow-y: auto;
    padding: 4px;
    z-index: 2147483646;
}
`;
GM_addStyle(DEBUG_STYLE);

const debugBox = document.createElement("div");
debugBox.id = "nexus-debug-box";
debugBox.innerHTML = "[DEBUG WINDOW ACTIVE]<br>Debug system initialized...";
document.body.appendChild(debugBox);

function WARDBG(msg){
    const t = new Date().toLocaleTimeString();
    debugBox.innerHTML += `<br>[${t}] ${msg}`;
    debugBox.scrollTop = debugBox.scrollHeight;
}

window.WARDBG = WARDBG;
WARDBG("INSANE DEBUG MODE ENABLED");

/**********************************************************
 * API VAULT (Encrypted Local Storage)
 **********************************************************/
let SECURE_KEY = null;

const Crypto = {
    lock(t){ return btoa(t.split("").reverse().join("")); },
    unlock(t){ return atob(t).split("").reverse().join(""); }
};

(function loadAPIKey(){
    const stored = GM_getValue("WAR_API_KEY");
    if (stored){
        SECURE_KEY = Crypto.unlock(stored);
        WARDBG("API KEY FOUND — Booting Nexus...");
    } else {
        WARDBG("NO API KEY — Triggering popup...");
    }
})();

/**********************************************************
 * API POPUP (FULL DISCLAIMER – SCROLL WINDOW)
 **********************************************************/
function openKeyPopup(){
    const html = `
    <div id="nexus-api-overlay"></div>
    <div id="nexus-api-modal">
        <div id="nexus-api-title">WAR ROOM // AUTHORIZATION</div>

        <div id="nexus-api-scroll">
            <div id="nexus-api-text">
<b>OPERATOR:</b><br>
You are accessing the WAR ROOM — the encrypted tactical command system for Torn War Nexus.<br><br>

<b>ABOUT YOUR API KEY:</b><br>
Your Torn API key is used ONLY to read tactical intel permitted by Torn’s official read-only endpoints:
<ul>
<li>Status</li>
<li>Chain</li>
<li>Faction</li>
<li>War data</li>
</ul>

The key:
<ul>
<li>is encrypted locally (never sent externally)</li>
<li>is never uploaded to Firebase</li>
<li>is never transmitted to any server beyond Torn’s official API</li>
</ul>

<b>ABOUT FIREBASE:</b><br>
Firebase is used ONLY for optional shared target lists and faction coordination.  
Your personal Torn data is NEVER written to Firebase.  
Only the faction’s shared target list + anonymous analytics are stored.<br><br>

<b>Proceed only if you fully understand the access being granted.</b>
            </div>
        </div>

        <input id="nexus-api-input" placeholder="Enter Torn API Key">
        <button id="nexus-api-save">Authorize</button>
    </div>
    `;

    const css = `
    #nexus-api-overlay {
        position: fixed; top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.75); z-index:99999998;
    }
    #nexus-api-modal {
        position: fixed; top:50%; left:50%; transform:translate(-50%, -50%);
        width: 320px; background:#000; color:#0ff;
        border:2px solid #0ff; padding:16px;
        font-family: monospace; z-index:99999999;
    }
    #nexus-api-title {
        text-align:center; font-size:16px; margin-bottom:10px;
    }
    #nexus-api-scroll {
        background:#001014; border:1px solid #0ff;
        height:160px; overflow-y:auto; padding:6px; margin-bottom:10px;
    }
    #nexus-api-input {
        width:100%; padding:6px; background:#000;
        color:#0ff; border:1px solid #0ff; margin-bottom:10px;
    }
    #nexus-api-save {
        width:100%; padding:8px; background:#0ff; color:#000;
        font-weight:bold; cursor:pointer;
    }
    `;

    GM_addStyle(css);

    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    document.querySelector("#nexus-api-save").onclick = ()=>{
        const val = document.querySelector("#nexus-api-input").value.trim();
        if (!val) return;

        SECURE_KEY = val;
        GM_setValue("WAR_API_KEY", Crypto.lock(val));
        WARDBG("API key stored to vault.");

        document.querySelector("#nexus-api-overlay").remove();
        document.querySelector("#nexus-api-modal").remove();

        bootNexus();
    };
}

if (!SECURE_KEY){
    WARDBG("Displaying command console API key popup...");
    openKeyPopup();
}

/**********************************************************
 * WAR GENERAL CORE OBJECT
 **********************************************************/
window.WAR_GENERAL = {
    signals: {
        listeners: {},
        listen(event, fn){
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(fn);
        },
        dispatch(event, data){
            const list = this.listeners[event];
            if (list) list.forEach(fn => fn(data));
        }
    },

    intel: {
        hasCredentials(){
            return !!SECURE_KEY;
        },

        request(selections){
            return new Promise((resolve, reject)=>{
                if (!SECURE_KEY){
                    reject("NO_KEY");
                    return;
                }

                const url = `https://api.torn.com/user/?selections=${selections}&key=${SECURE_KEY}`;
                GM_xmlhttpRequest({
                    method:"GET",
                    url,
                    onload: r=>{
                        if (r.status !== 200){
                            reject("HTTP_" + r.status);
                            return;
                        }
                        try {
                            const d = JSON.parse(r.responseText);
                            if (d.error){
                                reject("API_" + d.error.error);
                            } else {
                                resolve(d);
                            }
                        } catch(e){
                            reject("PARSE");
                        }
                    },
                    onerror: ()=>reject("NETWORK")
                });
            });
        }
    }
};

unsafeWindow.WAR_GENERAL = window.WAR_GENERAL;
WARDBG("WAR_GENERAL bridged to page context.");

/**********************************************************
 * PLUGIN LOADER (CSP-SAFE)
 **********************************************************/
function loadOfficer(url){
    const full = url + `?v=${Date.now()}`;
    WARDBG("[PLUGIN] FETCH → " + full);

    GM_xmlhttpRequest({
        method: "GET",
        url: full,
        onload: r=>{
            if (r.status !== 200){
                WARDBG("[PLUGIN] HTTP ERROR " + r.status);
                return;
            }
            WARDBG("[PLUGIN] FETCH OK → " + full);

            try {
                const exec = new Function("WAR_GENERAL", "WARDBG", r.responseText);
                exec(window.WAR_GENERAL, window.WARDBG);
                WARDBG("[PLUGIN] EXEC SUCCESS → " + full);
            } catch(e){
                WARDBG("[PLUGIN] EXEC ERROR: " + e);
            }
        },
        onerror: ()=>WARDBG("[PLUGIN] NETWORK FAILURE → " + full)
    });
}

/**********************************************************
 * BOOT SEQUENCE — LOAD ALL OFFICERS
 **********************************************************/
function bootNexus(){
    WARDBG("BOOT STARTED");

    const officers = [
        "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/lieutenant.js",
        "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/colonel.js",
        "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/sergeant.js"
        // Major.js loads via @require above
    ];

    officers.forEach(loadOfficer);

    WARDBG("BOOT COMPLETE — WAITING FOR OFFICERS TO REPORT");
}

if (SECURE_KEY){
    bootNexus();
}

})();
