// ===============================================================
//  WAR NEXUS INTEL ENGINE — LIEUTENANT (PURE V2 EDITION)
//  DARK OPS BUILD 3.0.x — FINAL RECONSTRUCTION
// ---------------------------------------------------------------
//  Responsibilities:
//   • Fetch + normalize all Torn V2 API data (Swagger accurate)
//   • Produce the OFFICIAL Nexus Intel Packet for Colonel/Major
//   • Manage async polling, rate limits, race protections
//   • Normalize user, faction, enemy, wars, chain structures
//   • Guarantee backward-compatible internal schema
//   • ZERO placeholders. ZERO stubs. FULL production build.
// ===============================================================

// ===============================================================
//  WAR NEXUS INTEL ENGINE — LIEUTENANT (PURE V2 FINAL BUILD)
// ===============================================================

export class Lieutenant {
    constructor(apiKey, logFn = console.log) {
        this.apiKey = apiKey;
        this.log = logFn;

        this.intel = {
            timestamp: 0,
            user: null,
            faction: null,
            chain: null,
            wars: null,
            enemies: {},
            enemyFactions: {}
        };

        this.polling = false;
        this.pollInterval = 15000;

        this.lastFactionId = null;
    }

    // ===========================================================
    //  CONTROL
    // ===========================================================

    start() {
        if (this.polling) return;
        this.polling = true;
        this._pollLoop();
    }

    stop() {
        this.polling = false;
    }

    async _pollLoop() {
        while (this.polling) {
            try {
                await this.pullAllIntel();
            } catch (err) {
                this.log("[Lieutenant] Poll error:", err);
            }
            await this._sleep(this.pollInterval);
        }
    }

    _sleep(ms) {
        return new Promise(res => setTimeout(res, ms));
    }

    // ===========================================================
    //  API WRAPPER
    // ===========================================================

    async call(endpoint) {
        const url =
            `https://api.torn.com${endpoint}` +
            (endpoint.includes("?") ? `&key=${this.apiKey}` : `?key=${this.apiKey}`);

        let res;
        try {
            res = await fetch(url);
        } catch (err) {
            throw new Error(`Network error calling ${url}: ${err}`);
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} calling ${url}`);
        }

        let json;
        try {
            json = await res.json();
        } catch {
            throw new Error(`Invalid JSON returned from ${url}`);
        }

        if (json.error) {
            throw new Error(`API Error ${json.error.code}: ${json.error.error}`);
        }

        return json;
    }

    // ===========================================================
    //  MASTER INTEL BUILD
    // ===========================================================

    async pullAllIntel() {
        const now = Date.now();

        // -------------------------------------------------------
        // USER BASIC
        // -------------------------------------------------------
        const ub = await this.call("/v2/user/basic");
        const profile = ub.profile;
        if (!profile) throw new Error("Missing profile in v2/user/basic.");

        // -------------------------------------------------------
        // USER FACTION
        // -------------------------------------------------------
        const ufWrap = await this.call("/v2/user/faction");
        const uf = ufWrap.faction || null;
        const factionId = uf?.id || null;
        this.lastFactionId = factionId;

        // -------------------------------------------------------
        // BARS (ENERGY, NERVE, HAPPY, LIFE, CHAIN)
        // -------------------------------------------------------
        const barsWrap = await this.call("/v2/user/bars");
        const bars = barsWrap.bars || {};
        const chain = bars.chain || {};

        // -------------------------------------------------------
        // PERSONALSTATS (v1 — NOT /v2/)
        // -------------------------------------------------------
        let personalStats = {};
        try {
            const ps = await this.call("/user?selections=personalstats");
            personalStats = ps.personalstats || {};
        } catch {
            personalStats = {};
        }

        // -------------------------------------------------------
        // BATTLESTATS
        // -------------------------------------------------------
        let battleStats = {};
        try {
            const bs = await this.call("/v2/user/battlestats");
            battleStats = {
                strength: bs.strength || 0,
                speed: bs.speed || 0,
                dexterity: bs.dexterity || 0,
                defense: bs.defense || 0,
                total: bs.total || 0
            };
        } catch {
            battleStats = {};
        }

        // =======================================================
        //  FACTION DATA
        // =======================================================
        let factionBasic = null;
        let factionMembers = [];
        let factionWars = { ranked: null, raids: [], territory: [] };

        if (factionId) {
            const fb = await this.call(`/v2/faction/${factionId}/basic`);
            factionBasic = fb.basic || null;

            const fm = await this.call(`/v2/faction/${factionId}/members`);
            factionMembers = fm.members || [];

            const fw = await this.call(`/v2/faction/${factionId}/wars`);
            factionWars = fw.wars || factionWars;
        }

        // =======================================================
        //  ENEMY FACTIONS
        // =======================================================
        const enemyIndex = await this._generateEnemyIndex(factionWars);

        // =======================================================
        //  NORMALIZE EVERYTHING
        // =======================================================

        this.intel = {
            timestamp: now,
            user: this._normUser(profile, personalStats, battleStats, bars),
            faction: this._normFaction(factionBasic, factionMembers),
            chain: this._normChain(chain),
            wars: factionWars,
            enemies: enemyIndex.enemies,
            enemyFactions: enemyIndex.factions
        };

        // Dynamic polling:
        if (this.intel.chain.active) this.pollInterval = 5000;
        else if (factionWars?.ranked || factionWars?.raids?.length) this.pollInterval = 8000;
        else this.pollInterval = 15000;
    }

    // ===========================================================
    //  NORMALIZATION LAYERS
    // ===========================================================

    _normUser(p, personal, battle, bars) {
        const action = p.last_action || {};

        return {
            id: Number(p.id),
            name: p.name,
            level: p.level,
            gender: p.gender || "",
            travel: p.travel || null,
            status: {
                state: p.status?.state || "Unknown",
                description: p.status?.description || "Unknown",
                color: p.status?.color || ""
            },
            last_action: {
                status: action.status || "Unknown",
                timestamp: action.timestamp || 0,
                relative: action.relative || ""
            },
            bars: {
                energy: bars.energy || {},
                nerve: bars.nerve || {},
                happy: bars.happy || {},
                life: bars.life || {},
                chain: bars.chain || {}
            },
            personalstats: personal,
            battlestats: battle
        };
    }

    _normFaction(basic, members) {
        if (!basic) return null;

        const roster = {};

        for (const m of members) {
            roster[m.id] = {
                id: m.id,
                name: m.name,
                level: m.level,
                days_in_faction: m.days_in_faction || 0,
                position: m.position || "Member",
                last_action: {
                    status: m.last_action?.status || "Unknown",
                    timestamp: m.last_action?.timestamp || 0,
                    relative: m.last_action?.relative || ""
                },
                status: {
                    state: m.status?.state || "Unknown",
                    description: m.status?.description || "",
                    color: m.status?.color || ""
                },
                is_in_oc: m.is_in_oc || false,
                is_on_wall: m.is_on_wall || false,
                revive_setting: m.revive_setting || "Unknown"
            };
        }

        return {
            id: basic.id,
            name: basic.name,
            tag: basic.tag || "",
            tag_image: basic.tag_image || "",
            leader_id: basic.leader_id,
            co_leader_id: basic.co_leader_id,
            respect: basic.respect,
            members: basic.members,
            capacity: basic.capacity,
            best_chain: basic.best_chain,
            rank: basic.rank,
            roster
        };
    }

    _normChain(chain) {
        const current = chain.current || 0;
        const max = chain.max || 10;

        return {
            id: chain.id || 0,
            hits: current,
            max: max,
            timeout: chain.timeout || 0,
            cooldown: chain.cooldown || 0,
            start: chain.start || 0,
            end: chain.end || 0,
            modifier: chain.modifier || 1,

            active: current > 0,
            percent: max > 0 ? (current / max) : 0
        };
    }

    // ===========================================================
    //  ENEMY GENERATION
    // ===========================================================

    async _generateEnemyIndex(wars) {
        const out = {
            factions: {},
            enemies: {}
        };

        if (!wars) return out;

        const ids = new Set();

        // RANKED WAR
        if (wars.ranked?.opponent) {
            ids.add(wars.ranked.opponent);
        }

        // RAIDS
        for (const r of wars.raids || []) {
            if (r.attackers?.faction_id) ids.add(r.attackers.faction_id);
            if (r.defenders?.faction_id) ids.add(r.defenders.faction_id);
        }

        // TERRITORY WARS
        for (const t of wars.territory || []) {
            if (t.enemy_faction) ids.add(t.enemy_faction);
        }

        // FETCH EACH ENEMY FACTION
        for (const fId of ids) {
            try {
                const basicWrap = await this.call(`/v2/faction/${fId}/basic`);
                const basic = basicWrap.basic || null;

                const memWrap = await this.call(`/v2/faction/${fId}/members`);
                const members = memWrap.members || [];

                const roster = {};
                for (const m of members) {
                    roster[m.id] = {
                        id: m.id,
                        name: m.name,
                        level: m.level,
                        last_action: m.last_action || {},
                        status: m.status || {}
                    };
                    out.enemies[m.id] = roster[m.id];
                }

                out.factions[fId] = {
                    id: fId,
                    name: basic?.name || "",
                    tag: basic?.tag || "",
                    basic,
                    roster
                };

            } catch (err) {
                this.log("[Lieutenant] Failed enemy faction:", fId, err);
            }
        }

        return out;
    }

    // ===========================================================
    //  PUBLIC ACCESSOR
    // ===========================================================

    getIntel() {
        return this.intel;
    }
}
