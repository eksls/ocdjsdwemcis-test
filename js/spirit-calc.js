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

// x에 p% 를 더하고 버림 (정수 연산이라 부동소수 오차 없음: 100×1.13 이 112로 깎이던 문제 수정)
function pctUp(x, p) { return x + Math.floor(x * p / 100); }

// 고속 Vval 계산 (정령 최적화용, 로그 없음)
function calcVvalFast(combo, spiritStat, bonus) {
    let [hp, atk, def] = dragonBaseStats[combo.type][combo.stat];
    const lvl = combo.gemLevel;
    hp += gemStats.체[lvl] * combo.gems.체 + potion[0];
    atk += gemStats.공[lvl] * combo.gems.공 + potion[1];
    def += gemStats.방[lvl] * combo.gems.방 + potion[2];
    const aP = combo.accessoryOpt, eP = combo.enchantOpt;
    hp = pctUp(hp, aP[0]+eP[0]);
    atk = pctUp(atk, aP[1]+eP[1]);
    def = pctUp(def, aP[2]+eP[2]);
    hp += spiritStat.plus[0]; atk += spiritStat.plus[1]; def += spiritStat.plus[2];
    hp = pctUp(hp, spiritStat.percent[0]);
    atk = pctUp(atk, spiritStat.percent[1]);
    def = pctUp(def, spiritStat.percent[2]);
    if(bonus==="체") hp+=40; else if(bonus==="공") atk+=10; else if(bonus==="방") def+=10;
    hp = pctUp(hp, combo.pendantOpt[0]);
    atk = pctUp(atk, combo.pendantOpt[1]);
    def = pctUp(def, combo.pendantOpt[2]);
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
    const rm = document.getElementById("btnRemovePendant"); if (rm) rm.disabled = !isEnabled;
    
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
        <button type="button" class="pendant-del" aria-label="이 팬던트 지우기">✕</button>
    `;
    // 아무 칸이나 지우기 (마지막 한 칸은 값만 비움)
    pendantDiv.querySelector(".pendant-del").addEventListener("click", () => {
        const all = container.querySelectorAll(".custom-pendant");
        if (all.length > 1) pendantDiv.remove();
        else pendantDiv.querySelectorAll(".option-group").forEach(g => { g.querySelector("select").selectedIndex = 0; g.querySelector("input").value = 0; });
        renumberPendants();
    });
    
    container.appendChild(pendantDiv);
    container.scrollTop = container.scrollHeight; // 추가 시 스크롤 아래로
}

function renumberPendants() {
    const circles = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯"];
    document.querySelectorAll("#pendantContainer .custom-pendant .num").forEach((n, i) => { n.textContent = circles[i] || (i + 1); });
}

// 3. 팬던트 제거 함수 (맨 뒤 칸)
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
  "체": {
    "20": [2292, 176, 176], // 1572 + (9 * 80)
    "17": [2052, 176, 176], // 1572 + (6 * 80)
    "11": [1572, 176, 176], "10": [1492, 176, 176], "9": [1412, 176, 176], "8": [1332, 176, 176], "7": [1252, 176, 176]
  },
  "공": {
    "20": [876, 545, 161],  // 365 + (9 * 20)
    "17": [876, 485, 161],  // 365 + (6 * 20)
    "11": [876, 365, 161], "10": [876, 345, 161], "9": [876, 325, 161], "8": [876, 305, 161], "7": [876, 285, 161]
  },
  "방": {
    "20": [788, 185, 543],  // 363 + (9 * 20)
    "17": [788, 185, 483],  // 363 + (6 * 20)
    "11": [788, 185, 363], "10": [788, 185, 343], "9": [788, 185, 323], "8": [788, 185, 303], "7": [788, 185, 283]
  },
  "체공": {
    "20": [1600, 392, 133], // 1240 + (9 * 40), 302 + (9 * 10)
    "17": [1480, 362, 133], // 1240 + (6 * 40), 302 + (6 * 10)
    "11": [1240, 302, 133], "10": [1200, 292, 133], "9": [1160, 282, 133], "8": [1120, 272, 133], "7": [1080, 262, 133]
  },
  "체방": {
    "20": [1600, 133, 392], // 위와 동일한 로직
    "17": [1480, 133, 362],
    "11": [1240, 133, 302], "10": [1200, 133, 292], "9": [1160, 133, 282], "8": [1120, 133, 272], "7": [1080, 133, 262]
  },
  "공방": {
    "20": [720, 372, 373], // 282 + 90, 283 + 90
    "17": [720, 342, 343], // 282 + 60, 283 + 60
    "11": [720, 282, 283], "10": [720, 272, 273], "9": [720, 262, 263], "8": [720, 252, 253], "7": [720, 242, 243]
  }
};

const gemStats = {
  체: {36:144,37:148,38:152,39:156,40:160,42:168,44:176},
  공: {36:36,37:37,38:38,39:39,40:40,42:42,44:44},
  방: {36:36,37:37,38:38,39:39,40:40,42:42,44:44}
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
  "없음":[[0,0,0]],
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

base체 = pctUp(base체, accPct[0] + enchPct[0]);
base공 = pctUp(base공, accPct[1] + enchPct[1]);
base방 = pctUp(base방, accPct[2] + enchPct[2]);

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

base체 = pctUp(base체, spiritStat.percent[0]);
base공 = pctUp(base공, spiritStat.percent[1]);
base방 = pctUp(base방, spiritStat.percent[2]);

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

base체 = pctUp(base체, combo.pendantOpt[0]);
base공 = pctUp(base공, combo.pendantOpt[1]);
base방 = pctUp(base방, combo.pendantOpt[2]);

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
function dedupeResults(results, options, scoreFn) {
    const sc = scoreFn || (r => r.Vval);
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

        const prev = map.get(key);
        if (!prev || sc(item) > sc(prev) || (sc(item) === sc(prev) && item.Vval > prev.Vval)) {
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
// 정령 최적화 (정확해)
// ===========================
// 정령 슬롯 4칸은 각각 (체/공/방) × (+/%) 중 하나, 부가옵은 체/공/방 중 하나.
// 핵심: "어느 슬롯을 어느 스탯에 줄지"가 정해지면, 각 스탯 안에서 +/% 선택은 그 스탯 값만 바꾸므로
//       스탯별로 따로 최대화하면 된다 (곱의 각 항이 양수이고 서로 독립).
//   → 슬롯 배정 3^4 = 81가지 × 부가옵 3가지 = 243가지만 보면 3,834가지 정령 전부를 본 것과 같다.
// 최소 스탯 조건도 스탯별 조건이라 그대로 정확히 적용된다.
// 모든 장비 옵션에 대해 이 계산을 하므로 (상위 1000개 자르기 없음) 결과 표 전체가 정확한 값이다.
const SPIRIT_PCT_MAP = [24, 28, 32, 40];
const SPIRIT_PLUS_MAP = [54, 60, 66, 120];
const SPIRIT_BONUS_ADD = [40, 10, 10];
const STAT_KR = ["체", "공", "방"];
// 81가지 슬롯 배정: owner[i] = 슬롯 i 를 받는 스탯, mask[s] = 스탯 s 가 받는 슬롯들
const SLOT_ASSIGNMENTS = (() => {
    const out = [];
    for (let c = 0; c < 81; c++) {
        const owner = [], mask = [0, 0, 0];
        let q = c;
        for (let i = 0; i < 4; i++) { const st = q % 3; q = Math.floor(q / 3); owner.push(st); mask[st] |= (1 << i); }
        out.push({ owner, mask });
    }
    return out;
})();

function optimizeSpiritExact(optionPool, minStats) {
    const mins = [minStats.hp || 0, minStats.atk || 0, minStats.def || 0];
    // 스탯 하나의 (정령 전 값, 팬던트%, 버프 추가값)이 같으면 표를 공유
    const tableCache = new Map();
    function statTable(s, x, pen, buffAdd) {
        const key = s + "|" + x + "|" + pen + "|" + buffAdd;
        let t = tableCache.get(key);
        if (t) return t;
        // t.val[b][mask] = 그 스탯이 mask 슬롯들을 받고 부가옵(b)일 때 최대 스탯, t.typ[b][mask] = 그때 +/% 선택(비트=1 이면 +)
        t = { val: [new Array(16), new Array(16)], typ: [new Array(16), new Array(16)] };
        for (let b = 0; b < 2; b++) for (let m = 0; m < 16; m++) {
            let best = -1, bestT = 0;
            for (let tp = 0; tp < 16; tp++) {
                if ((tp & ~m) !== 0) continue;           // mask 밖 슬롯은 무시
                let plus = 0, pct = 0;
                for (let i = 0; i < 4; i++) if (m & (1 << i)) {
                    if (tp & (1 << i)) plus += SPIRIT_PLUS_MAP[i] * (s === 0 ? 4 : 1); else pct += SPIRIT_PCT_MAP[i];
                }
                let v = pctUp(x + plus, pct);
                if (b) v += SPIRIT_BONUS_ADD[s];
                v = pctUp(v, pen) + collection[s] + buffAdd;
                if (v > best) { best = v; bestT = tp; }
            }
            t.val[b][m] = best >= mins[s] ? best : -1;  // 최소 스탯 미달이면 불가
            t.typ[b][m] = bestT;
        }
        t.id = tableCache.size;
        tableCache.set(key, t);
        return t;
    }
    // 세 스탯 표가 주어졌을 때: 슬롯 배정 81가지 × 부가옵 3가지 중 최대
    function bestSpiritFor(tabs) {
        let best = -1, bestA = null, bestB = -1;
        for (const a of SLOT_ASSIGNMENTS) {
            for (let bs = 0; bs < 3; bs++) {
                const h = tabs[0].val[bs === 0 ? 1 : 0][a.mask[0]], at = tabs[1].val[bs === 1 ? 1 : 0][a.mask[1]], d = tabs[2].val[bs === 2 ? 1 : 0][a.mask[2]];
                if (h < 0 || at < 0 || d < 0) continue;
                const v = h * at * d;
                if (v > best) { best = v; bestA = a; bestB = bs; }
            }
        }
        return { best, bestA, bestB };
    }
    const tripleMemo = new Map();
    const BUFF_LIST = {"체체":["체","체"],"공공":["공","공"],"방방":["방","방"],"체공":["체","공"],"체방":["체","방"],"공방":["공","방"],"체":["체"],"공":["공"],"방":["방"],"버프 없음":[]};
    const results = [];
    for (const c of optionPool) {
        const base = dragonBaseStats[c.type][c.stat];
        const gemAdd = [gemStats.체[c.gemLevel] * c.gems.체, gemStats.공[c.gemLevel] * c.gems.공, gemStats.방[c.gemLevel] * c.gems.방];
        const buffAdd = [0, 0, 0];
        (BUFF_LIST[c.buff] || []).forEach(b => { const si = STAT_KR.indexOf(b); buffAdd[si] += Math.floor(base[si] * 0.2); });
        const tabs = [0, 1, 2].map(s => statTable(s, pctUp(base[s] + gemAdd[s] + potion[s], c.accessoryOpt[s] + c.enchantOpt[s]), c.pendantOpt[s], buffAdd[s]));
        // 세 스탯 표 조합이 같은 옵션은 최적 정령도 같으므로 재사용
        const memoKey = tabs[0].id + "," + tabs[1].id + "," + tabs[2].id;
        let memo = tripleMemo.get(memoKey);
        if (!memo) { memo = bestSpiritFor(tabs); tripleMemo.set(memoKey, memo); }
        const best = memo.best, bestA = memo.bestA, bestB = memo.bestB;
        if (best < 0) continue;  // 최소 스탯을 만족하는 정령이 없음
        // 정령 구성 복원 (슬롯 순서대로)
        const plus = [0, 0, 0], percent = [0, 0, 0], label = [];
        for (let i = 0; i < 4; i++) {
            const st = bestA.owner[i];
            const typ = tabs[st].typ[st === bestB ? 1 : 0][bestA.mask[st]];
            const isPlus = (typ & (1 << i)) !== 0;
            if (isPlus) plus[st] += SPIRIT_PLUS_MAP[i] * (st === 0 ? 4 : 1); else percent[st] += SPIRIT_PCT_MAP[i];
            label.push(STAT_KR[st] + (isPlus ? "+" : "%"));
        }
        const stats = {
            hp: tabs[0].val[bestB === 0 ? 1 : 0][bestA.mask[0]],
            atk: tabs[1].val[bestB === 1 ? 1 : 0][bestA.mask[1]],
            def: tabs[2].val[bestB === 2 ? 1 : 0][bestA.mask[2]]
        };
        results.push({
            ...c, Vval: best, stats,
            enchant: c.enchantOpt ?? [0, 0, 0],
            spiritLabel: label.join(" ") + ` 부:${STAT_KR[bestB]}`,
            spiritKey: label.join(" ") + ` 부:${STAT_KR[bestB]}`
        });
    }
    return results;
}


// ===========================
// 정령별 최고 세팅 (중복 제거: 정령 을 켰을 때)
// ===========================
// 정령 배치(슬롯 1~4 의 스탯·종류 + 부가옵) 3,888가지 각각에 대해 가장 좋은 장비 세팅을 찾는다.
// "옵션마다 가장 좋은 정령 1개"만 남기는 방식과 달리, 단막·유막처럼 1등을 못 하는 정령도 각자의 최고값으로 나온다.
// 상위 limit 개만 필요하므로, 그 안에 못 드는 장비 옵션(그 옵션의 최고 정령값이 현재 limit 번째보다 낮음)은 건너뛴다 — 결과는 정확.
const SPIRIT_ARRANGEMENTS = (() => {
    const out = [];
    const pow3 = [1, 3, 9, 27];
    for (let c = 0; c < 6 ** 4; c++) {
        const st = [], tp = [];
        let q = c;
        for (let i = 0; i < 4; i++) { const ch = q % 6; q = Math.floor(q / 6); st.push(ch % 3); tp.push(ch < 3 ? 1 : 2); } // 1 = %, 2 = +
        for (let bs = 0; bs < 3; bs++) {
            const idx = [0, 1, 2].map(s => {
                let sig = 0;
                for (let i = 0; i < 4; i++) if (st[i] === s) sig += tp[i] * pow3[i];
                return sig + (bs === s ? 81 : 0);
            });
            const label = st.map((x, i) => STAT_KR[x] + (tp[i] === 1 ? "%" : "+")).join(" ") + ` 부:${STAT_KR[bs]}`;
            out.push({ idx, label });
        }
    }
    return out;
})();

// scaleFn(rep) : 순위 점수 = 비벨 × scaleFn (기본 1 = 비벨 순). rep.ub 는 그 장비에서 가장 좋은 정령의 비벨
function optimizeSpiritPerArrangement(optionPool, minStats, otherKeyFn, limit, scaleFn) {
    const scaleOf = scaleFn || (() => 1);
    const mins = [minStats.hp || 0, minStats.atk || 0, minStats.def || 0];
    const BUFF_LIST = {"체체":["체","체"],"공공":["공","공"],"방방":["방","방"],"체공":["체","공"],"체방":["체","방"],"공방":["공","방"],"체":["체"],"공":["공"],"방":["방"],"버프 없음":[]};
    // 스탯 하나의 값 표: 162칸 = (그 스탯이 받는 슬롯 배치 81가지) × (부가옵 여부 2). 최소 스탯 미달은 -1
    const tables = new Map();
    function table(s, x, pen, buffAdd) {
        const key = s + "|" + x + "|" + pen + "|" + buffAdd;
        let t = tables.get(key);
        if (t) return t;
        const val = new Float64Array(162), best = new Float64Array(32); // best[b*16+mask] = 그 슬롯들로 낼 수 있는 최대
        best.fill(-1);
        for (let b = 0; b < 2; b++) for (let sig = 0; sig < 81; sig++) {
            let q = sig, plus = 0, pct = 0, mask = 0;
            for (let i = 0; i < 4; i++) {
                const code = q % 3; q = Math.floor(q / 3);
                if (code === 1) { pct += SPIRIT_PCT_MAP[i]; mask |= 1 << i; }
                else if (code === 2) { plus += SPIRIT_PLUS_MAP[i] * (s === 0 ? 4 : 1); mask |= 1 << i; }
            }
            let v = pctUp(x + plus, pct);
            if (b) v += SPIRIT_BONUS_ADD[s];
            v = pctUp(v, pen) + collection[s] + buffAdd;
            if (v < mins[s]) v = -1;
            val[b * 81 + sig] = v;
            if (v > best[b * 16 + mask]) best[b * 16 + mask] = v;
        }
        t = { id: tables.size, val, best };
        tables.set(key, t);
        return t;
    }
    // 옵션별 표 묶음 + 그 옵션의 최고값(상한)
    const reps = new Map();
    for (const c of optionPool) {
        const base = dragonBaseStats[c.type][c.stat];
        const gemAdd = [gemStats.체[c.gemLevel] * c.gems.체, gemStats.공[c.gemLevel] * c.gems.공, gemStats.방[c.gemLevel] * c.gems.방];
        const buffAdd = [0, 0, 0];
        (BUFF_LIST[c.buff] || []).forEach(b => { const si = STAT_KR.indexOf(b); buffAdd[si] += Math.floor(base[si] * 0.2); });
        const tabs = [0, 1, 2].map(s => table(s, pctUp(base[s] + gemAdd[s] + potion[s], c.accessoryOpt[s] + c.enchantOpt[s]), c.pendantOpt[s], buffAdd[s]));
        const other = otherKeyFn(c);
        const rk = tabs[0].id + "," + tabs[1].id + "," + tabs[2].id + "|" + other;
        if (reps.has(rk)) continue; // 값이 완전히 같은 옵션은 하나만
        let ub = -1;
        for (const a of SLOT_ASSIGNMENTS) for (let bs = 0; bs < 3; bs++) {
            const h = tabs[0].best[(bs === 0 ? 16 : 0) + a.mask[0]], at = tabs[1].best[(bs === 1 ? 16 : 0) + a.mask[1]], d = tabs[2].best[(bs === 2 ? 16 : 0) + a.mask[2]];
            if (h < 0 || at < 0 || d < 0) continue;
            const v = h * at * d; if (v > ub) ub = v;
        }
        if (ub > 0) { const rep = { c, tabs, other, ub }; rep.scale = scaleOf(rep); rep.ubS = ub * rep.scale; reps.set(rk, rep); }
    }
    const list = [...reps.values()].sort((x, y) => y.ubS - x.ubS);
    const groups = new Map(); // (다른 중복제거 키 + 정령 배치) → 최고
    let threshold = -1, sinceRefresh = 0;
    function refresh() {
        if (groups.size < limit) { threshold = -1; return; }
        const vals = []; groups.forEach(g => vals.push(g.s));
        vals.sort((x, y) => y - x);
        threshold = vals[limit - 1];
    }
    for (const r of list) {
        if (r.ubS <= threshold) break; // 점수 상한 순으로 정렬돼 있으므로 이후 옵션은 상위 limit 안에 들 수 없음
        const T0 = r.tabs[0].val, T1 = r.tabs[1].val, T2 = r.tabs[2].val;
        for (const a of SPIRIT_ARRANGEMENTS) {
            const h = T0[a.idx[0]], at = T1[a.idx[1]], d = T2[a.idx[2]];
            if (h < 0 || at < 0 || d < 0) continue;
            const v = h * at * d, sc = v * r.scale;
            if (sc <= threshold) continue;
            const gk = r.other + "|" + a.label;
            const g = groups.get(gk);
            if (!g || sc > g.s || (sc === g.s && v > g.v)) groups.set(gk, { v, s: sc, r, a, h, at, d });
        }
        if (++sinceRefresh >= 200) { sinceRefresh = 0; refresh(); }
    }
    const out = [];
    groups.forEach(g => out.push({
        ...g.r.c, Vval: g.v, stats: { hp: g.h, atk: g.at, def: g.d },
        enchant: g.r.c.enchantOpt ?? [0, 0, 0],
        spiritLabel: g.a.label, spiritKey: g.a.label,
        tarSelf: Math.min(100, g.v / g.r.ub * 100)   // 같은 장비의 최선 정령 대비
    }));
    return out;
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
        // 정렬: vval = 비벨, tarFixed = TAR (디비룡 기준, 표에서 괄호 안 m%). tarSelf(n%) 는 화면 선택지에서 뺐지만 코드는 남겨 둠
        const sortMode = document.getElementById("sortMode")?.value || "vval";
        const baseOf = (r) => (typeof tarBase === "function" ? tarBase(r.type, r.buff) : null);
        // n% 계산: 각 줄의 장비에 가장 좋은 정령을 넣었을 때 비벨
        const fillTarSelf = (rows) => {
            const todo = rows.filter(r => r.tarSelf == null);
            if (!todo.length) return;
            const refPool = todo.map((r, i) => ({
                __i: i, type: r.type, stat: r.stat, gems: r.gems, gemLevel: r.gemLevel,
                accessoryLv: r.accessoryLv, accessoryOpt: r.accessoryOpt, enchantOpt: r.enchantOpt ?? r.enchant ?? [0, 0, 0],
                pendant: r.pendant, pendantOpt: r.pendantOpt, buff: r.buff
            }));
            const best = new Array(todo.length).fill(0);
            optimizeSpiritExact(refPool, minStats).forEach(x => { best[x.__i] = x.Vval; });
            todo.forEach((r, i) => { r.tarSelf = best[i] > 0 ? Math.min(100, r.Vval / best[i] * 100) : null; });
        };

        if (spiritOptOn && document.getElementById("dedupeSpirit")?.checked) {
            // 중복 제거: 정령 → 정령 배치마다 최고 세팅 (단막·유막 등도 각자 최고값으로 나옴)
            const dd = {
                type: document.getElementById("dedupeType")?.checked,
                buff: document.getElementById("dedupeBuff")?.checked,
                pendant: document.getElementById("dedupePendant")?.checked,
                accessory: document.getElementById("dedupeAccessory")?.checked
            };
            // 정령 외 항목은 아래 dedupeResults 가 처리하므로, 여기선 정령별 최고값을 (켠 항목 조합별로) 구함
            results = optimizeSpiritPerArrangement(optionPool, minStats, (c) => [
                dd.type ? c.type : "", dd.buff ? c.buff : "", dd.pendant ? c.pendantOpt.join(",") : "", dd.accessory ? c.accessoryOpt.join(",") : ""
            ].join("|"), 500,
            sortMode === "tarFixed" ? (rep => { const M = baseOf(rep.c); return M ? 1 / M : 0; })
            : sortMode === "tarSelf" ? (rep => 1 / rep.ub) : null);
        } else if (spiritOptOn) {
            // 모든 장비 옵션 × 모든 정령 구성의 정확한 최댓값 (최소 스탯 조건 포함)
            results = optimizeSpiritExact(optionPool, minStats);
            results.forEach(r => { r.tarSelf = 100; });   // 각 줄이 이미 그 장비의 최선 정령
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

        // TAR 순 정렬이면 전체 결과에 점수를 매긴 뒤 상위 500 개를 고름
        if (sortMode === "tarSelf") fillTarSelf(results);
        results.forEach(r => { const M = baseOf(r); r.tarRatio = M ? r.Vval / M : 0; });
        const scoreOf = sortMode === "tarSelf" ? (r => r.tarSelf ?? -1)
                      : sortMode === "tarFixed" ? (r => r.tarRatio)
                      : (r => r.Vval);
        let filteredResults = dedupeResults(results, dedupeOptions, scoreOf);
        filteredResults.sort((a, b) => scoreOf(b) - scoreOf(a) || b.Vval - a.Vval);
        const topN = filteredResults.slice(0, 500);

        // ── TAR n%(m%) ── 표시되는 줄
        fillTarSelf(topN);
        topN.forEach(r => { r.tarFixed = typeof tarScore === "function" ? tarScore(r.Vval, r.type, r.buff) : null; });
        const SORT_NAME = { vval: "", tarSelf: " · TAR n% 순", tarFixed: " · TAR 순" };

        const thRow = `<th>타입</th><th>버프</th><th>팬던트</th><th>젬Lv</th><th>젬분배</th><th>장신구</th><th>인챈</th>${spiritOptOn ? "<th>정령</th>" : ""}<th>Vval</th><th>TAR</th><th>HP</th><th>ATK</th><th>DEF</th>`;

        // 새 디자인: 체/공/방 글자에 스탯 색 (예: "공+공 (40%)", "체1 공0 방4", "체6%+방13%")
        const V2 = document.documentElement.classList.contains("ui-v2");
        const SC = { "체": "hp", "공": "atk", "방": "def" };
        const c = (t) => !V2 ? t : String(t).replace(/(체|공|방)(\d+%?|%|\+(?=\s|$))?/g,
            (m, st) => `<span class="sc sc-${SC[st]}">${m}</span>`);

        // 정령 이름(막플/극막/…) 작은 표시. 해당 없으면 비움
        const gradeTag = (label) => {
            const g = typeof spiritGradeFromLabel === "function" ? spiritGradeFromLabel(label) : "";
            return (g && typeof spiritGradeTag === "function") ? spiritGradeTag(g, { size: 10.5 }) : "";
        };
        const isSpiritOff = document.getElementById("spiritDisabled")?.checked;
        const inputGrade = (!spiritOptOn && !isSpiritOff && typeof spiritGrade === "function") ? spiritGrade(spirit.stats, spirit.types) : "";
        const inputGradeTag = (inputGrade && typeof spiritGradeTag === "function") ? spiritGradeTag(inputGrade, { size: 12, prefix: "입력 정령: " }) : "";

        // 99.96% 가 100.0% 로 보이지 않게 소수 첫째 자리에서 버림
        const floor1 = (x) => (Math.floor(x * 10 + 1e-9) / 10).toFixed(1);
        const fmtTar = (b) => {
            const n = b.tarSelf == null ? "-" : floor1(b.tarSelf) + "%";
            const m = b.tarFixed == null ? "-" : floor1(b.tarFixed) + "%";
            return `${n}<span class="tar-fixed" style="font-size:0.85em; color:#7a8297;">(${m})</span>`;
        };

        function makeRow(b) {
            const spiritTd = spiritOptOn ? `<td class="c-spirit" data-label="정령" style="font-size:11px;">${c(b.spiritLabel || "-")}${gradeTag(b.spiritLabel)}</td>` : "";
            return `<td class="c-type" data-label="타입">${c(b.type)}</td>
                <td class="c-buff" data-label="버프">${c(formatBuff(b.buff))}</td>
                <td class="c-pen" data-label="팬던트">${c(formatPercent(b.pendantOpt) || "-")}</td>
                <td class="c-gemlv" data-label="젬Lv">${b.gemLevel}</td>
                <td class="c-gems" data-label="젬분배">${c(formatGems(b.gems))}</td>
                <td class="c-acc" data-label="장신구">${c(formatPercent(b.accessoryOpt))}</td>
                <td class="c-ench" data-label="인챈">${c(b.enchant.some(v=>v>0) ? formatPercent(b.enchant) : "-")}</td>
                ${spiritTd}
                <td class="vval" data-label="비벨">${b.Vval.toLocaleString()}</td>
                <td class="c-tar" data-label="TAR" title="정령 최적 대비 % (디비룡 TAR)">${fmtTar(b)}</td>
                <td class="hp" data-label="HP">${b.stats.hp}</td>
                <td class="atk" data-label="ATK">${b.stats.atk}</td>
                <td class="def" data-label="DEF">${b.stats.def}</td>`;
        }

        // 표 그리기
        const resultArea = document.querySelector(".result-area");
        resultArea.innerHTML = `
            <h2 class="res-h">결과 (상위 ${topN.length}개)${SORT_NAME[sortMode] || ""}${inputGradeTag}</h2>
            <div class="table-wrapper"><table id="resTable" class="res-table"><thead><tr>${thRow}</tr></thead><tbody id="resBody"></tbody></table></div>`;

        const resBody = document.getElementById("resBody");
        topN.forEach(b => { const row = document.createElement("tr"); row.innerHTML = makeRow(b); resBody.appendChild(row); });

    } catch(e) {
        alert(e.message);
    }
}
