const ATTRS = [
  ["earth", "땅"],
  ["water", "물"],
  ["fire", "불"],
  ["wind", "바람"],
  ["light", "빛"],
  ["dark", "어둠"],
  ["dawn", "여명"],
  ["dusk", "황혼"],
  ["nightmare", "악몽"]
];

let dragonSaveTimer;
function triggerSave() {
  if (dragonSaveTimer) clearTimeout(dragonSaveTimer);
  dragonSaveTimer = setTimeout(() => {
    saveDragonUI();
    console.log("실시간 저장 완료 (270개 슬롯 스캔)");
  }, 300); // 0.3초 대기
}

// 🔹 정령 선택 칸 생성
function createSpirit(statVal = "옵", typeVal = "옵") {
  const wrap = document.createElement("div");
  wrap.className = "spirit-group";

  const stat = document.createElement("select");
  stat.className = "spirit-stat";
  ["옵","체","공","방"].forEach(v => { const o=document.createElement("option"); o.textContent=v; stat.appendChild(o); });
  stat.value = statVal;

  const type = document.createElement("select");
  type.className = "spirit-type";
  ["옵","%","+"].forEach(v => { const o=document.createElement("option"); o.textContent=v; type.appendChild(o); });
  type.value = typeVal;

stat.addEventListener("change", triggerSave);
  type.addEventListener("change", triggerSave);

  wrap.append(stat, type);

  return wrap;
}

// 🔹 슬롯 생성
function createSlot(data = null, isReserve = false) {
  const slot = document.createElement("div");
  slot.className = "slot";

  const grid = document.createElement("div");
  grid.className = "slot-grid";

  // --- Row 1: 이름 + 정령 1, 2 ---
  const row1 = document.createElement("div");
  row1.className = "slot-row row1";
  
  const name = document.createElement("input");
  name.className = "dragon-name";
  name.placeholder = isReserve ? "예비 정령" : "용 이름";
name.addEventListener("input", triggerSave);
  
  const s1 = createSpirit(data?.spiritStats?.[0], data?.spiritTypes?.[0]);
  const s2 = createSpirit(data?.spiritStats?.[1], data?.spiritTypes?.[1]);

  row1.append(name);
  row1.append(s1.querySelector(".spirit-stat"), s1.querySelector(".spirit-type"),
              s2.querySelector(".spirit-stat"), s2.querySelector(".spirit-type"));

  // --- Row 2: 등급 + 타입 + 부가옵 + 정령 3, 4 ---
  const row2 = document.createElement("div");
  row2.className = "slot-row row2";

  let type, getTypeValue, setTypeValue;
  if (isReserve) {
    // 예비 정령: 6개 토글 버튼
    type = document.createElement("div");
    type.className = "type-toggles";
    type.style.cssText = "display:flex; gap:2px; flex:1;";
    const TYPES = ["체","공","방","체공","체방","공방"];
    const btns = [];
    TYPES.forEach(t => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t;
      b.dataset.type = t;
      b.dataset.on = "0";
      b.style.cssText = "flex:1; min-width:0; padding:2px 0; font-size:11px; border:1px solid #ccc; background:#fff; cursor:pointer; border-radius:3px;";
      b.onclick = () => {
        const on = b.dataset.on === "1";
        b.dataset.on = on ? "0" : "1";
        b.style.background = on ? "#fff" : "#007bff";
        b.style.color = on ? "#000" : "#fff";
        triggerSave();
      };
      type.appendChild(b);
      btns.push(b);
    });
    getTypeValue = () => btns.filter(b => b.dataset.on === "1").map(b => b.dataset.type);
    setTypeValue = (arr) => {
      // 마이그레이션: 문자열이면 배열로
      let list = Array.isArray(arr) ? arr : (arr === "전체" ? TYPES : (TYPES.includes(arr) ? [arr] : []));
      btns.forEach(b => {
        const on = list.includes(b.dataset.type);
        b.dataset.on = on ? "1" : "0";
        b.style.background = on ? "#007bff" : "#fff";
        b.style.color = on ? "#fff" : "#000";
      });
    };
    type._getValue = getTypeValue;
    type._setValue = setTypeValue;
  } else {
    type = document.createElement("select");
    ["타입","체","공","방","체공","체방","공방"].forEach(v => { const o=document.createElement("option"); o.textContent=v; type.appendChild(o); });
    type.addEventListener("change", triggerSave);
  }
  
  const dStat = document.createElement("select");
  ["9.0","8.0","7.0"].forEach(v => { const o=document.createElement("option"); o.textContent=v; dStat.appendChild(o); });
  
  const bonus = document.createElement("select");
  ["부가옵","체","공","방"].forEach(v => { const o=document.createElement("option"); o.textContent=v; bonus.appendChild(o); });

  const s3 = createSpirit(data?.spiritStats?.[2], data?.spiritTypes?.[2]);
  const s4 = createSpirit(data?.spiritStats?.[3], data?.spiritTypes?.[3]);

  [dStat, bonus].forEach(el => el.addEventListener("change", triggerSave));

  row2.append(dStat, type, bonus); 
  row2.append(s3.querySelector(".spirit-stat"), s3.querySelector(".spirit-type"),
              s4.querySelector(".spirit-stat"), s4.querySelector(".spirit-type"));

  grid.append(row1, row2);
  slot.appendChild(grid);

  // 초기값 세팅
  if (data) {
    name.value = data.name || "";
    dStat.value = data.dStat || "9.0";
    bonus.value = data.bonus || "부가옵";
    if (isReserve) {
      // selectedTypes 우선, 없으면 기존 type 필드 마이그레이션
      type._setValue(data.selectedTypes || data.type || []);
    } else {
      type.value = data.type || "타입";
    }
  }

  return slot;
}

// 🔹 컨테이너에 슬롯 추가
const container = document.getElementById("container");

// 속성별 색상 설정
const attrColors = {
  "땅": "#8B4513",    // 갈색
  "물": "#007bff",    // 파란색
  "불": "#ff4d4f",    // 빨간색 (불 속성 추가)
  "바람": "#28a745",  // 초록색
  "빛": "#f1c40f",    // 노란색 (가독성을 위해 약간 진한 노랑)
  "어둠": "#000000",  // 검정
  "여명": "#abb2b9",  // 밝은 회색
  "황혼": "#9b59b6",  // 보라색 계열 (황혼)
  "악몽": "#34495e"   // 매우 짙은 회색
};

ATTRS.forEach(([key, label]) => {
  const attrDiv = document.createElement("div");
  attrDiv.className = "attr";
  attrDiv.dataset.key = key;

  const slotsDiv = document.createElement("div");
  slotsDiv.className = "slots";
  slotsDiv.dataset.key = key;
  slotsDiv.appendChild(createSlot());

  const addBtn = document.createElement("button");
  addBtn.textContent = "칸 추가";
  addBtn.onclick = () => { if(slotsDiv.children.length < 30) { slotsDiv.appendChild(createSlot()); triggerSave(); } };

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "칸 제거";
  removeBtn.onclick = () => { if(slotsDiv.children.length > 1) { slotsDiv.removeChild(slotsDiv.lastElementChild); triggerSave(); } };

  const header = document.createElement("div");
  header.className = "header";
  
  const nameLabel = document.createElement("strong");
  nameLabel.textContent = label;
  
  // ⭐ 여기에 색상 적용 코드 추가
  if (attrColors[label]) {
    nameLabel.style.color = attrColors[label];
  }
  
  header.append(nameLabel, addBtn, removeBtn);

  attrDiv.appendChild(header);
  attrDiv.appendChild(slotsDiv);
  container.appendChild(attrDiv);
});

// 🔹 예비 정령 섹션
(function() {
  const reserveDiv = document.createElement("div");
  reserveDiv.className = "attr";
  reserveDiv.dataset.key = "reserve";

  const slotsDiv = document.createElement("div");
  slotsDiv.className = "slots";
  slotsDiv.dataset.key = "reserve";
  slotsDiv.appendChild(createSlot(null, true));

  const addBtn = document.createElement("button");
  addBtn.textContent = "칸 추가";
  addBtn.onclick = () => { if(slotsDiv.querySelectorAll('.slot').length < 30) { slotsDiv.appendChild(createSlot(null, true)); triggerSave(); } };

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "칸 제거";
  removeBtn.onclick = () => { if(slotsDiv.querySelectorAll('.slot').length > 1) { slotsDiv.removeChild(slotsDiv.lastElementChild); triggerSave(); } };

  const header = document.createElement("div");
  header.className = "header";
  
  const nameLabel = document.createElement("strong");
  nameLabel.textContent = "예비 정령";
  nameLabel.style.color = "#e67e22";

  header.append(nameLabel, addBtn, removeBtn);
  reserveDiv.appendChild(header);
  reserveDiv.appendChild(slotsDiv);
  container.appendChild(reserveDiv);
})();

// 🔹 저장
function saveDragonUI(){
    const data = [];
    document.querySelectorAll(".attr").forEach(attrDiv => {
        const key = attrDiv.dataset.key;
        
        attrDiv.querySelectorAll(".slot").forEach(slot => {
            const nameEl = slot.querySelector(".dragon-name");
            // 데이터가 없으면 건너뛰지 않고 구조를 유지하기 위해 기본값 설정
            if (!nameEl) return;

            const sStats = Array.from(slot.querySelectorAll(".spirit-stat")).map(el => el.value);
            const sTypes = Array.from(slot.querySelectorAll(".spirit-type")).map(el => el.value);
            
            // row2: 첫번째는 등급(select), 그다음은 타입(select 또는 toggles div), 마지막은 부가옵(select)
            const row2 = slot.querySelector(".row2");
            const dStatEl = row2.querySelector("select"); // 첫 번째 select = dStat
            const allSelects = row2.querySelectorAll("select");
            const bonusEl = allSelects[allSelects.length - 1]; // 마지막 select 후보
            const togglesEl = row2.querySelector(".type-toggles");

            const entry = {
                attrKey: key,
                name: nameEl.value,
                dStat: dStatEl?.value || "9.0",
                bonus: bonusEl?.value || "부가옵",
                spiritStats: sStats,
                spiritTypes: sTypes
            };

            if (togglesEl && togglesEl._getValue) {
                // 예비: 선택된 타입 배열
                entry.selectedTypes = togglesEl._getValue();
                entry.type = entry.selectedTypes.length > 0 ? "전체" : "타입"; // 호환용
            } else {
                // 일반: 두 번째 select가 type
                entry.type = allSelects[1]?.value || "타입";
            }

            data.push(entry);
        });
    });
    
    // 즉시 저장
    saveData(STORAGE_KEYS.DRAGON, data);
    console.log("실시간 저장 완료:", data);
}

// 🔹 로드
function loadDragonUI(){
  const data = loadData(STORAGE_KEYS.DRAGON);
  if(!data) return;

  document.querySelectorAll(".slots").forEach(div=>div.innerHTML="");

  ATTRS.forEach(([key,label])=>{
    const parent = document.querySelector(`.slots[data-key="${key}"]`);
    const items = data.filter(d=>d.attrKey===key);
    if(items.length===0){ parent.appendChild(createSlot()); }
    else{ items.forEach(item=>parent.appendChild(createSlot(item))); }
  });

  // 예비 정령 로드
  const reserveParent = document.querySelector('.slots[data-key="reserve"]');
  if(reserveParent) {
    const reserveItems = data.filter(d=>d.attrKey==="reserve");
    if(reserveItems.length===0){ reserveParent.appendChild(createSlot(null, true)); }
    else{ reserveItems.forEach(item=>reserveParent.appendChild(createSlot(item, true))); }
  }
}

document.addEventListener("DOMContentLoaded", ()=>{ loadDragonUI(); });


// ui.js 예시 (계산 버튼 클릭 시)

function runTotalRanking() {
    const dragonList = loadData(STORAGE_KEYS.DRAGON) || [];
    
    // 1. 공통 환경 설정 (UI에서 값 읽어오기)
    const gemPool = {
        hp: parseInt(document.getElementById("gem-pool-hp").value) || 0,
        atk: parseInt(document.getElementById("gem-pool-atk").value) || 0,
        def: parseInt(document.getElementById("gem-pool-def").value) || 0
    };

    const context = {
        pendant: [20, 0, 0], // 예: UI에서 읽어온 팬던트 옵션 [체%, 공%, 방%]
        acc: [6, 13, 0],     // 예: 장신구 옵션
        enchant: [21, 0, 0], // 예: 인챈트 옵션
        buff: "체공"         // 예: 선택된 버프
    };

    // 2. 각 용별 최적화 실행
    const results = dragonList.map(dragon => {
        // 이름이나 타입이 없으면 패스
        if (!dragon.name || dragon.type === "타입") return null;

        // ★★★ 계산기 모듈 호출 ★★★
        const bestStats = DragonCalc.optimizeDragon(dragon, gemPool, context);
        
        if (!bestStats) return null;

        return {
            name: dragon.name,
            attr: dragon.attrKey, // 속성(땅, 불...)
            ...bestStats // vval, hp, atk, def, usedGems 포함됨
        };
    }).filter(r => r !== null);

    // 3. 정렬 및 출력
    results.sort((a, b) => b.vval - a.vval);
    
    // 결과 확인용 로그
    console.log("계산 결과:", results);
    
    // 화면 출력 함수 호출 (Top 3)
    // renderTop3(results.slice(0, 3));
}