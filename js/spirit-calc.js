console.log("JS 연결 성공");
let DEBUG_LOG = [];

function log(msg){
    DEBUG_LOG.push(String(msg));
}
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("calcButton").addEventListener("click", runCalc);
});
document.getElementById("spiritDisabled").addEventListener("change", (e) => {
    const spiritUI = document.querySelector(".spirit-ui");
    const spiritOpt = document.getElementById("spiritOptimize");
    if (e.target.checked) {
        spiritUI.classList.add("disabled");
        spiritOpt.disabled = false;
    } else {
        spiritUI.classList.remove("disabled");
        spiritOpt.checked = false;
        spiritOpt.disabled = true;
    }
});

// ===========================
// 정령 전체 조합 사전 생성
// ===========================
function generateAllSpiritCombos() {
    const stats = ["체","공","방"];
    const types = ["%","+"];
    const bonuses = ["체","공","방"];
    const percentMap = [24,28,32,40];
    const plusMap = [54,60,66,120];
    const seen = new Map();
    const result = [];

    for (let s0 = 0; s0 < 3; s0++)
    for (let t0 = 0; t0 < 2; t0++)
    for (let s1 = 0; s1 < 3; s1++)
    for (let t1 = 0; t1 < 2; t1++)
    for (let s2 = 0; s2 < 3; s2++)
    for (let t2 = 0; t2 < 2; t2++)
    for (let s3 = 0; s3 < 3; s3++)
    for (let t3 = 0; t3 < 2; t3++)
    for (let bi = 0; bi < 3; bi++) {
        const plus = [0,0,0], percent = [0,0,0];
        const slots = [[s0,t0],[s1,t1],[s2,t2],[s3,t3]];
        const slotStats = [stats[s0],stats[s1],stats[s2],stats[s3]];
        const slotTypes = [types[t0],types[t1],types[t2],types[t3]];
        for (let i = 0; i < 4; i++) {
            const idx = slots[i][0];
            if (slots[i][1] === 0) { percent[idx] += percentMap[i]; }
            else { let v = plusMap[i]; if (idx === 0) v *= 4; plus[idx] += v; }
        }
        const bonus = bonuses[bi];
        const key = `${plus}|${percent}|${bonus}`;
        if (!seen.has(key)) {
            seen.set(key, true);
            result.push({ plus, percent, bonus, label: slotStats.map((s,i)=>`${s}${slotTypes[i]}`).join(" ")+` 부:${bonus}` });
        }
    }
    return result;
}

const ALL_SPIRIT_COMBOS = generateAllSpiritCombos();
console.log(`정령 고유 조합: ${ALL_SPIRIT_COMBOS.length}개`);

// 고속 Vval 계산 (정령 최적화용, 로그 없음)
function calcVvalFast(combo, spiritStat, bonus) {
    let [hp, atk, def] = dragonBaseStats[combo.type][combo.stat];
    const lvl = combo.gemLevel;
    hp += gemStats.체[lvl] * combo.gems.체 + potion[0];
    atk += gemStats.공[lvl] * combo.gems.공 + potion[1];
    def += gemStats.방[lvl] * combo.gems.방 + potion[2];
    const aP = combo.accessoryOpt, eP = combo.enchantOpt;
    hp = Math.floor(hp * (1 + (aP[0]+eP[0])/100));
    atk = Math.floor(atk * (1 + (aP[1]+eP[1])/100));
    def = Math.floor(def * (1 + (aP[2]+eP[2])/100));
    hp += spiritStat.plus[0]; atk += spiritStat.plus[1]; def += spiritStat.plus[2];
    hp = Math.floor(hp * (1 + spiritStat.percent[0]/100));
    atk = Math.floor(atk * (1 + spiritStat.percent[1]/100));
    def = Math.floor(def * (1 + spiritStat.percent[2]/100));
    if(bonus==="체") hp+=40; else if(bonus==="공") atk+=10; else if(bonus==="방") def+=10;
    hp = Math.floor(hp * (1 + combo.pendantOpt[0]/100));
    atk = Math.floor(atk * (1 + combo.pendantOpt[1]/100));
    def = Math.floor(def * (1 + combo.pendantOpt[2]/100));
    hp += 240; atk += 60; def += 60;
    const bMap = {"체체":["체","체"],"공공":["공","공"],"방방":["방","방"],"체공":["체","공"],"체방":["체","방"],"공방":["공","방"],"체":["체"],"공":["공"],"방":["방"],"버프 없음":[]};
    const bs = bMap[combo.buff] || [];
    const base = dragonBaseStats[combo.type][combo.stat];
    bs.forEach(b => { if(b==="체") hp+=Math.floor(base[0]*0.2); if(b==="공") atk+=Math.floor(base[1]*0.2); if(b==="방") def+=Math.floor(base[2]*0.2); });
    return { stats: { hp, atk, def }, Vval: hp*atk*def };
}

// 1. 체크박스에 따른 컨트롤 활성화 로직
document.getElementById("customPendantEnabled").addEventListener("change", function(e) {
    const isEnabled = e.target.checked;
    
    // 버튼 비활성화 제어
    document.getElementById("btnAddPendant").disabled = !isEnabled;
    document.getElementById("btnRemovePendant").disabled = !isEnabled;
    
    // 컨테이너 시각적 비활성화
    const container = document.getElementById("pendantContainer");
    if (isEnabled) {
        container.classList.remove("disabled-ui");
    } else {
        container.classList.add("disabled-ui");
    }
});

// 2. 팬던트 추가 함수 (원문자 포함)
function addPendant() {
    const container = document.getElementById("pendantContainer");
    const currentCount = container.querySelectorAll(".custom-pendant").length;

    if (currentCount >= 16) {
        alert("최대 16개까지만 추가 가능합니다.");
        return;
    }

    const pendantDiv = document.createElement("div");
    pendantDiv.className = "custom-pendant";
    
    // 원문자 배열 (1~16)
    const circles = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯"];
    const numLabel = circles[currentCount] || (currentCount + 1);

    pendantDiv.innerHTML = `
        <div class="num">${numLabel}</div>
        ${[1, 2, 3].map(() => `
            <div class="option-group">
                <select>
                    <option>선택</option>
                    <option>체력</option>
                    <option>공격</option>
                    <option>방어</option>
                </select>
                <input type="number" min="0" max="18" value="0">
            </div>
        `).join('')}
    `;
    
    container.appendChild(pendantDiv);
    container.scrollTop = container.scrollHeight; // 추가 시 스크롤 아래로
}

// 3. 팬던트 제거 함수
function removePendant() {
    const container = document.getElementById("pendantContainer");
    const pendants = container.querySelectorAll(".custom-pendant");
    if (pendants.length > 1) {
        container.removeChild(pendants[pendants.length - 1]);
    } else {
        alert("최소 1개는 유지해야 합니다.");
    }
}

// 초기 로드 시 실행
document.addEventListener("DOMContentLoaded", () => {
    // 이미 HTML에 1개가 그려져 있지 않다면 실행
    if (document.getElementById("pendantContainer").children.length === 0) {
        addPendant();
    }
});
// ===========================
// 1️⃣ 스탯 테이블
// ===========================
const dragonBaseStats = {
  "체": { "9":[1412,176,176], "8":[1332,176,176], "7":[1252,176,176] },
  "공": { "9":[876,325,161], "8":[876,305,161], "7":[876,285,161] },
  "방": { "9":[788,185,323], "8":[788,185,303], "7":[788,185,283] },
  "체공": { "9":[1160,282,133], "8":[1120,272,133], "7":[1080,262,133] },
  "체방": { "9":[1160,133,282], "8":[1120,133,272], "7":[1080,133,262] },
  "공방": { "9":[720,262,263], "8":[720,252,253], "7":[720,242,243] }
};

const gemStats = {
  체: {36:144,37:148,38:152,39:156,40:160},
  공: {36:36,37:37,38:38,39:39,40:40},
  방: {36:36,37:37,38:38,39:39,40:40}
};

const accessoryStats = {
  18: [[0,18,0],[0,0,18],[18,0,0],[9,0,9],[9,9,0],[0,9,9],[12,0,6],[12,6,0],[6,0,12],[0,6,12],[6,12,0],[0,12,6]],
  19: [[0,19,0],[0,0,19],[19,0,0],[10,0,9],[9,10,0],[0,10,9],[13,0,6],[13,6,0],[6,0,13],[0,6,13],[6,13,0],[0,13,6]],
  20: [[0,20,0],[0,0,20],[20,0,0],[10,0,10],[10,10,0],[0,10,10],[14,0,6],[14,6,0],[6,0,14],[0,6,14],[6,14,0],[0,14,6]]
};

const enchantStats = [
  [21, 0, 0], // 체21%
  [0, 21, 0], // 공21%
  [0, 0, 21]  // 방21%
];

const pendantStats = {
  "달":[[6,6,0],[6,0,6],[0,6,6],[12,0,0],[0,12,0],[0,0,12]],
  "태양":[[18,0,0],[0,18,0],[0,0,18],[12,6,0],[12,0,6],[6,12,0],[0,12,6],[6,0,12],[0,6,12],[6,6,6]]
};

const collection = [240,60,60];
const potion = [24,6,6];

const BUFF_2SET = ["체체","공공","방방","체공","체방","공방"];
const BUFF_1SET = ["체","공","방"];

function getMinStats(){
    return {
        hp:  parseInt(document.getElementById("minHP")?.value || 0),
        atk: parseInt(document.getElementById("minATK")?.value || 0),
        def: parseInt(document.getElementById("minDEF")?.value || 0)
    };
}

// ===========================
// 2️⃣ 정령 계산
// ===========================
function calcSpiritStats(spirit){
    const plus = [0,0,0];
    const percent = [0,0,0];

    const percentMap = [24,28,32,40];
    const plusMap = [54,60,66,120];

    for(let i=0;i<4;i++){
        const s = spirit.stats[i];
        const t = spirit.types[i];

        let idx = s==="체" ? 0 : s==="공" ? 1 : 2;

        if(t==="%"){
            percent[idx] += percentMap[i];
        }else{
            let v = plusMap[i];
            if(s==="체") v *= 4;
            plus[idx] += v;
        }
    }
    return { plus, percent };
}


// ===========================
// 젬 5개 조합
// ===========================
function generateGemDistributions(total = 5){
    const results = [];
    for(let 체=0; 체<=total; 체++){
        for(let 공=0; 공<=total-체; 공++){
            const 방 = total - 체 - 공;
            results.push({체, 공, 방});
        }
    }
    return results;
}

function getCustomPendantOptions(){
    const result = [];

    document.querySelectorAll(".custom-pendant").forEach(box=>{
        let opt = [0,0,0]; // 체, 공, 방

        box.querySelectorAll(".option-group").forEach(group=>{
            const stat = group.querySelector("select")?.value;
            const val = parseInt(group.querySelector("input")?.value || 0);

            if(!stat || stat==="선택" || val<=0) return;

            if(stat==="체력") opt[0] += val;
            if(stat==="공격") opt[1] += val;
            if(stat==="방어") opt[2] += val;
        });

        if(opt[0] || opt[1] || opt[2]){
            result.push(opt);
        }
    });

    return result; // [[체,공,방], ...]
}

// ===========================
// 3️⃣ UI 옵션 읽기
// ===========================
function gatherOptions(customPendantOn){
    const optionPool = [];

    // 🔹 용 타입
    const typeValue = document.querySelector(".dragon-type")?.value;
    if (!typeValue) throw new Error("용 타입 선택 안 됨");

    const types = typeValue === "전체"
        ? ["체","공","방","체공","체방","공방"]
        : [typeValue];

    // 🔹 용 스탯 (9 / 8 / 7)
    const statValue = document.querySelector(".dragon-stat")?.value;
    if (!statValue) throw new Error("용 스탯 선택 안 됨");
    const dragonStats = [statValue];

// 🔹 젬 레벨
const gemLevel = parseInt(
    document.querySelector(".gem-select")?.value
);
if (!gemLevel) throw new Error("젬 레벨 선택 안 됨");

// 🔹 젬 분배 (🔥 이 줄이 빠져 있었음)
const gemDistributions = generateGemDistributions(5);

    // 🔹 장신구
    const accRaw = document.querySelector(".accessory-select")?.value;
    if (!accRaw) throw new Error("장신구 선택 안 됨");
    const accessories = [parseInt(accRaw)];

    // 🔹 팬던트
let pendants = [];
let pendantOptionsMap = {};

// 🔹 기본 팬던트
const basePendant = document.querySelector(".pendant-select")?.value;
if(!basePendant) throw new Error("팬던트 선택 안 됨");

pendants.push(basePendant);
pendantOptionsMap[basePendant] = pendantStats[basePendant];

// 🔹 커스텀 팬던트 추가
if(customPendantOn){
    const customOpts = getCustomPendantOptions();

    customOpts.forEach((opt, i)=>{
        const name = `커스텀${i+1}`;
        pendants.push(name);
        pendantOptionsMap[name] = [opt]; // 단일 옵션
    });
}

    // 🔹 버프
const buffMode = document.getElementById("buffMode")?.value ?? "버프 없음";

let buffs = [];

switch(buffMode){
    case "최적화 (2벞)":
        // 2벞 + 1벞 + 버프 없음 모두 포함
        buffs = [...BUFF_2SET, ...BUFF_1SET, "버프 없음"];
        break;

    case "1벞 최적화":
        // 1벞 + 버프 없음 포함
        buffs = [...BUFF_1SET, "버프 없음"];
        break;

    case "버프 없음":
        buffs = ["버프 없음"];
        break;

    default:
        // 특정 버프(예: 체체) 직접 선택 시 그것만 계산
        buffs = [buffMode];
}


    // 🔹 옵션 풀 생성
types.forEach(type=>{
    dragonStats.forEach(stat=>{
        gemDistributions.forEach(gems=>{
            accessories.forEach(accLv=>{
    accessoryStats[accLv].forEach(accOpt=>{
            enchantStats.forEach(enchantOpt=>{
        pendants.forEach(pName=>{
pendantOptionsMap[pName].forEach(pOpt=>{
                buffs.forEach(buff=>{
                    optionPool.push({
                        type,
                        stat,
                        gems,
                        gemLevel,
                        accessoryLv: accLv,
                        accessoryOpt: accOpt,   // ← 배열 [체%,공%,방%]
                        enchantOpt: enchantOpt ?? [0,0,0], 
                        pendant: pName,
                        pendantOpt: pOpt,       // ← 배열 [체%,공%,방%]
                        buff
                    });
                });
            });
            });
        });
    });
});
        });
    });
});
    return optionPool;
}


// ===========================
// 정령 UI 입력 읽기
// ===========================
function getSpiritFromUI() {
    const stats = Array.from(document.querySelectorAll(".spirit-stat"))
        .map(el => el.value);

    const types = Array.from(document.querySelectorAll(".spirit-type"))
        .map(el => el.value);

    const bonus = document.getElementById("spirit-bonus")?.value || "";

    if (stats.length !== 4 || types.length !== 4) {
        throw new Error("정령 옵션 4개를 모두 선택해야 합니다.");
    }

    return {
        stats,   // ["체","방","방","공"]
        types,   // ["+","%","%","+"]
        bonus    // "체" | "공" | "방"
    };
}

function formatBuff(buff){
    if(buff === "버프 없음") return "-";

    const count = buff.length / 1; // 체체 = 2
    return buff.split("").join("+") + ` (${count*20}%)`;
}

function formatPercent(opt){
    return [
        opt[0] ? `체${opt[0]}%` : null,
        opt[1] ? `공${opt[1]}%` : null,
        opt[2] ? `방${opt[2]}%` : null
    ].filter(Boolean).join("+");
}

function formatGems(g){
    return `체${g.체} 공${g.공} 방${g.방}`;
}


function passMinStat(result, min){
    if(!result || !result.stats) return false;
    return (
        result.stats.hp  >= min.hp &&
        result.stats.atk >= min.atk &&
        result.stats.def >= min.def
    );
}

// ===========================
// 4️⃣ Vval 계산
// ===========================
function calcVval(combo, spirit){
        if(!combo.accessoryOpt || !combo.pendantOpt){
        throw new Error("옵션 누락: accessoryOpt / pendantOpt");
    }
    
    let [base체, base공, base방] = dragonBaseStats[combo.type][combo.stat];
    let log = [];
    log.push(`용 기본 스탯: 체${base체}, 공${base공}, 방${base방}`);

    // 1️⃣ 젬 적용
const lvl = combo.gemLevel;

base체 += gemStats.체[lvl] * combo.gems.체;
base공 += gemStats.공[lvl] * combo.gems.공;
base방 += gemStats.방[lvl] * combo.gems.방;
log.push(
  `젬 적용 (Lv.${combo.gemLevel}) ` +
  `체${combo.gems.체}, 공${combo.gems.공}, 방${combo.gems.방} → ` +
  `체${base체}, 공${base공}, 방${base방}`
);

    // 2️⃣ 물약 적용
    base체 += potion[0];
    base공 += potion[1];
    base방 += potion[2];
    log.push(`물약 적용 → 체${base체}, 공${base공}, 방${base방}`);

    // 3️⃣ 장신구 적용 (%계산)
log.push(
  `장신구 선택: ${combo.accessoryLv}% ` +
  `[체${combo.accessoryOpt[0]}%, 공${combo.accessoryOpt[1]}%, 방${combo.accessoryOpt[2]}%]`
);
const accPct = combo.accessoryOpt ?? [0,0,0];
const enchPct = combo.enchantOpt ?? [0,0,0];


log.push(
  `장신구: [체${accPct[0]}%, 공${accPct[1]}%, 방${accPct[2]}%]`
);
log.push(
  `인챈트: [체${enchPct[0]}%, 공${enchPct[1]}%, 방${enchPct[2]}%]`
);

base체 = Math.floor(base체 * (1 + (accPct[0] + enchPct[0]) / 100));
base공 = Math.floor(base공 * (1 + (accPct[1] + enchPct[1]) / 100));
base방 = Math.floor(base방 * (1 + (accPct[2] + enchPct[2]) / 100));

log.push(`장신구+인챈트 적용 → 체${base체}, 공${base공}, 방${base방}`);


    // 4️⃣ 정령 적용 (+/%)
const isSpiritDisabled = document.getElementById("spiritDisabled")?.checked;

// 체크되었으면 모든 값을 0으로, 아니면 원래 계산식 적용
const spiritStat = isSpiritDisabled 
    ? { plus: [0, 0, 0], percent: [0, 0, 0] } 
    : calcSpiritStats(spirit);

if (isSpiritDisabled) {
    log.push("정령 사용 안 함 (스탯 반영 제외)");
} else {
    log.push(`정령 입력: ${spirit.stats.map((s,i)=>`${s}${spirit.types[i]}`).join(", ")} / 부가옵: ${spirit.bonus}`);
    log.push(`정령 + → 체+${spiritStat.plus[0]}, 공+${spiritStat.plus[1]}, 방+${spiritStat.plus[2]}`);
    log.push(`정령 % → 체${spiritStat.percent[0]}%, 공${spiritStat.percent[1]}%, 방${spiritStat.percent[2]}%`);
}

// 스탯 합산 부분
base체 += spiritStat.plus[0];
base공 += spiritStat.plus[1];
base방 += spiritStat.plus[2];

base체 = Math.floor(base체 * (1 + spiritStat.percent[0]/100));
base공 = Math.floor(base공 * (1 + spiritStat.percent[1]/100));
base방 = Math.floor(base방 * (1 + spiritStat.percent[2]/100));

// 정령 부가옵션 (체40, 공10, 방10) - 체크 안 되었을 때만 적용
if (!isSpiritDisabled) {
    if(spirit.bonus==="체") base체 += 40;
    if(spirit.bonus==="공") base공 += 10;
    if(spirit.bonus==="방") base방 += 10;
    log.push(`정령 부가옵 적용 → 체${base체}, 공${base공}, 방${base방}`);
}
    // 5️⃣ 팬던트 적용 (%)
log.push(
  `팬던트 선택: ${combo.pendant} ` +
  `[체${combo.pendantOpt[0]}%, 공${combo.pendantOpt[1]}%, 방${combo.pendantOpt[2]}%]`
);

base체 = Math.floor(base체 * (1 + combo.pendantOpt[0] / 100));
base공 = Math.floor(base공 * (1 + combo.pendantOpt[1] / 100));
base방 = Math.floor(base방 * (1 + combo.pendantOpt[2] / 100));

log.push(`팬던트 적용 → 체${base체}, 공${base공}, 방${base방}`);


    // 6️⃣ 컬렉션 적용 (마지막)
    base체 += collection[0]; base공 += collection[1]; base방 += collection[2];
    log.push(`컬렉션 적용 → 체${base체}, 공${base공}, 방${base방}`);

    // 7️⃣ 버프 적용
    const buffMap = {
        "체체":["체","체"], "공공":["공","공"], "방방":["방","방"],
        "체공":["체","공"], "체방":["체","방"], "공방":["공","방"],
        "체":["체"], "공":["공"], "방":["방"], "버프 없음":[]
    };
    if(combo.buff && combo.buff in buffMap){
        buffMap[combo.buff].forEach(b=>{
            if(b==="체"){ const v=Math.floor(dragonBaseStats[combo.type][combo.stat][0]*0.2); base체+=v; log.push(`버프 체+${v}`);}
            if(b==="공"){ const v=Math.floor(dragonBaseStats[combo.type][combo.stat][1]*0.2); base공+=v; log.push(`버프 공+${v}`);}
            if(b==="방"){ const v=Math.floor(dragonBaseStats[combo.type][combo.stat][2]*0.2); base방+=v; log.push(`버프 방+${v}`);}
        });
    }

    const Vval = base체*base공*base방;
return {
    type: combo.type,
    buff: combo.buff,
    pendantOpt: combo.pendantOpt,
    gemLevel: combo.gemLevel,
    gems: combo.gems,
    accessoryOpt: combo.accessoryOpt,
    enchant: combo.enchantOpt ?? [0,0,0],

    stats: {
        hp: base체,
        atk: base공,
        def: base방
    },

    Vval: base체 * base공 * base방
};
}

// ===========================
// 5️⃣ 중복 제거
// ===========================
function dedupeResults(results, options) {
    const keys = [];
    if (options.type) keys.push("type");
    if (options.buff) keys.push("buff");
    
    // 💡 이 부분이 핵심입니다!
    // 기존: item.pendant (이름만 체크)
    // 변경: item.pendantOpt (체/공/방 % 수치 배열을 체크)
    if (options.pendant) keys.push("pendantOpt"); 
    
    if (options.accessory) keys.push("accessoryOpt");
    if (options.spirit) keys.push("spiritKey");

    if (keys.length === 0) return results;

    const map = new Map();

    results.forEach(item => {
        const key = keys.map(k => {
            if (k === "accessoryOpt") return item.accessoryOpt.join(",");
            // 팬던트 옵션 배열([12,6,0] 등)을 문자열로 변환하여 고유 키로 생성
            if (k === "pendantOpt") return item.pendantOpt.join(","); 
            return item[k];
        }).join("|");

        if (!map.has(key) || item.Vval > map.get(key).Vval) {
            map.set(key, item);
        }
    });

    return Array.from(map.values());
}

function dedupeBy(array, key){
    const map = new Map();
    array.forEach(item=>{
        let mapKey = key === "accessoryOpt" ? item[key].join(",") : item[key];
        if(!map.has(mapKey) || item.Vval > map.get(mapKey).Vval){
            map.set(mapKey, item);
        }
    });
    return Array.from(map.values());
}


function dedupeBy(array,key){
    const map=new Map();
    array.forEach(item=>{
        if(!map.has(item[key]) || item.Vval>map.get(item[key]).Vval){
            map.set(item[key],item);
        }
    });
    return Array.from(map.values());
}


function center(text, width){
    text = String(text);
    const w = displayWidth(text);
    if(w >= width) return text;

    const pad = width - w;
    const left = Math.floor(pad / 2);
    const right = pad - left;

    return " ".repeat(left) + text + " ".repeat(right);
}
function displayWidth(str){
    let w = 0;
    for(const ch of String(str)){
        // 한글, 한자, 전각 문자 → 2칸
        if(/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(ch)) w += 2;
        else w += 1;
    }
    return w;
}

const COL = {
    type: 4,      // 체 / 체공
    buff: 8,     // 공+공 (40%)
    pendant: 10,  // 체12%
    gemLv: 4,     // Lv37
    gems: 10,     // 체1 공0 방4
    acc: 10,      // 체6%+방13%
    ench: 6,      // 체21%
    vval: 12,     // 799,472,640
    hp: 4,
    atk: 4,
    def: 4
};

function formatRow(b){
    return [
        center(b.type, COL.type),
        center(formatBuff(b.buff), COL.buff),
        center(formatPercent(b.pendantOpt), COL.pendant),
        center(`Lv${b.gemLevel}`, COL.gemLv),
        center(formatGems(b.gems), COL.gems),
        center(formatPercent(b.accessoryOpt), COL.acc),
        center(
            b.enchant && b.enchant.some(v=>v>0)
                ? formatPercent(b.enchant)
                : "-",
            COL.ench
        ),
        center(b.Vval.toLocaleString(), COL.vval),
        center(b.stats.hp, COL.hp),
        center(b.stats.atk, COL.atk),
        center(b.stats.def, COL.def)
    ].join(" | ");
}


// ===========================
// 6️⃣ 실행
// ===========================
function runCalc(){
    try {
        const spirit = getSpiritFromUI();
        const spiritOptOn = document.getElementById("spiritOptimize")?.checked && document.getElementById("spiritDisabled")?.checked;
        const optionPool = gatherOptions(document.getElementById("customPendantEnabled").checked);
        const minStats = getMinStats();
        let results = [];

        if (spiritOptOn) {
            // 1단계: 정령 없이 계산 → Top 1000
            const zeroSpirit = { stats:["체","체","체","체"], types:["%","%","%","%"], bonus:"체" };
            optionPool.forEach(c => {
                const r = calcVval(c, zeroSpirit);
                results.push({...c, ...r});
            });
            results.sort((a,b) => b.Vval - a.Vval);
            const top1000 = results.slice(0, 1000);

            // 2단계: Top 1000에서 최적 정령 탐색
            results = [];
            top1000.forEach(c => {
                let bestVval = 0, bestSpirit = null, bestStats = null;
                for (let si = 0; si < ALL_SPIRIT_COMBOS.length; si++) {
                    const sp = ALL_SPIRIT_COMBOS[si];
                    const r = calcVvalFast(c, sp, sp.bonus);
                    if (r.Vval > bestVval) {
                        bestVval = r.Vval;
                        bestSpirit = sp;
                        bestStats = r;
                    }
                }
                if (bestSpirit && passMinStat(bestStats, minStats)) {
                    results.push({
                        ...c,
                        Vval: bestVval,
                        stats: bestStats.stats,
                        spiritLabel: bestSpirit.label,
                        spiritKey: `${bestSpirit.plus}|${bestSpirit.percent}|${bestSpirit.bonus}`
                    });
                }
            });
        } else {
            optionPool.forEach((c) => {
                const r = calcVval(c, spirit);
                if(passMinStat(r, minStats)) results.push({...c, ...r});
            });
        }

        if(results.length === 0) throw new Error("조건에 맞는 결과가 없습니다.");

        const dedupeOptions = {
            type: document.getElementById("dedupeType")?.checked,
            buff: document.getElementById("dedupeBuff")?.checked,
            pendant: document.getElementById("dedupePendant")?.checked,
            accessory: document.getElementById("dedupeAccessory")?.checked,
            spirit: document.getElementById("dedupeSpirit")?.checked
        };

        let filteredResults = dedupeResults(results, dedupeOptions);
        filteredResults.sort((a,b)=>b.Vval - a.Vval);
        const topN = filteredResults.slice(0, 200);
        const bottomN = filteredResults.slice(-50).reverse();

        const thRow = `<th>타입</th><th>버프</th><th>팬던트</th><th>젬Lv</th><th>젬분배</th><th>장신구</th><th>인챈</th>${spiritOptOn ? "<th>정령</th>" : ""}<th>Vval</th><th>HP</th><th>ATK</th><th>DEF</th>`;

        function makeRow(b) {
            const spiritTd = spiritOptOn ? `<td style="font-size:11px;">${b.spiritLabel || "-"}</td>` : "";
            return `<td>${b.type}</td>
                <td>${formatBuff(b.buff)}</td>
                <td>${formatPercent(b.pendantOpt)}</td>
                <td>${b.gemLevel}</td>
                <td>${formatGems(b.gems)}</td>
                <td>${formatPercent(b.accessoryOpt)}</td>
                <td>${b.enchant.some(v=>v>0) ? formatPercent(b.enchant) : "-"}</td>
                ${spiritTd}
                <td class="vval">${b.Vval.toLocaleString()}</td>
                <td class="hp">${b.stats.hp}</td>
                <td class="atk">${b.stats.atk}</td>
                <td class="def">${b.stats.def}</td>`;
        }

        // 표 그리기
        const resultArea = document.querySelector(".result-area");
        resultArea.innerHTML = `
            <h2>결과 (상위 ${topN.length}개)</h2>
            <div class="table-wrapper"><table id="resTable"><thead><tr>${thRow}</tr></thead><tbody id="resBody"></tbody></table></div>
            <h2 style="margin-top:40px; color:#c0392b;">하위 ${bottomN.length}개</h2>
            <div class="table-wrapper"><table><thead><tr>${thRow}</tr></thead><tbody id="resBotBody"></tbody></table></div>`;

        const resBody = document.getElementById("resBody");
        topN.forEach(b => { const row = document.createElement("tr"); row.innerHTML = makeRow(b); resBody.appendChild(row); });

        const resBotBody = document.getElementById("resBotBody");
        bottomN.forEach(b => { const row = document.createElement("tr"); row.innerHTML = makeRow(b); resBotBody.appendChild(row); });
    } catch(e) {
        alert(e.message);
    }
}