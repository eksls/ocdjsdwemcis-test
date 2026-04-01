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
            37: { "체": 148, "공": 37, "방": 37 },
            38: { "체": 152, "공": 38, "방": 38 },
            39: { "체": 156, "공": 39, "방": 39 },
            40: { "체": 160, "공": 40, "방": 40 }
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

    function _calcGemTotalWithLevels(needed, type, gemPool) {
        let total = 0, remain = needed;
        let usedLevels = [];
        for (let lvl = 40; lvl >= 36; lvl--) {
            if (remain <= 0) break;
            const available = gemPool[lvl][type];
            if (available > 0) {
                const take = Math.min(remain, available);
                total += take * DB.GEM_LEVEL_STATS[lvl][type];
                for(let i=0; i<take; i++) usedLevels.push(lvl);
                remain -= take;
            }
        }
        return { total, usedLevels };
    }

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

    function _computeWithDetailedLog(base, gems, spirit, context, gemPool) {
        let log = [];
        let [hp, atk, def] = [...base];

        const resH = _calcGemTotalWithLevels(gems.h, "체", gemPool);
        const resA = _calcGemTotalWithLevels(gems.a, "공", gemPool);
        const resD = _calcGemTotalWithLevels(gems.d, "방", gemPool);

        const gH = resH.total + 24;
        const gA = resA.total + 6;
        const gD = resD.total + 6;
        hp += gH; atk += gA; def += gD;

        const rH = context.acc[0] + context.enchant[0];
        const rA = context.acc[1] + context.enchant[1];
        const rD = context.acc[2] + context.enchant[2];
        const bAcc = [hp, atk, def];
        hp += _trunc(bAcc[0] * (rH / 100));
        atk += _trunc(bAcc[1] * (rA / 100));
        def += _trunc(bAcc[2] * (rD / 100));

        hp += spirit.plus[0]; atk += spirit.plus[1]; def += spirit.plus[2];

        const bSp = [hp, atk, def];
        hp += _trunc(bSp[0] * (spirit.percent[0] / 100));
        atk += _trunc(bSp[1] * (spirit.percent[1] / 100));
        def += _trunc(bSp[2] * (spirit.percent[2] / 100));

        let bh=0, ba=0, bd=0;
        if(spirit.bonus==="체") bh=40; else if(spirit.bonus==="공") ba=10; else if(spirit.bonus==="방") bd=10;
        hp+=bh; atk+=ba; def+=bd;

        const bPen = [hp, atk, def];
        hp += _trunc(bPen[0] * (context.pendant[0] / 100));
        atk += _trunc(bPen[1] * (context.pendant[1] / 100));
        def += _trunc(bPen[2] * (context.pendant[2] / 100));

        hp += 240; atk += 60; def += 60;

        const buffH = _trunc(base[0] * context.multipliers[0]);
        const buffA = _trunc(base[1] * context.multipliers[1]);
        const buffD = _trunc(base[2] * context.multipliers[2]);
        hp += buffH; atk += buffA; def += buffD;

        log.push(`[1] 기본 스탯: 체(${base[0]}) 공(${base[1]}) 방(${base[2]})`);
        log.push(`[2] 젬/물약 추가: +체${gH} +공${gA} +방${gD}`);
        log.push(`[3] 장비/인챈%: 체${rH}% 공${rA}% 방${rD}%`);
        log.push(`[4] 정령(+): +체${spirit.plus[0]} +공${spirit.plus[1]} +방${spirit.plus[2]}`);
        log.push(`[5] 정령(%): 체${spirit.percent[0]}% 공${spirit.percent[1]}% 방${spirit.percent[2]}%`);
        log.push(`[6] 정령 부가: +체${bh} +공${ba} +방${bd}`);
        log.push(`[7] 팬던트%: 체${context.pendant[0]}% 공${context.pendant[1]}% 방${context.pendant[2]}%`);
        log.push(`[8] 컬렉션/버프: +체${240+buffH} +공${60+buffA} +방${60+buffD}`);

        return { hp, atk, def, vval: hp * atk * def, fullLog: log, gemLevels: { h: resH.usedLevels, a: resA.usedLevels, d: resD.usedLevels } };
    }

    // 특정 조건에서 한 마리의 용이 낼 수 있는 '최선'의 세팅을 찾는 함수
    function _findBestSettingForDragon(dragon, gemPool, accs, pens, multipliers) {
        const base = DB.BASE_STATS[dragon.type]?.[dragon.dStat];
        if (!base) return null;

        const spirit = _calcSpiritStats(dragon.spiritStats, dragon.spiritTypes, dragon.bonus);
        const statIdx = { "체": 0, "공": 1, "방": 2 };
        let best = { vval: -1 };

        const currentTotalInv = {
            체: Object.values(gemPool).reduce((sum, lv) => sum + lv.체, 0),
            공: Object.values(gemPool).reduce((sum, lv) => sum + lv.공, 0),
            방: Object.values(gemPool).reduce((sum, lv) => sum + lv.방, 0)
        };

        accs.forEach(acc => {
            const accBase = DB.ACCESSORY_STATS_DB[acc.item]?.[acc.value] || [0, 0, 0];
            const enchantOptions = acc.enchant === "all" ? ["체", "공", "방"] : [acc.enchant];

            enchantOptions.forEach(eOpt => {
                const encStats = (statIdx[eOpt] !== undefined) ? [0, 0, 0].map((_, i) => i === statIdx[eOpt] ? 21 : 0) : [0, 0, 0];

                pens.forEach(pen => {
                    const pStats = [0, 0, 0];
                    const opts = [[pen.opt1, pen.stat1], [pen.opt2, pen.stat2]];
                    if (pen.type === "태양") opts.push([pen.opt3, pen.stat3]);
                    opts.forEach(([o, v]) => { if (statIdx.hasOwnProperty(o)) pStats[statIdx[o]] += parseInt(v) || 0; });

                    const ctx = { acc: accBase, enchant: encStats, pendant: pStats, multipliers: multipliers };

                    for (let h = 0; h <= Math.min(5, currentTotalInv.체); h++) {
                        for (let a = 0; a <= 5 - h; a++) {
                            let d = 5 - h - a;
                            if (d > currentTotalInv.방 || d < 0) continue;

                            const res = _computeWithDetailedLog(base, {h, a, d}, spirit, ctx, gemPool);
                            if (res.vval > best.vval) {
                                best = {
                                    ...res, h, a, d,
                                    dN: dragon.name, dT: dragon.type, dS: dragon.dStat,
                                    accN: acc.item, accV: acc.value, eN: eOpt,
                                    penN: pen.type, penDetails: pen.type === "태양" 
    ? `${pen.opt1}${pen.stat1}/${pen.opt2}${pen.stat2}/${pen.opt3}${pen.stat3}`
    : `${pen.opt1}${pen.stat1}/${pen.opt2}${pen.stat2}`,
                                    accUid: acc.uid, penUid: pen.uid,
                                    raw: { base, spirit, ctx: ctx }
                                };
                            }
                        }
                    }
                });
            });
        });

        return best.vval !== -1 ? best : null;
    }

    // ★ 그리디 배분: 주어진 순서대로 실제 자원 할당하고 팀 결과 반환
    function _allocateTeam(orderedDragons, dragons, pool, realAccs, realPens, attrMap) {
        let team = [];
        let curPool = JSON.parse(JSON.stringify(pool));
        let curAccs = [...realAccs];
        let curPens = [...realPens];

        for (const member of orderedDragons) {
            const dragonObj = dragons.find(d => d.name === member.dN);
            if (!dragonObj) continue;
            const result = _findBestSettingForDragon(dragonObj, curPool, curAccs, curPens, member.mult);
            if (!result) continue;

            team.push({
                ...result,
                dA: attrMap[dragonObj.attrKey] || "",
                isReserve: member.isReserve || false,
                isAllType: member.isAllType || false,
                isUnlocked: member.isUnlocked || false,
                gems: { h: result.h, a: result.a, d: result.d, details: result.gemLevels }
            });

            // 자원 소모
            ["h", "a", "d"].forEach(key => {
                const typeKr = key === "h" ? "체" : key === "a" ? "공" : "방";
                result.gemLevels[key].forEach(lvl => {
                    if (curPool[lvl][typeKr] > 0) curPool[lvl][typeKr]--;
                });
            });
            curAccs = curAccs.filter(a => a.uid !== result.accUid);
            curPens = curPens.filter(p => p.uid !== result.penUid);
        }
        return team;
    }

    const CANDIDATE_COUNT = 18; // 후보 수 (조절 가능)
    const PERMS_3 = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];

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
        [36, 37, 38, 39, 40].forEach((lvl, idx) => {
            const g = gear.gems?.[idx] || { 체: 0, 공: 0, 방: 0 };
            pool[lvl] = { 체: parseInt(g.체)||0, 공: parseInt(g.공)||0, 방: parseInt(g.방)||0 };
        });

        const realAccs = (gear.accessories || []).filter(a => a.item !== "장신구").map((a, i) => ({ ...a, uid: `acc_${i}` }));
        const realPens = (gear.pendants || []).filter(p => p.type !== "선택" && p.type !== "off").map((p, i) => ({ ...p, uid: `pen_${i}` }));

        const virtualAccs = ["황보", "여보", "악보", "물뿔(체/공)", "물뿔(체/방)", "불뿔(공/체)", "불뿔(공/방)", "대뿔(방/체)", "대뿔(방/공)", "바뿔(공/체)", "바뿔(공/방)", "바뿔(체/방)"]
            .map(name => ({ item: name, value: 19, enchant: "all", uid: "v_acc" }));

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
        ].map(p => ({ ...p, uid: "v_pen" }));

        const statIdx = { "체": 0, "공": 1, "방": 2 };
        const infinitePool = { 36: {체:99,공:99,방:99}, 37: {체:99,공:99,방:99}, 38: {체:99,공:99,방:99}, 39: {체:99,공:99,방:99}, 40: {체:99,공:99,방:99} };

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
        const spiritUnlock = getV("spirit-unlock"); // "off" | "typeFixed" | "all"
        const rawRegular = allDragonData.filter(d => d.attrKey !== "reserve" && d.name && d.type !== "타입");
        const reserveRaw = allDragonData.filter(d => d.attrKey === "reserve" && d.type !== "타입");
        
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
                const resolvedAttrKey = buffAttrKey || d.attrKey;
                if (spiritUnlock === "all") {
                    return { ...d, name: newName, attrKey: resolvedAttrKey, type: "전체", _origAttr: krAttr };
                } else {
                    return { ...d, name: newName, attrKey: resolvedAttrKey, _origAttr: krAttr };
                }
            });
        } else {
            regularDragons = rawRegular;
        }

        // dragons 배열: 일반 + 예비(타입 확정된) — _allocateTeam에서 사용
        const dragons = [...regularDragons];

        // ===== 1단계: 가상 자원으로 잠재력 평가 → 상위 N명 후보 선발 =====
        const candidates = [];

        // 멀티플라이어 계산 헬퍼
        function _calcMult(dragonAttrKr, dragonType) {
            let mult = [0, 0, 0];
            if (dragonAttrKr === config.b1 && statIdx[config.b2] !== undefined) mult[statIdx[config.b2]] += 0.2;
            if (dragonType === config.b3 && statIdx[config.b4] !== undefined) mult[statIdx[config.b4]] += 0.2;
            if (dragonAttrKr === config.d1 && statIdx[config.d2] !== undefined) mult[statIdx[config.d2]] -= 0.2;
            if (dragonType === config.d3 && statIdx[config.d4] !== undefined) mult[statIdx[config.d4]] -= 0.2;
            return mult;
        }

        // 일반 용 평가
        regularDragons.forEach(dragon => {
            const dragonAttrKr = (spiritUnlock !== "off") ? (config.b1 || "") : (attrMap[dragon.attrKey] || dragon.attrKey);

            if (spiritUnlock === "all" && dragon.type === "전체") {
                // 전체 해제: 6타입 중 최고만 채택
                let bestRes = null, bestType = "체";
                ["체","공","방","체공","체방","공방"].forEach(tryType => {
                    const tryDragon = { ...dragon, type: tryType };
                    const mult = _calcMult(dragonAttrKr, tryType);
                    const res = _findBestSettingForDragon(tryDragon, infinitePool, virtualAccs, vAllPens, mult);
                    if (res && (!bestRes || res.vval > bestRes.vval)) {
                        bestRes = res;
                        bestType = tryType;
                        bestRes._mult = mult;
                    }
                });
                if (bestRes) {
                    dragon.type = bestType; // dragons 배열 내 타입 확정
                    candidates.push({ ...bestRes, mult: bestRes._mult, isReserve: false, isAllType: true, isUnlocked: true });
                }
            } else if (spiritUnlock === "typeFixed") {
                const mult = _calcMult(dragonAttrKr, dragon.type);
                const buffRes = _findBestSettingForDragon(dragon, infinitePool, virtualAccs, vAllPens, mult);
                if (buffRes) {
                    candidates.push({ ...buffRes, mult, isReserve: false, isAllType: false, isUnlocked: true });
                }
            } else {
                const mult = _calcMult(dragonAttrKr, dragon.type);
                const buffRes = _findBestSettingForDragon(dragon, infinitePool, virtualAccs, vAllPens, mult);
                if (buffRes) {
                    candidates.push({ ...buffRes, mult, isReserve: false });
                }
            }
        });

        // 예비 정령 평가 (maxReserve > 0일 때만)
        if (maxReserve > 0) {
            reserveDragons.forEach(dragon => {
                const reserveAttrKr = buffAttrKey ? config.b1 : "";
                const resolvedAttrKey = buffAttrKey || "reserve";

                if (dragon.type === "전체") {
                    // 6가지 타입 중 최고 비벨만 채택
                    let bestRes = null, bestType = "체";
                    ["체","공","방","체공","체방","공방"].forEach(tryType => {
                        const tryDragon = { ...dragon, attrKey: resolvedAttrKey, type: tryType };
                        const mult = _calcMult(reserveAttrKr, tryType);
                        const res = _findBestSettingForDragon(tryDragon, infinitePool, virtualAccs, vAllPens, mult);
                        if (res && (!bestRes || res.vval > bestRes.vval)) {
                            bestRes = res;
                            bestType = tryType;
                            bestRes._mult = mult;
                        }
                    });
                    if (bestRes) {
                        const resolved = { ...dragon, attrKey: resolvedAttrKey, type: bestType };
                        dragons.push(resolved);
                        candidates.push({ ...bestRes, mult: bestRes._mult, isReserve: true, isAllType: true });
                    }
                } else {
                    const resolved = { ...dragon, attrKey: resolvedAttrKey };
                    dragons.push(resolved);
                    const mult = _calcMult(reserveAttrKr, dragon.type);
                    const buffRes = _findBestSettingForDragon(resolved, infinitePool, virtualAccs, vAllPens, mult);
                    if (buffRes) {
                        candidates.push({ ...buffRes, mult, isReserve: true });
                    }
                }
            });
        }

        candidates.sort((a, b) => b.vval - a.vval);
        const topN = candidates.slice(0, CANDIDATE_COUNT);

        console.group("🛡️ 길드전 최적화 v2 - 2단계 전수탐색");
        console.log(`%c[1단계] 가상 자원 잠재력 Top ${topN.length}명 선발 완료 (예비 제한: ${maxReserve}마리)`, "color: #2980b9; font-weight: bold;");
        topN.forEach((c, i) => console.log(`  ${i+1}. ${c.dN}${c.isReserve ? " [예비]" : ""}${c.isUnlocked ? " [해제]" : ""} (잠재 비벨: ${Math.floor(c.vval).toLocaleString()})`));

        // ===== 2단계: 상한선 가지치기 + 전수탐색 =====
        const n = topN.length;

        // 개별 최적값 사전 계산 (자원 충돌 없는 solo 기준)
        const soloBests = topN.map(c => {
            const dragonObj = dragons.find(d => d.name === c.dN);
            if (!dragonObj) return 0;
            const solo = _findBestSettingForDragon(dragonObj, resPool, resAccs, resPens, c.mult);
            return solo ? solo.vval : 0;
        });

        console.log(`%c[2단계] C(${n},3) 조합 전수탐색 (상한선 가지치기 적용)`, "color: #e67e22; font-weight: bold;");

        let bestTotalVval = -1;
        let bestTeam = null;
        let scenarioCount = 0;
        let prunedCount = 0;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                for (let k = j + 1; k < n; k++) {
                    // 예비 정령 제한 체크
                    const rCount = (topN[i].isReserve?1:0) + (topN[j].isReserve?1:0) + (topN[k].isReserve?1:0);
                    if (rCount > maxReserve) continue;

                    // ★ 상한선 가지치기: 개별 최적값 합이 현재 최고보다 낮으면 스킵
                    const upperBound = soloBests[i] + soloBests[j] + soloBests[k];
                    if (upperBound <= bestTotalVval) { prunedCount++; continue; }

                    const trio = [topN[i], topN[j], topN[k]];
                    for (const perm of PERMS_3) {
                        const ordered = [trio[perm[0]], trio[perm[1]], trio[perm[2]]];
                        const team = _allocateTeam(ordered, dragons, resPool, resAccs, resPens, attrMap);
                        scenarioCount++;

                        if (team.length === 3) {
                            const totalVval = team[0].vval + team[1].vval + team[2].vval;
                            if (totalVval > bestTotalVval) {
                                bestTotalVval = totalVval;
                                bestTeam = team;
                            }
                        }
                    }
                }
            }
        }

        console.log(`%c[완료] ${scenarioCount} 시나리오 실행 / ${prunedCount} 조합 가지치기`, "color: #27ae60; font-weight: bold;");
        if (bestTeam) {
            console.log(`%c최적 팀 총합 비벨: ${Math.floor(bestTotalVval).toLocaleString()}`, "color: #e74c3c; font-weight: bold; font-size: 14px;");
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

            // 버프 프리뷰 자원
            bestTeam.forEach(res => {
                if ((!res.isReserve && !res.isUnlocked) || !res.raw) return;

                const dragonObj = dragons.find(d => d.name === res.dN);
                if (!dragonObj) return;

                const typesToTry = res.isAllType ? ALL_TYPES : [res.dT];

                function bestForBuffSet(buffSet) {
                    let best = {label:"", type:"", vval:0};
                    typesToTry.forEach(type => {
                        buffSet.forEach(b => {
                            const tryDragon = { ...dragonObj, type: type };
                            const r = _findBestSettingForDragon(tryDragon, prevPool, prevAccs, prevPens, b.m);
                            if (r && r.vval > best.vval) best = {label: b.label, type: type, vval: r.vval};
                        });
                    });
                    return best;
                }

                const best2 = bestForBuffSet(BUFF_2);
                const best1 = bestForBuffSet(BUFF_1);

                let best0 = {type:"", vval:0};
                typesToTry.forEach(type => {
                    const tryDragon = { ...dragonObj, type: type };
                    const r = _findBestSettingForDragon(tryDragon, prevPool, prevAccs, prevPens, [0,0,0]);
                    if (r && r.vval > best0.vval) best0 = {type: type, vval: r.vval};
                });

                res.buffPreview = {
                    best2: { label: best2.label, type: best2.type, vval: best2.vval },
                    best1: { label: best1.label, type: best1.type, vval: best1.vval },
                    vval0: best0.vval,
                    type0: best0.type,
                    showType: res.isAllType,
                    isMax: useMaxPreview
                };
            });

            _storage.save("guild_result_state", { buffs: config, results: bestTeam, maxResource: maxResource });
        }
        return bestTeam || [];
    },
        loadSaved: () => _storage.load("guild_result_state")
    };
})();

// DOM 관련 핸들러는 이전과 동일 (results 루프만 처리하도록 유지)
document.addEventListener("DOMContentLoaded", function() {
    const btn = document.getElementById("calc-btn");
    
    function render(results, maxResource) {
        if(!results) return;
        const isMaxResult = (maxResource === "result" || maxResource === "all");
        // 기존 결과창 초기화
        [1,2,3].forEach(i => { if(document.getElementById(`result${i}`)) document.getElementById(`result${i}`).innerHTML = ""; });

        results.forEach((res, i) => {
            const el = document.getElementById(`result${i+1}`);
            if(!el) return;

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
                    • <b>장신구:</b> ${res.accN} (${res.accV}%) / 
                      <span style="color:${getEnchantColor(res.eN)}; font-weight:bold;">
                        ${res.eN}
                      </span><br>
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
                    <span style="font-size:11px; color:#666;">최종 비벨${isMaxResult ? ' <span style="color:#c0392b;">(최대자원)</span>' : ''} </span><br>
                    <b style="font-size:24px; color:#2c3e50; letter-spacing:-0.5px;">${Math.floor(res.vval || 0).toLocaleString()}</b>
                </div>
                ${res.buffPreview ? `
                <div style="text-align:center; font-size:10px; color:#888; line-height:1.7; background:#fef9f0; padding:8px; border-radius:8px; border:1px solid #f0e0c0; margin-bottom:8px;">
                    <span style="color:#e67e22; font-weight:bold;">버프 참고${res.buffPreview.isMax ? ' <span style="font-size:9px; color:#c0392b;">(최대자원)</span>' : ''}</span><br>
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
        if(saved.results) render(saved.results, saved.maxResource);
    }
    if(btn) {
        btn.addEventListener("click", function() {
            const res = ResultEngine.run();
            if(res.length > 0) render(res, document.getElementById("max-resource").value);
            else alert("계산 가능한 드래곤/장비 데이터가 없습니다.");
        });
    }
});
