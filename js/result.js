//기본
const ResultEngine = (function() {
    const _storage = {
        load: (key) => {
            const data = localStorage.getItem(key);
            try { return data ? JSON.parse(data) : null; } catch(e) { return null; }
        },
        save: (key, val) => localStorage.setItem(key, JSON.stringify(val))
    };

    const DB = {
        BASE_STATS: {
            "체": { "9.0": [1412,176,176], "8.0": [1332,176,176], "7.0": [1252,176,176] },
            "공": { "9.0": [876,325,161], "8.0": [876,305,161], "7.0": [876,285,161] },
            "방": { "9.0": [788,185,323], "8.0": [788,185,303], "7.0": [788,185,283] },
            "체공": { "9.0": [1160,282,133], "8.0": [1120,272,133], "7.0": [1080,262,133] },
            "체방": { "9.0": [1160,133,282], "8.0": [1120,133,272], "7.0": [1080,133,262] },
            "공방": { "9.0": [720,262,263], "8.0": [720,252,253], "7.0": [720,242,243] }
        },
        COLLECTION: [240, 60, 60],
        SPIRIT_PLUS: [54, 60, 66, 120],
        SPIRIT_PERCENT: [24, 28, 32, 40],
        GEM_LEVEL_STATS: {
            36: { "체": 144, "공": 36, "방": 36 },
            38: { "체": 152, "공": 38, "방": 38 },
            40: { "체": 160, "공": 40, "방": 40 },
            42: { "체": 168, "공": 42, "방": 42 },
            44: { "체": 176, "공": 44, "방": 44 }
        },
        ACCESSORY_STATS_DB: {
            "황보": { 18: [0,18,0], 19: [0,19,0], 20: [0,20,0] },
            "여보": { 18: [0,0,18], 19: [0,0,19], 20: [0,0,20] },
            "악보": { 18: [18,0,0], 19: [19,0,0], 20: [20,0,0] },
            "물뿔(체/공)": { 18: [12,6,0], 19: [13,6,0], 20: [14,6,0] },
            "물뿔(체/방)": { 18: [12,0,6], 19: [13,0,6], 20: [14,0,6] },
            "불뿔(공/체)": { 18: [6,12,0], 19: [6,13,0], 20: [6,14,0] },
            "불뿔(공/방)": { 18: [0,12,6], 19: [0,13,6], 20: [0,14,6] },
            "대뿔(방/체)": { 18: [6,0,12], 19: [6,0,13], 20: [6,0,14] },
            "대뿔(방/공)": { 18: [0,6,12], 19: [0,6,13], 20: [0,6,14] },
            "바뿔(공/체)": { 18: [9,9,0],  19: [9,10,0],  20: [10,10,0] },
            "바뿔(공/방)": { 18: [0,9,9],  19: [0,10,9],  20: [0,10,10] },
            "바뿔(체/방)": { 18: [9,0,9],  19: [10,0,9],  20: [10,0,10] }
        }
    };

    const _trunc = (val) => Math.trunc(val);

    function _calcSpiritStats(stats, types, bonus) {
        let plus = [0, 0, 0], percent = [0, 0, 0];
        const idxMap = { "체": 0, "공": 1, "방": 2 };
        if(!stats || !types) return { plus, percent, bonus };
        for (let i = 0; i < 4; i++) {
            const s = stats[i], t = types[i];
            if (!idxMap.hasOwnProperty(s)) continue;
            const idx = idxMap[s];
            if (t === "+") {
                let val = DB.SPIRIT_PLUS[i];
                if (s === "체") val *= 4;
                plus[idx] += val;
            } else {
                percent[idx] += DB.SPIRIT_PERCENT[i];
            }
        }
        return { plus, percent, bonus };
    }

    function _calcGemFast(needed, type, gemPool) {
        let total = 0, remain = needed;
        for (let lvl = 44; lvl >= 36; lvl -= 2) {
            if (remain <= 0) break;
            const take = Math.min(remain, gemPool[lvl][type]);
            if (take > 0) { total += take * DB.GEM_LEVEL_STATS[lvl][type]; remain -= take; }
        }
        return total;
    }

    // vval만 반환하는 고속 탐색
    function _findBestVval(dragon, gemPool, accs, pens, multipliers) {
        const base = DB.BASE_STATS[dragon.type]?.[dragon.dStat];
        if (!base) return 0;
        const spirit = _calcSpiritStats(dragon.spiritStats, dragon.spiritTypes, dragon.bonus);
        const b0 = base[0], b1 = base[1], b2 = base[2];
        const sp0 = spirit.plus[0], sp1 = spirit.plus[1], sp2 = spirit.plus[2];
        const sr0 = spirit.percent[0], sr1 = spirit.percent[1], sr2 = spirit.percent[2];
        const bh = spirit.bonus==="체" ? 40 : 0, ba = spirit.bonus==="공" ? 10 : 0, bd = spirit.bonus==="방" ? 10 : 0;
        const mh = multipliers[0], ma = multipliers[1], md = multipliers[2];
        const buffH = Math.trunc(b0*Math.round(mh*100)/100), buffA = Math.trunc(b1*Math.round(ma*100)/100), buffD = Math.trunc(b2*Math.round(md*100)/100);

        // 젬 합계 사전 계산 (0~5개별) + 물약
        const gemH = [], gemA = [], gemD = [];
        for (let n = 0; n <= 5; n++) {
            gemH[n] = _calcGemFast(n,"체",gemPool) + 24;
            gemA[n] = _calcGemFast(n,"공",gemPool) + 6;
            gemD[n] = _calcGemFast(n,"방",gemPool) + 6;
        }

        // 팬던트 옵션 사전 파싱
        const penParsed = new Array(pens.length);
        const statIdx = { "체": 0, "공": 1, "방": 2 };
        for (let pi = 0; pi < pens.length; pi++) {
            const pen = pens[pi];
            const p = [0,0,0];
            const o1 = statIdx[pen.opt1]; if(o1!==undefined) p[o1] += parseInt(pen.stat1)||0;
            const o2 = statIdx[pen.opt2]; if(o2!==undefined) p[o2] += parseInt(pen.stat2)||0;
            if(pen.type==="태양") { const o3 = statIdx[pen.opt3]; if(o3!==undefined) p[o3] += parseInt(pen.stat3)||0; }
            penParsed[pi] = p;
        }

        let bestVval = 0;
        for (let ai = 0; ai < accs.length; ai++) {
            const acc = accs[ai];
            const accBase = DB.ACCESSORY_STATS_DB[acc.item]?.[acc.value];
            if (!accBase) continue;
            const eOpts = acc.enchant === "all" ? [0,1,2] : [statIdx[acc.enchant] !== undefined ? statIdx[acc.enchant] : -1];
            for (let ei = 0; ei < eOpts.length; ei++) {
                const eIdx = eOpts[ei];
                const rH = accBase[0] + (eIdx===0?21:0);
                const rA = accBase[1] + (eIdx===1?21:0);
                const rD = accBase[2] + (eIdx===2?21:0);
                for (let pi = 0; pi < penParsed.length; pi++) {
                    const pp = penParsed[pi];
                    const pp0 = pp[0], pp1 = pp[1], pp2 = pp[2];
                    for (let h = 0; h <= 5; h++) {
                        const ghv = gemH[h];
                        for (let a = 0; a <= 5-h; a++) {
                            const d = 5-h-a;
                            let hp = b0 + ghv, atk = b1 + gemA[a], def = b2 + gemD[d];
                            hp += Math.floor(hp * rH / 100);
                            atk += Math.floor(atk * rA / 100);
                            def += Math.floor(def * rD / 100);
                            hp += sp0; atk += sp1; def += sp2;
                            hp += Math.floor(hp * sr0 / 100); atk += Math.floor(atk * sr1 / 100); def += Math.floor(def * sr2 / 100);
                            hp += bh; atk += ba; def += bd;
                            hp += Math.floor(hp * pp0 / 100); atk += Math.floor(atk * pp1 / 100); def += Math.floor(def * pp2 / 100);
                            hp += 240 + buffH; atk += 60 + buffA; def += 60 + buffD;
                            const v = hp * atk * def;
                            if (v > bestVval) bestVval = v;
                        }
                    }
                }
            }
        }
        return bestVval;
    }

    // 젬 단계가 정해진 세팅의 상세 계산 (ExactOptimizer.statVal 과 같은 정수 수식)
    function _computeDetailedFromLevels(base, gemLv, spirit, ctx) {
        const keys = ["h", "a", "d"], kr = ["체", "공", "방"], POT = [24, 6, 6], COLL = DB.COLLECTION;
        const bonusAdd = [spirit.bonus === "체" ? 40 : 0, spirit.bonus === "공" ? 10 : 0, spirit.bonus === "방" ? 10 : 0];
        const out = [0, 0, 0], gemAdd = [0, 0, 0], buffAdd = [0, 0, 0];
        for (let s = 0; s < 3; s++) {
            const levels = (gemLv[keys[s]] || []).slice().sort((x, y) => y - x);
            gemAdd[s] = levels.reduce((t, lv) => t + DB.GEM_LEVEL_STATS[lv][kr[s]], 0) + POT[s];
            let x = base[s] + gemAdd[s];
            x += Math.floor(x * ctx.accPct[s] / 100);
            x += spirit.plus[s];
            x += Math.floor(x * spirit.percent[s] / 100);
            x += bonusAdd[s];
            x += Math.floor(x * ctx.pendant[s] / 100);
            buffAdd[s] = Math.trunc(base[s] * Math.round(ctx.multipliers[s] * 100) / 100);
            out[s] = x + COLL[s] + buffAdd[s];
        }
        const log = [
            `[1] 기본 스탯: 체(${base[0]}) 공(${base[1]}) 방(${base[2]})`,
            `[2] 젬/물약 추가: +체${gemAdd[0]} +공${gemAdd[1]} +방${gemAdd[2]}`,
            `[3] 장비/인챈%: 체${ctx.accPct[0]}% 공${ctx.accPct[1]}% 방${ctx.accPct[2]}%`,
            `[4] 정령(+): +체${spirit.plus[0]} +공${spirit.plus[1]} +방${spirit.plus[2]}`,
            `[5] 정령(%): 체${spirit.percent[0]}% 공${spirit.percent[1]}% 방${spirit.percent[2]}%`,
            `[6] 정령 부가: +체${bonusAdd[0]} +공${bonusAdd[1]} +방${bonusAdd[2]}`,
            `[7] 팬던트%: 체${ctx.pendant[0]}% 공${ctx.pendant[1]}% 방${ctx.pendant[2]}%`,
            `[8] 컬렉션/버프: +체${COLL[0] + buffAdd[0]} +공${COLL[1] + buffAdd[1]} +방${COLL[2] + buffAdd[2]}`
        ];
        const sortDesc = a => (a || []).slice().sort((x, y) => y - x);
        return { hp: out[0], atk: out[1], def: out[2], vval: out[0] * out[1] * out[2], fullLog: log,
                 gemLevels: { h: sortDesc(gemLv.h), a: sortDesc(gemLv.a), d: sortDesc(gemLv.d) } };
    }


    return {
run: function() {
        const allDragonData = _storage.load("guild_dragon_data") || [];
        const gear = _storage.load("guild_gear_data") || {};
        const getV = (id) => document.getElementById(id).value;
        const attrMap = { "earth": "땅", "water": "물", "fire": "불", "wind": "바람", "light": "빛", "dark": "어둠", "dawn": "여명", "dusk": "황혼", "nightmare": "악몽" };
        const krToAttrKey = { "땅": "earth", "물": "water", "불": "fire", "바람": "wind", "빛": "light", "어둠": "dark", "여명": "dawn", "황혼": "dusk", "악몽": "nightmare" };

        const config = {
            b1: getV("buff-attr"), b2: getV("buff-stat1"), b3: getV("buff-type"), b4: getV("buff-stat2"),
            d1: getV("debuff-attr"), d2: getV("debuff-stat1"), d3: getV("debuff-type"), d4: getV("debuff-stat2")
        };

        const maxReserve = parseInt(getV("reserve-count")) || 0;
        const maxResource = getV("max-resource"); // "off" | "preview" | "result" | "all"

        const pool = {};
        [36, 38, 40, 42, 44].forEach((lvl, idx) => {
            const g = gear.gems?.[idx] || { 체: 0, 공: 0, 방: 0 };
            pool[lvl] = { 체: parseInt(g.체)||0, 공: parseInt(g.공)||0, 방: parseInt(g.방)||0 };
        });

        const realAccs = (gear.accessories || []).filter(a => a.item !== "장신구").map((a, i) => ({ ...a, uid: `acc_${i}` }));
        const realPens = (gear.pendants || []).filter(p => p.type !== "선택" && p.type !== "off").map((p, i) => ({ ...p, uid: `pen_${i}` }));

        const virtualAccs = ["황보", "여보", "악보", "물뿔(체/공)", "물뿔(체/방)", "불뿔(공/체)", "불뿔(공/방)", "대뿔(방/체)", "대뿔(방/공)", "바뿔(공/체)", "바뿔(공/방)", "바뿔(체/방)"]
            .map((name, i) => ({ item: name, value: 19, enchant: "all", uid: `v_acc_${i}` }));

        const vAllPens = [
            { type: "태양", opt1: "체", stat1: 6, opt2: "공", stat2: 6, opt3: "방", stat3: 6 },
            { type: "태양", opt1: "체", stat1: 12, opt2: "공", stat2: 6, opt3: "방", stat3: 0 },
            { type: "태양", opt1: "체", stat1: 12, opt2: "방", stat2: 6, opt3: "공", stat3: 0 },
            { type: "태양", opt1: "공", stat1: 12, opt2: "체", stat2: 6, opt3: "방", stat3: 0 },
            { type: "태양", opt1: "공", stat1: 12, opt2: "방", stat2: 6, opt3: "체", stat3: 0 },
            { type: "태양", opt1: "방", stat1: 12, opt2: "체", stat2: 6, opt3: "공", stat3: 0 },
            { type: "태양", opt1: "방", stat1: 12, opt2: "공", stat2: 6, opt3: "체", stat3: 0 },
            { type: "달", opt1: "체", stat1: 12, opt2: "공", stat2: 0 },
            { type: "달", opt1: "공", stat1: 12, opt2: "체", stat2: 0 },
            { type: "달", opt1: "방", stat1: 12, opt2: "체", stat2: 0 },
            { type: "달", opt1: "체", stat1: 6, opt2: "공", stat2: 6 },
            { type: "달", opt1: "체", stat1: 6, opt2: "방", stat2: 6 },
            { type: "달", opt1: "공", stat1: 6, opt2: "방", stat2: 6 }
        ].map((p, i) => ({ ...p, uid: `v_pen_${i}` }));

        const statIdx = { "체": 0, "공": 1, "방": 2 };
        const infinitePool = { 36: {체:99,공:99,방:99}, 38: {체:99,공:99,방:99}, 40: {체:99,공:99,방:99}, 42: {체:99,공:99,방:99}, 44: {체:99,공:99,방:99} };

        // 최대 자원 모드별 자원셋 (자원 종류별 선택)
        const maxResType = getV("max-resource-type"); // "all"|"pen"|"acc"|"gem"|"pen+acc"|"pen+gem"|"acc+gem"
        const maxPen = maxResType.includes("pen") || maxResType === "all";
        const maxAcc = maxResType.includes("acc") || maxResType === "all";
        const maxGem = maxResType.includes("gem") || maxResType === "all";

        const useMaxResult = (maxResource === "result" || maxResource === "all");
        const useMaxPreview = (maxResource === "preview" || maxResource === "all");

        const resPool = (useMaxResult && maxGem) ? infinitePool : pool;
        const resAccs = (useMaxResult && maxAcc) ? virtualAccs : realAccs;
        const resPens = (useMaxResult && maxPen) ? vAllPens : realPens;
        const prevPool = (useMaxPreview && maxGem) ? infinitePool : pool;
        const prevAccs = (useMaxPreview && maxAcc) ? virtualAccs : realAccs;
        const prevPens = (useMaxPreview && maxPen) ? vAllPens : realPens;

        // ===== 일반 용 / 예비 정령 분리 =====
        const spiritUnlock = getV("spirit-unlock"); // "off" | "attrFixed" | "typeFixed" | "all"
        // 체크박스(disabled)는 모드와 관계없이 항상 우선 적용 — 체크되어 있으면 무조건 계산 제외
        const rawRegular = allDragonData.filter(d => d.attrKey !== "reserve" && d.name && d.type !== "타입" && !d.disabled);
        const reserveRaw = allDragonData.filter(d => d.attrKey === "reserve" && d.type !== "타입" && !d.disabled);
        
        // 예비 정령 자동 이름 부여
        let rIdx = 1;
        reserveRaw.forEach(d => {
            if (!d.name || d.name.trim() === "") { d.name = `예비 정령${rIdx}`; }
            rIdx++;
        });
        const reserveDragons = reserveRaw.filter(d => d.name);

        // 예비 정령 속성 = 버프 속성
        const buffAttrKey = krToAttrKey[config.b1] || null;

        // 전체 정령 해제: 속성별 넘버링
        const attrKeyToKr = attrMap;
        let regularDragons;
        if (spiritUnlock !== "off") {
            // 속성별 카운터
            const attrCounters = {};
            regularDragons = rawRegular.map(d => {
                const krAttr = attrKeyToKr[d.attrKey] || d.attrKey;
                attrCounters[krAttr] = (attrCounters[krAttr] || 0) + 1;
                const newName = `${krAttr}${attrCounters[krAttr]}`;
                if (spiritUnlock === "all") {
                    return { ...d, name: newName, type: "전체", _origAttr: krAttr };
                } else {
                    return { ...d, name: newName, _origAttr: krAttr };
                }
            });
        } else {
            regularDragons = rawRegular;
        }

        // dragons 배열: 일반 + 예비(타입 확정된) — 버프 참고(미리보기)에서 사용
        const dragons = [...regularDragons];


        // 멀티플라이어 계산 헬퍼
        function _calcMult(dragonAttrKr, dragonType) {
            let mult = [0, 0, 0];
            if (dragonAttrKr === config.b1 && statIdx[config.b2] !== undefined) mult[statIdx[config.b2]] += 0.2;
            if (dragonType === config.b3 && statIdx[config.b4] !== undefined) mult[statIdx[config.b4]] += 0.2;
            if (dragonAttrKr === config.d1 && statIdx[config.d2] !== undefined) mult[statIdx[config.d2]] -= 0.2;
            if (dragonType === config.d3 && statIdx[config.d4] !== undefined) mult[statIdx[config.d4]] -= 0.2;
            return mult;
        }

        // 예비/해제 버프 모드별 타입 후보군
        const reserveBuffMode = getV("reserve-buff-mode"); // "2buff"|"1buff"|"both"
        const STAT_TYPE_MAP = {
            "체": ["체","체공","체방"],
            "공": ["공","체공","공방"],
            "방": ["방","체방","공방"]
        };

        function _getTypesToTry() {
            const allTypes = ["체","공","방","체공","체방","공방"];
            // 2벞: 타입버프에 매칭되는 타입만 (없으면 전체)
            const types2 = (config.b3 && config.b3 !== "선택" && allTypes.includes(config.b3)) ? [config.b3] : allTypes;
            // 1벞: 속성버프 스탯에 맞는 타입 - 너프 타입 제외
            let types1 = allTypes;
            if (config.b2 && STAT_TYPE_MAP[config.b2]) {
                types1 = STAT_TYPE_MAP[config.b2].filter(t => t !== config.d3);
                if (types1.length === 0) types1 = STAT_TYPE_MAP[config.b2]; // 전부 너프에 걸리면 그냥 포함
            }

            if (reserveBuffMode === "2buff") return types2;
            if (reserveBuffMode === "1buff") return types1;
            // "both": 합집합
            const set = new Set([...types2, ...types1]);
            return [...set];
        }

        const reserveTypesToTry = _getTypesToTry();
        const reserveTypeMode = getV("reserve-type-mode"); // "asis"|"attrUnified"|"typeUnified"|"allUnified"
        const ALL_TYPES_FULL = ["체","공","방","체공","체방","공방"];

        // 예비 정령 모드별 (속성, 타입들) 결정
        // - asis: 용의 선택 속성 + 선택 타입
        // - attrUnified: 버프속성 + 용의 선택 타입
        // - typeUnified: 용의 선택 속성 + reserveTypesToTry(버프모드 기반)
        // - allUnified: 버프속성 + reserveTypesToTry
        function _resolveReserve(dragon) {
            const dragonAttrKr = dragon.reserveAttr && dragon.reserveAttr !== "속성" ? dragon.reserveAttr : null;
            const sel = Array.isArray(dragon.selectedTypes) ? dragon.selectedTypes : [];

            const unifyAttr = (reserveTypeMode === "attrUnified" || reserveTypeMode === "allUnified");
            const unifyType = (reserveTypeMode === "typeUnified" || reserveTypeMode === "allUnified");

            const attrKr = unifyAttr ? (config.b1 || dragonAttrKr) : dragonAttrKr;
            const types = unifyType ? reserveTypesToTry : sel;
            return { attrKr, types };
        }

        // ===== 정확 최적화 (ExactOptimizer) =====
        // 용마다 가능한 (속성, 타입) 후보를 전부 넘기고, 엔진이 타입·장신구·인챈트·팬던트·젬을 함께 골라
        // 팀 비벨 합의 수학적 최댓값을 찾는다. (상위 18마리 자르기 / 순서별 탐욕 배분 없음)
        const optDragons = [];   // ExactOptimizer 입력
        const optMeta = [];      // 결과 표시에 필요한 원본 정보

        function _variantFor(dragon, attrKr, type) {
            const base = DB.BASE_STATS[type]?.[dragon.dStat];
            if (!base) return null;
            const sp = _calcSpiritStats(dragon.spiritStats, dragon.spiritTypes, dragon.bonus);
            const mult = _calcMult(attrKr || "", type);
            return {
                type, attrKr, base, mult,
                mult100: mult.map(m => Math.round(m * 100)),
                spPlus: sp.plus, spPct: sp.percent,
                bonus: [sp.bonus === "체" ? 40 : 0, sp.bonus === "공" ? 10 : 0, sp.bonus === "방" ? 10 : 0]
            };
        }
        function _pushDragon(dragon, attrKr, types, flags) {
            const variants = (types || []).map(t => _variantFor(dragon, attrKr, t)).filter(Boolean);
            if (!variants.length) return;
            optDragons.push({ name: dragon.name, isReserve: !!flags.isReserve, variants });
            optMeta.push({ dragon, flags, attrKr });
        }

        regularDragons.forEach(dragon => {
            if (spiritUnlock === "all" || spiritUnlock === "typeFixed" || spiritUnlock === "attrFixed") {
                const origAttr = dragon._origAttr || attrMap[dragon.attrKey] || dragon.attrKey;
                const virtualDragon = {
                    reserveAttr: origAttr,
                    selectedTypes: (dragon.type && dragon.type !== "전체") ? [dragon.type] : reserveTypesToTry
                };
                const { attrKr, types } = _resolveReserve(virtualDragon);
                const finalAttr = (spiritUnlock === "attrFixed") ? origAttr : (attrKr || origAttr);
                const finalTypes = (spiritUnlock === "typeFixed") ? [dragon.type] : types;
                _pushDragon(dragon, finalAttr, finalTypes, { isUnlocked: true, isAllType: (finalTypes || []).length > 1 });
            } else {
                const dragonAttrKr = attrMap[dragon.attrKey] || dragon.attrKey;
                _pushDragon(dragon, dragonAttrKr, [dragon.type], {});
            }
        });

        if (maxReserve > 0) {
            reserveDragons.forEach(dragon => {
                const { attrKr, types } = _resolveReserve(dragon);
                _pushDragon(dragon, attrKr, types, { isReserve: true, isAllType: (types || []).length > 1 });
            });
        }

        // 장신구: 같은 (이름, 수치, 인챈트 설정)은 개수로 묶음. 인챈트 "all"은 체/공/방 중 고를 수 있는 1개.
        const ENC_NAMES = ["체", "공", "방"];
        const accGroups = new Map();
        resAccs.forEach(acc => {
            const accBase = DB.ACCESSORY_STATS_DB[acc.item]?.[acc.value];
            if (!accBase) return;
            const key = `${acc.item}|${acc.value}|${acc.enchant}`;
            if (!accGroups.has(key)) {
                const encs = acc.enchant === "all" ? [0, 1, 2] : [statIdx[acc.enchant] !== undefined ? statIdx[acc.enchant] : -1];
                accGroups.set(key, {
                    count: 0, item: acc.item, value: acc.value,
                    choices: encs.map(e => ({ enc: e >= 0 ? ENC_NAMES[e] : "", pct: accBase.map((v, i) => v + (i === e ? 21 : 0)) }))
                });
            }
            // 최대 자원(가상) 장신구는 3마리 모두 같은 것을 낄 수 있게 함
            accGroups.get(key).count += acc.uid.startsWith("v_") ? 3 : 1;
        });
        const optAccs = [...accGroups.values()];

        // 팬던트: 옵션이 같은 것은 개수로 묶음
        const penGroups = new Map();
        resPens.forEach(pen => {
            const p = [0, 0, 0];
            const o1 = statIdx[pen.opt1]; if (o1 !== undefined) p[o1] += parseInt(pen.stat1) || 0;
            const o2 = statIdx[pen.opt2]; if (o2 !== undefined) p[o2] += parseInt(pen.stat2) || 0;
            if (pen.type === "태양") { const o3 = statIdx[pen.opt3]; if (o3 !== undefined) p[o3] += parseInt(pen.stat3) || 0; }
            const key = `${pen.type}|${p.join(",")}`;
            if (!penGroups.has(key)) penGroups.set(key, { count: 0, pct: p, pen });
            penGroups.get(key).count += pen.uid.startsWith("v_") ? 3 : 1;
        });
        const optPens = [...penGroups.values()];

        // 젬: 스탯별 (단계, 수치, 개수)
        const optGems = ["체", "공", "방"].map(kr => [36, 38, 40, 42, 44].map(lvl => ({
            lv: lvl, val: DB.GEM_LEVEL_STATS[lvl][kr], count: resPool[lvl]?.[kr] || 0
        })));

        const solved = ExactOptimizer.solve({ dragons: optDragons, accs: optAccs, pens: optPens, gems: optGems, maxReserve });

        console.group("🛡️ 길드전 최적화 v3 - 정확 최적화(분기 한정)");
        console.log(`용 후보 ${optDragons.length}마리, 옵션 ${solved.stats.options.toLocaleString()}개 중 ${solved.stats.keptOptions.toLocaleString()}개 탐색, 정확 평가 ${solved.stats.exactEvals.toLocaleString()}회, ${solved.stats.ms}ms`);

        let bestTeam = null;
        if (solved.team.length === 3) {
            bestTeam = solved.team.map(m => {
                const meta = optMeta[m.dragonIndex];
                const v = optDragons[m.dragonIndex].variants[m.variantIndex];
                const src = meta.dragon;
                const accG = m.accIndex >= 0 ? optAccs[m.accIndex] : null;
                const penG = m.penIndex >= 0 ? optPens[m.penIndex] : null;
                const accPct = accG ? accG.choices.find(c => c.enc === m.enc).pct : [0, 0, 0];
                const spirit = _calcSpiritStats(src.spiritStats, src.spiritTypes, src.bonus);
                const ctx = { accPct, pendant: penG ? penG.pct : [0, 0, 0], multipliers: v.mult };
                const res = _computeDetailedFromLevels(v.base, { h: m.gemLevels[0], a: m.gemLevels[1], d: m.gemLevels[2] }, spirit, ctx);
                const pen = penG ? penG.pen : null;

                // 미리보기(버프 참고)가 찾을 수 있도록 확정 타입/속성을 반영한 용 객체를 등록
                const resolvedAttrKey = meta.flags.isReserve ? (krToAttrKey[meta.attrKr] || "reserve") : src.attrKey;
                const resolved = { ...src, attrKey: resolvedAttrKey, type: v.type };
                const prevIdx = dragons.findIndex(d => d.name === src.name);
                if (prevIdx >= 0) dragons[prevIdx] = resolved; else dragons.push(resolved);

                return {
                    ...res,
                    h: m.gemLevels[0].length, a: m.gemLevels[1].length, d: m.gemLevels[2].length,
                    dN: src.name, dT: v.type, dS: src.dStat,
                    dA: attrMap[resolvedAttrKey] || "",
                    accN: accG ? accG.item : "없음", accV: accG ? accG.value : "-", eN: m.enc,
                    penN: pen ? pen.type : "없음",
                    penDetails: !pen ? "-" : pen.type === "태양"
                        ? `${pen.opt1}${pen.stat1}/${pen.opt2}${pen.stat2}/${pen.opt3}${pen.stat3}`
                        : `${pen.opt1}${pen.stat1}/${pen.opt2}${pen.stat2}`,
                    isReserve: !!meta.flags.isReserve,
                    isAllType: !!meta.flags.isAllType,
                    isUnlocked: !!meta.flags.isUnlocked,
                    spiritInfo: { stats: src.spiritStats || [], types: src.spiritTypes || [], bonus: src.bonus || "" },
                    gems: { h: m.gemLevels[0].length, a: m.gemLevels[1].length, d: m.gemLevels[2].length, details: res.gemLevels },
                    raw: { base: v.base, spirit, ctx }
                };
            });
            console.log(`%c최적 팀 총합 비벨: ${Math.floor(solved.total).toLocaleString()}`, "color: #e74c3c; font-weight: bold; font-size: 14px;");
            bestTeam.forEach((m, i) => console.log(`  ${i+1}. ${m.dN} → ${Math.floor(m.vval).toLocaleString()}`));
        }
        console.groupEnd();

        if (bestTeam) {
            bestTeam.sort((a, b) => b.vval - a.vval);

            // ★ 예비/해제 정령 버프 프리뷰 계산 (장비도 재최적화)
            const BUFF_2 = [
                {label:"체/체", m:[0.4,0,0]}, {label:"공/공", m:[0,0.4,0]}, {label:"방/방", m:[0,0,0.4]},
                {label:"체/공", m:[0.2,0.2,0]}, {label:"체/방", m:[0.2,0,0.2]}, {label:"공/방", m:[0,0.2,0.2]}
            ];
            const BUFF_1 = [
                {label:"체", m:[0.2,0,0]}, {label:"공", m:[0,0.2,0]}, {label:"방", m:[0,0,0.2]}
            ];
            const ALL_TYPES = ["체","공","방","체공","체방","공방"];

            // 버프 프리뷰 자원 (고속)
            bestTeam.forEach(res => {
                if ((!res.isReserve && !res.isUnlocked) || !res.raw) return;

                const dragonObj = dragons.find(d => d.name === res.dN);
                if (!dragonObj) return;

                const typesToTry = res.isAllType ? ALL_TYPES : [res.dT];

                function bestForBuffSet(buffSet) {
                    let best = {label:"", type:"", vval:0};
                    for (let ti = 0; ti < typesToTry.length; ti++) {
                        const tryDragon = { ...dragonObj, type: typesToTry[ti] };
                        for (let bi = 0; bi < buffSet.length; bi++) {
                            const v = _findBestVval(tryDragon, prevPool, prevAccs, prevPens, buffSet[bi].m);
                            if (v > best.vval) best = {label: buffSet[bi].label, type: typesToTry[ti], vval: v};
                        }
                    }
                    return best;
                }

                const best2 = bestForBuffSet(BUFF_2);
                const best1 = bestForBuffSet(BUFF_1);

                let best0 = {type:"", vval:0};
                for (let ti = 0; ti < typesToTry.length; ti++) {
                    const tryDragon = { ...dragonObj, type: typesToTry[ti] };
                    const v = _findBestVval(tryDragon, prevPool, prevAccs, prevPens, [0,0,0]);
                    if (v > best0.vval) best0 = {type: typesToTry[ti], vval: v};
                }

                res.buffPreview = {
                    best2: { label: best2.label, type: best2.type, vval: best2.vval },
                    best1: { label: best1.label, type: best1.type, vval: best1.vval },
                    vval0: best0.vval,
                    type0: best0.type,
                    showType: res.isAllType,
                    isMax: useMaxPreview,
                    maxResType: maxResType
                };
            });

        }

        // ★ 설정은 결과 유무와 관계없이 항상 저장
        const saveData = { buffs: config, maxResource: maxResource, maxResType: maxResType, reserveCount: maxReserve, spiritUnlock: spiritUnlock, reserveBuffMode: reserveBuffMode, reserveTypeMode: reserveTypeMode };
        if (bestTeam) {
            saveData.results = bestTeam;
        }
        _storage.save("guild_result_state", saveData);

        return bestTeam || [];
    },
        loadSaved: () => _storage.load("guild_result_state")
    };
})();

// DOM 관련 핸들러는 이전과 동일 (results 루프만 처리하도록 유지)
document.addEventListener("DOMContentLoaded", function() {
    const btn = document.getElementById("calc-btn");
    
    const IS_V2 = document.documentElement.classList.contains("ui-v2");
    const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // ===== 새 디자인(v2) 결과 카드 =====
    function renderV2(results, maxResource, maxResType) {
        const isMaxResult = (maxResource === "result" || maxResource === "all");
        const maxResLabel = {"all":"","pen":"팬던트","acc":"장신구","gem":"젬","pen+acc":"팬던트+장신구","pen+gem":"팬던트+젬","acc+gem":"장신구+젬"};
        const resTypeTag = (type) => (!type || type === "all") ? "" : ": " + (maxResLabel[type] || type);
        const STAT_CLASS = { "체": "hp", "공": "atk", "방": "def" };
        const SP_PLUS = [54, 60, 66, 120], SP_PCT = [24, 28, 32, 40];
        const n = (v) => Math.floor(v || 0).toLocaleString();
        const M = (v) => Math.floor((v || 0) / 1000000).toLocaleString() + "M";

        const spiritHtml = (res) => {
            let info = res.spiritInfo;
            if (!info) {
                try {
                    const d = (JSON.parse(localStorage.getItem("guild_dragon_data")) || []).find(x => x.name === res.dN);
                    if (d) info = { stats: d.spiritStats || [], types: d.spiritTypes || [], bonus: d.bonus || "" };
                } catch (e) {}
            }
            if (!info) return "";
            const parts = [];
            for (let i = 0; i < 4; i++) {
                const st = info.stats[i];
                if (!STAT_CLASS[st]) continue;
                const txt = info.types[i] === "+" ? `${st}+${SP_PLUS[i] * (st === "체" ? 4 : 1)}` : `${st} ${SP_PCT[i]}%`;
                parts.push(`<span class="sv sv-${STAT_CLASS[st]}">${txt}</span>`);
            }
            const BONUS = { "체": "체+40", "공": "공+10", "방": "방+10" };
            const bonus = BONUS[info.bonus] ? `<span class="sub">부가 ${BONUS[info.bonus]}</span>` : "";
            if (!parts.length && !bonus) return "";
            const grade = typeof spiritGrade === "function" ? spiritGrade(info.stats, info.types) : "";
            const gradeTag = (grade && typeof spiritGradeTag === "function") ? spiritGradeTag(grade, { size: 11.5 }) : "";
            return `<div class="rc-row"><span class="rc-k">정령</span><span class="rc-v">${parts.join("")}${bonus}${gradeTag}</span></div>`;
        };
        const gemHtml = (res, key, kr) => {
            const count = res.gems?.[key] || 0;
            const lv = res.gems?.details?.[key] || [];
            return `<span class="gem gem-${STAT_CLASS[kr]}${count ? "" : " is-zero"}"><b>${kr} ${count}</b>${lv.length ? `<small>${lv.join(",")}</small>` : ""}</span>`;
        };

        [1,2,3].forEach(i => { const el = document.getElementById(`result${i}`); if (el) el.innerHTML = ""; });

        results.forEach((res, i) => {
            const el = document.getElementById(`result${i+1}`);
            if (!el) return;
            const maxResTag = isMaxResult ? `최대자원${resTypeTag(maxResType)}` : "";
            const prevResTag = (res.buffPreview && res.buffPreview.isMax) ? `최대자원${resTypeTag(res.buffPreview.maxResType)}` : "";
            const accText = res.accN === "없음" ? `<span class="sub">없음</span>`
                : `${escHtml(res.accN)} <span class="sub">${escHtml(res.accV)}%</span>${res.eN ? ` <span class="enc enc-${STAT_CLASS[res.eN] || "none"}">${escHtml(res.eN)}</span>` : ""}`;
            const penText = res.penN === "없음" ? `<span class="sub">없음</span>`
                : `${escHtml(res.penN)} <span class="sub">${escHtml(res.penDetails)}</span>`;
            const bp = res.buffPreview;
            const tags = [res.dA, res.dT, res.dS].filter(Boolean).map(t => `<span class="chip">${escHtml(t)}</span>`).join("");
            el.innerHTML = `
            <article class="rc">
                <header class="rc-head">
                    <span class="rc-rank">${i + 1}순위</span>
                    <h3 class="rc-name">${escHtml(res.dN)}</h3>
                    <div class="rc-tags">${tags}${res.isReserve ? '<span class="chip chip-reserve">예비</span>' : ""}${res.isUnlocked ? '<span class="chip chip-unlock">해제</span>' : ""}</div>
                </header>
                <div class="rc-setup">
                    ${spiritHtml(res)}
                    <div class="rc-row"><span class="rc-k">장신구</span><span class="rc-v">${accText}</span></div>
                    <div class="rc-row"><span class="rc-k">팬던트</span><span class="rc-v">${penText}</span></div>
                    <div class="rc-row"><span class="rc-k">젬</span><span class="rc-v rc-gems">${gemHtml(res, "h", "체")}${gemHtml(res, "a", "공")}${gemHtml(res, "d", "방")}</span></div>
                </div>
                <div class="rc-stats">
                    <div class="st st-hp"><span>체력</span><b>${n(res.hp)}</b></div>
                    <div class="st st-atk"><span>공격</span><b>${n(res.atk)}</b></div>
                    <div class="st st-def"><span>방어</span><b>${n(res.def)}</b></div>
                </div>
                <div class="rc-score">
                    <span class="rc-score-label">최종 비벨${maxResTag ? ` <em>${maxResTag}</em>` : ""}</span>
                    <b class="rc-vval">${n(res.vval)}</b>
                    <span class="rc-eval">eval: ${((res.hp || 0) + (res.atk || 0) * 4 + (res.def || 0) * 4).toLocaleString()}</span>
                </div>
                ${bp ? `
                <div class="rc-preview">
                    <span class="rc-preview-title">버프 참고${prevResTag ? ` <em>${prevResTag}</em>` : ""}</span>
                    <span>2벞 <small>${bp.best2.label}${bp.showType ? `, ${bp.best2.type}` : ""}</small> <b>${M(bp.best2.vval)}</b></span>
                    <span>1벞 <small>${bp.best1.label}${bp.showType ? `, ${bp.best1.type}` : ""}</small> <b>${M(bp.best1.vval)}</b></span>
                    <span>0벞${bp.showType ? ` <small>${bp.type0}</small>` : ""} <b>${M(bp.vval0)}</b></span>
                </div>` : ""}
            </article>`;
        });

        const totalVval = results.reduce((sum, res) => sum + (res.vval || 0), 0);
        const container = document.getElementById("result-container");
        const oldTotal = document.getElementById("team-total-vval");
        if (oldTotal) oldTotal.remove();
        const totalDiv = document.createElement("div");
        totalDiv.id = "team-total-vval";
        totalDiv.className = "team-total";
        totalDiv.innerHTML = `<span class="team-total-label">팀 총합 비벨</span><b class="team-total-value">${n(totalVval)}</b>`;
        if (container) container.appendChild(totalDiv);
    }

    function render(results, maxResource, maxResType) {
        if(!results) return;
        if (IS_V2) return renderV2(results, maxResource, maxResType);
        const isMaxResult = (maxResource === "result" || maxResource === "all");
        const maxResLabel = {"all":"","pen":"팬던트","acc":"장신구","gem":"젬","pen+acc":"팬던트+장신구","pen+gem":"팬던트+젬","acc+gem":"장신구+젬"};
        const resTypeTag = (type) => (!type || type === "all") ? "" : ": " + (maxResLabel[type] || type);
        // 기존 결과창 초기화
        [1,2,3].forEach(i => { if(document.getElementById(`result${i}`)) document.getElementById(`result${i}`).innerHTML = ""; });

        results.forEach((res, i) => {
            const el = document.getElementById(`result${i+1}`);
            if(!el) return;

            const maxResTag = isMaxResult ? `(최대자원${resTypeTag(maxResType)})` : "";
            const prevResTag = (res.buffPreview && res.buffPreview.isMax) ? `(최대자원${resTypeTag(res.buffPreview.maxResType)})` : "";

            const getEnchantColor = (enchant) => {
                switch(enchant) {
                    case "체": return "#2980b9"; // 파란색
                    case "공": return "#e74c3c"; // 빨간색
                    case "방": return "#27ae60"; // 초록색
                    default: return "#555";
                }
            };

            const formatGemLevels = (type) => {
                // 1. 데이터 확인 (방어 코드)
                if (!res.gems || !res.gems.details) return "";
                
                // 2. 키 매핑
                const key = type === "체" ? "h" : type === "공" ? "a" : "d";
                
                // 3. 레벨 배열 가져오기
                const levels = res.gems.details[key]; 
                
                // 4. 비어있으면 리턴
                if (!levels || levels.length === 0) return "";
                
                // 5. 출력
                return `<span style="font-size:10px; color:#7f8c8d;">(${levels.join(',')})</span>`;
            };

            // 정령: 슬롯별 스탯·수치 + 부가옵 (예전에 저장된 결과는 내 용 데이터에서 이름으로 찾아 표시)
            const formatSpirit = () => {
                let info = res.spiritInfo;
                if (!info) {
                    try {
                        const d = (JSON.parse(localStorage.getItem("guild_dragon_data")) || []).find(x => x.name === res.dN);
                        if (d) info = { stats: d.spiritStats || [], types: d.spiritTypes || [], bonus: d.bonus || "" };
                    } catch (e) {}
                }
                if (!info) return "";
                const SP_PLUS = [54, 60, 66, 120], SP_PCT = [24, 28, 32, 40];
                const COL = { "체": "#2980b9", "공": "#c0392b", "방": "#27ae60" };
                const parts = [];
                for (let i = 0; i < 4; i++) {
                    const st = info.stats[i];
                    if (!COL[st]) continue;
                    const txt = info.types[i] === "+"
                        ? `${st}+${SP_PLUS[i] * (st === "체" ? 4 : 1)}`
                        : `${st} ${SP_PCT[i]}%`;
                    parts.push(`<span style="color:${COL[st]};">${txt}</span>`);
                }
                const BONUS = { "체": "체+40", "공": "공+10", "방": "방+10" };
                const bonus = BONUS[info.bonus] ? ` <span style="font-size:11px; color:#95a5a6;">(부가 ${BONUS[info.bonus]})</span>` : "";
                if (!parts.length && !bonus) return "";
                const grade = typeof spiritGrade === "function" ? spiritGrade(info.stats, info.types) : "";
                const gradeTag = (grade && typeof spiritGradeTag === "function") ? spiritGradeTag(grade, { size: 11 }) : "";
                return `• <b>정령:</b> ${parts.join(" · ")}${bonus}${gradeTag}<br>`;
            };

            // ★ 오류 수정 부분: (res.hp || 0).toLocaleString() 형태로 변경 ★
            el.innerHTML = `
            <div style="border:2px solid #007bff; padding:15px; border-radius:12px; background:#fff; text-align:left; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-bottom:15px;">
                <h3 style="margin:0; text-align:center; color:#2c3e50; font-size:1.2em;">${res.dN}${res.isReserve ? ' <span style="font-size:11px; color:#e67e22; background:#fef5e7; padding:1px 6px; border-radius:4px;">예비</span>' : ''}${res.isUnlocked ? ' <span style="font-size:11px; color:#8e44ad; background:#f5eef8; padding:1px 6px; border-radius:4px;">해제</span>' : ''}</h3>
                <p style="text-align:center; font-size:12px; color:#7f8c8d; margin:5px 0;">
                    <span style="background:#f1f2f6; padding:2px 6px; border-radius:4px;">${res.dA}</span> / 
                    <span style="background:#f1f2f6; padding:2px 6px; border-radius:4px;">${res.dT}</span> / 
                    <span style="background:#f1f2f6; padding:2px 6px; border-radius:4px;">${res.dS}</span>
                </p>
                <hr style="border:0; border-top:1px solid #eee; margin:10px 0;">
                
                <div style="font-size:13px; line-height:1.6; margin-bottom:10px;">
                    <b style="color:#555;">[세팅 정보]</b><br>
                    ${formatSpirit()}
                    • <b>장신구:</b> ${res.accN === "없음" ? "없음" : `${res.accN} (${res.accV}%)${res.eN ? ` /
                      <span style="color:${getEnchantColor(res.eN)}; font-weight:bold;">
                        ${res.eN}
                      </span>` : ""}`}<br>
                    • <b>팬던트:</b> ${res.penN} <span style="font-size:11px; color:#95a5a6;">(${res.penDetails})</span><br>
                    • <b>젬 구성:</b> <br>
                    &nbsp;&nbsp; <span style="color:#2980b9;">체 ${res.gems?.h || 0}</span> ${formatGemLevels("체")}<br>
                    &nbsp;&nbsp; <span style="color:#c0392b;">공 ${res.gems?.a || 0}</span> ${formatGemLevels("공")}<br>
                    &nbsp;&nbsp; <span style="color:#27ae60;">방 ${res.gems?.d || 0}</span> ${formatGemLevels("방")}
                </div>

                <div style="background:#f8f9fa; padding:10px; border-radius:8px; border:1px solid #e9ecef; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; text-align:center;">
                        <div style="flex:1;">
                            <div style="font-size:10px; color:#2980b9;">체력</div>
                            <div style="font-size:16px; font-weight:bold; color:#2c3e50;">${(res.hp || 0).toLocaleString()}</div>
                        </div>
                        <div style="flex:1; border-left:1px solid #dee2e6; border-right:1px solid #dee2e6;">
                            <div style="font-size:10px; color:#c0392b;">공격</div>
                            <div style="font-size:16px; font-weight:bold; color:#2c3e50;">${(res.atk || 0).toLocaleString()}</div>
                        </div>
                        <div style="flex:1;">
                            <div style="font-size:10px; color:#27ae60;">방어</div>
                            <div style="font-size:16px; font-weight:bold; color:#2c3e50;">${(res.def || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                <div style="text-align:center; margin:10px 0; background:#f1f8ff; padding:12px; border-radius:10px; border:1px solid #d1e9ff;">
                    <span style="font-size:11px; color:#666;">최종 비벨${maxResTag ? ` <span style="color:#c0392b;">${maxResTag}</span>` : ''} </span><br>
                    <b style="font-size:24px; color:#2c3e50; letter-spacing:-0.5px;">${Math.floor(res.vval || 0).toLocaleString()}</b>
                    <div style="font-size:11px; color:#888; margin-top:2px;">eval: ${((res.hp || 0) + (res.atk || 0) * 4 + (res.def || 0) * 4).toLocaleString()}</div>
                </div>
                ${res.buffPreview ? `
                <div style="text-align:center; font-size:10px; color:#888; line-height:1.7; background:#fef9f0; padding:8px; border-radius:8px; border:1px solid #f0e0c0; margin-bottom:8px;">
                    <span style="color:#e67e22; font-weight:bold;">버프 참고${prevResTag ? ` <span style="font-size:9px; color:#c0392b;">${prevResTag}</span>` : ''}</span><br>
                    2벞(${res.buffPreview.best2.label}${res.buffPreview.showType ? `, ${res.buffPreview.best2.type}` : ''}): <b style="color:#555;">${Math.floor(res.buffPreview.best2.vval / 1000000)}M</b>
                    &nbsp;|&nbsp;
                    1벞(${res.buffPreview.best1.label}${res.buffPreview.showType ? `, ${res.buffPreview.best1.type}` : ''}): <b style="color:#555;">${Math.floor(res.buffPreview.best1.vval / 1000000)}M</b>
                    &nbsp;|&nbsp;
                    0벞${res.buffPreview.showType ? `(${res.buffPreview.type0})` : ''}: <b style="color:#555;">${Math.floor(res.buffPreview.vval0 / 1000000)}M</b>
                </div>
                ` : ''}

                <details style="display:none; font-size:11px; color:#444; background:#f9f9f9; padding:10px; border-radius:8px; border:1px solid #eee;">
                    <summary style="cursor:pointer; font-weight:bold; color:#7f8c8d;">🔍 단계별 계산 로그 확인</summary>
                    <div style="white-space:pre-wrap; font-family:monospace; margin-top:8px; border-top:1px dashed #ccc; padding-top:8px; line-height:1.4;">
${(res.fullLog || []).join('\n')}
                    </div>
                </details>
            </div>
            `;
        });

        const totalVval = results.reduce((sum, res) => sum + (res.vval || 0), 0);
        
        const container = document.getElementById('result3') ? document.getElementById('result3').parentElement : document.body;
        
        const oldTotal = document.getElementById('team-total-vval');
        if(oldTotal) oldTotal.remove();

        const totalDiv = document.createElement('div');
        totalDiv.id = 'team-total-vval';
        totalDiv.style.cssText = `
            grid-column: 1 / -1;
            margin: 30px auto;
            padding: 20px;
            width: 90%;
            max-width: 500px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 20px rgba(118, 75, 162, 0.3);
        `;

        totalDiv.innerHTML = `
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">팀 총합 비벨 </div>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 1px;">
                ${Math.floor(totalVval).toLocaleString()}
            </div>
        `;

        if(container) container.appendChild(totalDiv);
    }

    const saved = ResultEngine.loadSaved();

    if(saved) {
        if(saved.buffs) {
            const b = saved.buffs;
            const ids = ["buff-attr","buff-stat1","buff-type","buff-stat2","debuff-attr","debuff-stat1","debuff-type","debuff-stat2"];
            const vals = [b.b1, b.b2, b.b3, b.b4, b.d1, b.d2, b.d3, b.d4];
            ids.forEach((id, i) => { if(document.getElementById(id)) document.getElementById(id).value = vals[i]; });
        }
        if(saved.reserveCount !== undefined && document.getElementById("reserve-count")) document.getElementById("reserve-count").value = saved.reserveCount;
        if(saved.spiritUnlock !== undefined && document.getElementById("spirit-unlock")) document.getElementById("spirit-unlock").value = saved.spiritUnlock;
        if(saved.maxResource !== undefined && document.getElementById("max-resource")) document.getElementById("max-resource").value = saved.maxResource;
        if(saved.maxResType !== undefined && document.getElementById("max-resource-type")) document.getElementById("max-resource-type").value = saved.maxResType;
        if(saved.reserveBuffMode !== undefined && document.getElementById("reserve-buff-mode")) document.getElementById("reserve-buff-mode").value = saved.reserveBuffMode;
        if(saved.reserveTypeMode !== undefined && document.getElementById("reserve-type-mode")) document.getElementById("reserve-type-mode").value = saved.reserveTypeMode;
        if(saved.results) render(saved.results, saved.maxResource, saved.maxResType);
    }
    if(btn) {
        btn.addEventListener("click", function() {
            const res = ResultEngine.run();
            if(res.length > 0) {
                render(res, document.getElementById("max-resource").value, document.getElementById("max-resource-type").value);
                // 새 디자인: 계산이 끝나면 결과 위치로 이동
                if (IS_V2 && window.GUILD_UI_V2) window.GUILD_UI_V2.scrollTo(document.querySelector(".result-title"));
            }
            else alert("계산 가능한 드래곤/장비 데이터가 없습니다.");
        });
    }
});
