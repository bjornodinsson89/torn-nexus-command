// ==UserScript==
// @name         WAR_GENERAL_NEXUS
// @version      1.1
// @description  Torn War helper
// @author       BjornOdinsson89
// @match        https://www.torn.com/*
// @match        https://www.torn.com/loader.php*
// @match        https://www.torn.com/page.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    let _secureKey = null;
    const _roster = {};
    const _events = {};
    const Crypto = {
        lock: t => btoa(t.split('').reverse().join('')),
        unlock: t => atob(t).split('').reverse().join('')
    };

    const stored = GM_getValue("WAR_API_KEY");
    if (stored) _secureKey = Crypto.unlock(stored);

    function performSecureFetch(selection) {
        return new Promise((resolve, reject) => {
            if (!_secureKey) return reject("NO_KEY");
            const url = `https://api.torn.com/user/?selections=${selection}&key=${_secureKey}`;
            GM_xmlhttpRequest({
                method: "GET",
                url,
                onload: r => {
                    if (r.status !== 200) return reject("HTTP");
                    try {
                        const d = JSON.parse(r.responseText);
                        if (d.error) reject("API_ERR");
                        else resolve(d);
                    } catch(e) { reject("PARSE"); }
                },
                onerror: () => reject("NET")
            });
        });
    }

    function loadPlugin(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url,
            onload: r => {
                try {
                    const s = document.createElement("script");
                    s.textContent = r.responseText;
                    document.documentElement.appendChild(s);
                    s.remove();
                    resolve();
                } catch(e) {
                    reject(e);
                }
            },
            onerror: reject
        });
    });
}
    
    window.WAR_GENERAL = {
        register(name, module) {
            _roster[name] = module;
            if (module.init) module.init(this);
        },
        loadPlugin,
        signals: {
            listen(ev, fn) {
                if (!_events[ev]) _events[ev] = [];
                _events[ev].push(fn);
                return () => _events[ev] = _events[ev].filter(f => f !== fn);
            },
            dispatch(ev, data) {
                if (_events[ev]) _events[ev].forEach(f => f(data));
            }
        },
        intel: {
            request(selectionString) {
                return performSecureFetch(selectionString);
            },
            setCredentials(rawKey) {
                _secureKey = rawKey;
                GM_setValue("WAR_API_KEY", Crypto.lock(rawKey));
            },
            hasCredentials() {
                return !!_secureKey;
            }
        }
    };

    function deployPlugins() {
        const PLUGIN_URLS = [
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/lieutenant.js",
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/colonel.js",
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/sergeant.js",
            "https://raw.githubusercontent.com/Bjornodinsson89/torn-nexus-command/main/officers/major.js"
        ];
        PLUGIN_URLS.forEach(u => WAR_GENERAL.loadPlugin(u));
    }

    const popupHtml = `
        <div id="nexus-api-overlay"></div>
        <div id="nexus-api-modal">
            <div id="nexus-api-title">WAR ROOM // AUTHORIZATION</div>
            <div id="nexus-scrollbox">
                <div id="nexus-scrolltext">
                    <b>OPERATOR:</b><br>
                    You stand before the encrypted gate of the WAR ROOM — a classified command center operating beyond Torn’s standard battlefield interfaces.<br><br>
                    <b>THE TORN API:</b><br>
                    By entering your Torn API key, you authorize the General to retrieve tactical intelligence directly from HQ. This key grants <u>read-only</u> access to your status, faction data, chain metrics, and war conditions.<br><br>
                    <b>FIREBASE DATABASE:</b><br>
                    The Sergeant communicates with Firebase for faction coordination. Your API key is never sent to Firebase.<br><br>
                    Proceed and unlock the War Room.
                </div>
            </div>
            <input id="nexus-api-input" placeholder="Enter Torn API Key">
            <button id="nexus-api-save">Authorize</button>
        </div>
    `;

    const popupStyle = `
        #nexus-api-overlay {
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.75); backdrop-filter:blur(4px);
            z-index: 99999997; display:none;
        }
        #nexus-api-modal {
            position: fixed; top:50%; left:50%; transform:translate(-50%, -50%);
            width: 315px; padding:18px; background:#050505;
            border:2px solid #00f3ff; border-right: 2px solid #00f3ff;
            box-shadow:0 0 25px rgba(0,243,255,0.4);
            z-index:99999998; display:none; color:#00f3ff;
            font-family: 'Courier New', monospace;
        }
        #nexus-scrollbox {
            width:100%; height:160px; overflow-y:auto; padding:8px;
            background:#000; border:1px solid #00f3ff; margin-bottom:12px;
        }
        #nexus-api-input {
            width:100%; padding:7px; background:#000;
            border:1px solid #00f3ff; color:#00f3ff; margin-bottom:10px;
        }
        #nexus-api-save {
            width:100%; padding:9px; background:#00f3ff; color:#000;
            font-weight:bold; cursor:pointer; border:none;
        }
`;
    GM_addStyle(popupStyle);

    function openPopup() {
        const wrap = document.createElement("div");
        wrap.innerHTML = popupHtml;
        document.body.appendChild(wrap);
        document.getElementById("nexus-api-overlay").style.display = "block";
        document.getElementById("nexus-api-modal").style.display = "block";
        document.getElementById("nexus-api-save").onclick = () => {
            const val = document.getElementById("nexus-api-input").value.trim();
            if (val) {
                WAR_GENERAL.intel.setCredentials(val);
                document.getElementById("nexus-api-overlay").remove();
                document.getElementById("nexus-api-modal").remove();
                deployPlugins();
            }
        };
    }

    if (!_secureKey) openPopup();
    else deployPlugins();

})();
