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

const ATTR_LABEL_BY_KEY = Object.fromEntries(ATTRS);                       // earth → 땅
const ATTR_KEY_BY_LABEL = Object.fromEntries(ATTRS.map(([k, l]) => [l, k])); // 땅 → earth
const MAX_SLOTS = 30; // 한 구역(속성별/예비)에 둘 수 있는 최대 칸 수

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

// 🔹 칸에 입력된 내용이 있는지 (이름·정령·타입·속성·부가옵 중 하나라도)
function slotHasContent(slot) {
  if (slot.querySelector(".dragon-name")?.value.trim()) return true;
  if ([...slot.querySelectorAll(".spirit-stat, .spirit-type")].some(el => el.value !== "옵")) return true;
  const t = slot.querySelector(".dragon-type"); if (t && t.value !== "타입") return true;
  const a = slot.querySelector(".dragon-reserve-attr"); if (a && a.value !== "속성") return true;
  const b = slot.querySelector(".dragon-bonus"); if (b && b.value !== "부가옵") return true;
  return !!slot.querySelector('.type-toggles button[data-on="1"]');
}

// 🔹 예비 정령 이름 칸: 비어 있으면 "예비 정령1", "예비 정령2" ... (계산 결과에 나오는 이름과 같은 번호)
function renumberReserve() {
  document.querySelectorAll('.slots[data-key="reserve"] .slot').forEach((slot, i) => {
    const n = slot.querySelector(".dragon-name");
    if (n) n.placeholder = "예비 정령" + (i + 1);
  });
}

// 🔹 아무 칸이나 지우기 — 내용이 있으면 한 번 더 눌러야 지워짐 (실수 방지)
function deleteSlot(slot) {
  const slotsDiv = slot.parentElement;
  if (!slotsDiv) return;
  const isReserve = slotsDiv.dataset.key === "reserve";
  if (slotsDiv.querySelectorAll(".slot").length > 1) slot.remove();
  else slotsDiv.replaceChild(createSlot(null, isReserve), slot); // 마지막 한 칸은 비우기만 함
  if (isReserve) renumberReserve();
  if (typeof slotsDiv._updateToggleText === "function") slotsDiv._updateToggleText();
  triggerSave();
}
function createDeleteButton(slot) {
  const del = document.createElement("button");
  del.type = "button";
  del.className = "slot-del";
  del.textContent = "✕";
  del.title = "이 칸 지우기";
  del.setAttribute("aria-label", "이 칸 지우기");
  let timer = null;
  const disarm = () => { clearTimeout(timer); timer = null; del.classList.remove("is-armed"); del.textContent = "✕"; };
  del.addEventListener("click", () => {
    if (!slotHasContent(slot) || del.classList.contains("is-armed")) { disarm(); deleteSlot(slot); return; }
    del.classList.add("is-armed");
    del.textContent = "삭제";
    timer = setTimeout(disarm, 2500);
  });
  return del;
}

// ===== 예비 정령 ⇄ 본 정령 이동 =====
//  · 본 정령  = 속성별 칸(땅·물·불…)에 있는 정령 (속성 고정, 타입 1개)
//  · 예비 정령 = 예비 정령 칸에 있는 정령 (속성 1개 + 타입 여러 개 선택 가능)
//  본 → 예비: 속성은 "예비 속성"으로, 타입은 켜진 타입 버튼 1개로 옮김 (빠지는 정보 없음)
//  예비 → 본: "예비 속성"에 해당하는 속성 칸으로 이동. 타입이 정확히 1개 켜져 있을 때만 그대로 옮기고,
//             0개/2개 이상이면 타입은 비워 두고 직접 고르게 안내함 (되돌리기 가능)

// 🔹 칸 하나의 입력값 → 저장 형식 (saveDragonUI 와 이동 기능이 같이 씀)
function serializeSlot(slot, key) {
  const nameEl = slot.querySelector(".dragon-name");
  // 데이터가 없으면 건너뛰지 않고 구조를 유지하기 위해 기본값 설정
  if (!nameEl) return null;

  const sStats = Array.from(slot.querySelectorAll(".spirit-stat")).map(el => el.value);
  const sTypes = Array.from(slot.querySelectorAll(".spirit-type")).map(el => el.value);

  // toggles는 row3에 있을 수도 있으므로 slot 전체에서 검색
  const togglesEl = slot.querySelector(".type-toggles");
  const dStatEl = slot.querySelector(".dragon-dstat");
  const bonusEl = slot.querySelector(".dragon-bonus");
  const attrEl = slot.querySelector(".dragon-reserve-attr");
  const typeEl = slot.querySelector(".dragon-type");
  const disabledEl = slot.querySelector(".dragon-disabled");

  const entry = {
    attrKey: key,
    name: nameEl.value,
    dStat: dStatEl?.value || "9.0",
    bonus: bonusEl?.value || "부가옵",
    spiritStats: sStats,
    spiritTypes: sTypes,
    disabled: !!disabledEl?.checked
  };

  if (togglesEl) {
    entry.selectedTypes = togglesEl._getValue();
    entry.type = "전체";
    entry.reserveAttr = attrEl?.value || "속성";
  } else {
    entry.type = typeEl?.value || "타입";
  }
  return entry;
}

// 🔹 구조가 바뀐 뒤 공통 마무리 (번호·버튼 글자·마리 수 표시·즉시 저장)
function afterSlotsChanged(...slotsDivs) {
  renumberReserve();
  slotsDivs.forEach(div => {
    if (!div) return;
    if (typeof div._updateToggleText === "function") div._updateToggleText();
    div.dispatchEvent(new Event("input", { bubbles: true })); // ui-v2.js 의 "N마리" 표시 갱신
  });
  clearTimeout(dragonSaveTimer);
  saveDragonUI(); // 이동은 구조가 바뀌는 작업이라 0.3초 기다리지 않고 바로 저장
}

// 🔹 칸 안에 잠깐 뜨는 안내줄 (iframe 안에서도 보이도록 화면 고정 토스트 대신 칸 안에 표시)
function showSlotNotice(slot, text, opts = {}) {
  const old = slot.querySelector(":scope > .slot-notice");
  if (old && typeof old._close === "function") old._close();

  const box = document.createElement("div");
  box.className = "slot-notice" + (opts.warn ? " is-warn" : "");
  let timer = null;
  const close = () => { clearTimeout(timer); box.remove(); };
  box._close = close;

  const msg = document.createElement("span");
  msg.className = "slot-notice-text";
  msg.textContent = text;
  box.appendChild(msg);

  if (opts.undo) {
    const u = document.createElement("button");
    u.type = "button";
    u.className = "slot-notice-btn";
    u.textContent = "되돌리기";
    u.addEventListener("click", () => { close(); opts.undo(); });
    box.appendChild(u);
  }
  const x = document.createElement("button");
  x.type = "button";
  x.className = "slot-notice-x";
  x.textContent = "✕";
  x.setAttribute("aria-label", "닫기");
  x.addEventListener("click", close);
  box.appendChild(x);

  slot.insertBefore(box, slot.firstChild);
  timer = setTimeout(close, opts.ms || 10000);
  // 되돌리기가 있는 안내는, 직접 고치기 시작하면(= 결과를 받아들이면) 닫음
  if (opts.undo) ["input", "change"].forEach(ev => slot.addEventListener(ev, close, { once: true }));
  return box;
}

// 🔹 옮겨진 칸으로 화면 이동 + 잠깐 반짝임 (접혀 있으면 펼침)
function revealSlot(slot) {
  const attr = slot.closest(".attr");
  if (attr && attr.classList.contains("is-collapsed")) {
    const chev = attr.querySelector(".attr-fold");
    if (chev) chev.click(); else attr.classList.remove("is-collapsed");
  }
  slot.classList.add("slot-flash");
  setTimeout(() => slot.classList.remove("slot-flash"), 1800);
  if (window.GUILD_UI_V2 && typeof window.GUILD_UI_V2.scrollTo === "function") window.GUILD_UI_V2.scrollTo(slot);
  else if (slot.scrollIntoView) slot.scrollIntoView({ behavior: "smooth", block: "center" });
}

// 🔹 이동 되돌리기: 옮겨진 칸을 지우고, 원래 칸(원래 자리·원래 입력값 그대로)을 복원
function undoMove(ctx) {
  const { entry, fromKey, fromIdx, fromWasOnly, newSlot } = ctx;
  const fromDiv = document.querySelector(`.slots[data-key="${fromKey}"]`);
  const toDiv = newSlot.parentElement;
  if (!fromDiv || !toDiv) return;

  const kids = Array.from(fromDiv.children);
  const restored = createSlot(entry, fromKey === "reserve");
  if (fromWasOnly && kids.length === 1 && !slotHasContent(kids[0])) {
    fromDiv.replaceChild(restored, kids[0]);
  } else if (kids.length >= MAX_SLOTS) {
    showSlotNotice(newSlot, "원래 칸이 가득 차서 되돌릴 수 없어요", { warn: true, ms: 4500 });
    return;
  } else {
    fromDiv.insertBefore(restored, kids[Math.min(fromIdx, kids.length)] || null);
  }

  // 옮겨졌던 칸 제거 (마지막 한 칸이면 빈 칸으로 비움)
  if (toDiv.children.length > 1) newSlot.remove();
  else toDiv.replaceChild(createSlot(null, toDiv.dataset.key === "reserve"), newSlot);

  afterSlotsChanged(fromDiv, toDiv);
  revealSlot(restored);
}

// 🔹 이 칸을 반대쪽(본 ↔ 예비)으로 옮기기
function moveSlot(slot) {
  const fromDiv = slot.parentElement;
  if (!fromDiv || !fromDiv.dataset) return;
  const fromKey = fromDiv.dataset.key;
  const toReserve = fromKey !== "reserve";
  const entry = serializeSlot(slot, fromKey);
  if (!entry) return;

  let toKey, newData, typeNote = "";
  if (toReserve) {
    // 본 → 예비
    toKey = "reserve";
    newData = {
      ...entry,
      attrKey: "reserve",
      reserveAttr: ATTR_LABEL_BY_KEY[fromKey] || "속성",
      selectedTypes: (entry.type && entry.type !== "타입") ? [entry.type] : [],
      type: "전체"
    };
  } else {
    // 예비 → 본
    toKey = ATTR_KEY_BY_LABEL[entry.reserveAttr];
    if (!toKey) {
      // 속성을 모르면 어느 칸으로 갈지 알 수 없음
      const sel = slot.querySelector(".dragon-reserve-attr");
      showSlotNotice(slot, "속성을 먼저 골라 주세요. 본 정령은 속성별 칸으로 옮겨져요.", { warn: true, ms: 4500 });
      if (sel) { sel.classList.add("slot-need"); sel.addEventListener("change", () => sel.classList.remove("slot-need"), { once: true }); }
      return;
    }
    const types = entry.selectedTypes || [];
    newData = { ...entry, attrKey: toKey, type: types.length === 1 ? types[0] : "타입" };
    delete newData.selectedTypes;
    delete newData.reserveAttr;
    if (types.length === 0) typeNote = " · 타입을 골라 주세요";
    else if (types.length > 1) typeNote = " · 타입이 여러 개 선택돼 있어서 비워 뒀어요. 하나만 골라 주세요";
  }

  const toDiv = document.querySelector(`.slots[data-key="${toKey}"]`);
  if (!toDiv) return;

  // 들어갈 자리: 빈 칸이 있으면 거기에, 없으면 새 칸 추가
  const toKids = Array.from(toDiv.children);
  const blank = toKids.find(k => !slotHasContent(k));
  if (!blank && toKids.length >= MAX_SLOTS) {
    showSlotNotice(slot, `${toReserve ? "예비 정령" : (ATTR_LABEL_BY_KEY[toKey] + " 칸")}이 가득 차서(${MAX_SLOTS}칸) 옮길 수 없어요`, { warn: true, ms: 4500 });
    return;
  }

  const fromKids = Array.from(fromDiv.children);
  const ctx = { entry, fromKey, fromIdx: fromKids.indexOf(slot), fromWasOnly: fromKids.length === 1 };

  const newSlot = createSlot(newData, toReserve);
  if (blank) toDiv.replaceChild(newSlot, blank); else toDiv.appendChild(newSlot);
  ctx.newSlot = newSlot;

  // 원래 칸 제거 (마지막 한 칸이면 빈 칸으로 비움)
  if (fromKids.length > 1) slot.remove();
  else fromDiv.replaceChild(createSlot(null, !toReserve), slot);

  afterSlotsChanged(fromDiv, toDiv);

  // 타입을 골라야 하는 경우 표시
  if (typeNote) {
    const t = newSlot.querySelector(".dragon-type");
    if (t) { t.classList.add("slot-need"); t.addEventListener("change", () => t.classList.remove("slot-need"), { once: true }); }
  }

  const where = toReserve
    ? `${ATTR_LABEL_BY_KEY[fromKey]} → 예비 정령으로 옮겼어요`
    : `예비 정령 → ${ATTR_LABEL_BY_KEY[toKey]} 본 정령으로 옮겼어요`;
  revealSlot(newSlot);
  showSlotNotice(newSlot, where + typeNote, { undo: () => undoMove(ctx), ms: typeNote ? 15000 : 10000 });
}

function createMoveButton(slot, isReserve) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "slot-move " + (isReserve ? "to-main" : "to-reserve");
  b.textContent = isReserve ? "→본" : "→예비";
  const tip = isReserve ? "본 정령으로 옮기기 (속성별 칸으로 이동)" : "예비 정령으로 옮기기";
  b.title = tip;
  b.setAttribute("aria-label", tip);
  b.addEventListener("click", () => moveSlot(slot));
  return b;
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
  name.placeholder = isReserve ? "예비 정령" : "용 이름"; // 예비는 renumberReserve() 가 번호를 붙임
  name.addEventListener("input", triggerSave);
  
  // 비활성화 체크박스 (체크하면 모든 계산에서 제외)
  const disableChk = document.createElement("input");
  disableChk.type = "checkbox";
  disableChk.className = "dragon-disabled";
  disableChk.title = "계산에서 제외 (체크박스 우선 적용)";
  disableChk.addEventListener("change", triggerSave);
  
  const s1 = createSpirit(data?.spiritStats?.[0], data?.spiritTypes?.[0]);
  const s2 = createSpirit(data?.spiritStats?.[1], data?.spiritTypes?.[1]);

  row1.append(disableChk, name);
  row1.append(s1.querySelector(".spirit-stat"), s1.querySelector(".spirit-type"),
              s2.querySelector(".spirit-stat"), s2.querySelector(".spirit-type"));
  row1.append(createMoveButton(slot, isReserve));
  row1.append(createDeleteButton(slot));

  // --- Row 2: 등급 + 타입 + 부가옵 + 정령 3, 4 ---
  const row2 = document.createElement("div");
  row2.className = "slot-row row2";

  let type, getTypeValue, setTypeValue;
  if (isReserve) {
    type = document.createElement("div");
    type.className = "type-toggles";
    type.style.cssText = "display:flex; gap:4px; width:100%; margin-top:2px;";
    const TYPES = ["체","공","방","체공","체방","공방"];
    const btns = [];
    TYPES.forEach(t => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t;
      b.dataset.type = t;
      b.dataset.on = "0";
      b.style.cssText = "flex:1; min-width:0; height:30px; padding:0; font-size:13px; font-weight:bold; border:1px solid #ccc; background:#fff; cursor:pointer; border-radius:4px;";
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
    type.style.cssText = "flex:1.5; padding:0 8px; font-size:14px;"; // 살짝 키움
    type.addEventListener("change", triggerSave);
  }
  
  // 예비 정령: 속성 select 추가
  let attrSel = null;
  if (isReserve) {
    attrSel = document.createElement("select");
    ["속성","땅","물","불","바람","빛","어둠","여명","황혼","악몽"].forEach(v => { const o=document.createElement("option"); o.textContent=v; attrSel.appendChild(o); });
    attrSel.addEventListener("change", triggerSave);
  }

  const dStat = document.createElement("select");
  dStat.className = "dragon-dstat";
  ["9.0","8.0","7.0"].forEach(v => { const o=document.createElement("option"); o.textContent=v; dStat.appendChild(o); });
  
  const bonus = document.createElement("select");
  bonus.className = "dragon-bonus";
  ["부가옵","체","공","방"].forEach(v => { const o=document.createElement("option"); o.textContent=v; bonus.appendChild(o); });

  if (attrSel) attrSel.className = "dragon-reserve-attr";
  if (!isReserve) {
    // type select에도 명시 class
    type.classList.add("dragon-type");
  }

  const s3 = createSpirit(data?.spiritStats?.[2], data?.spiritTypes?.[2]);
  const s4 = createSpirit(data?.spiritStats?.[3], data?.spiritTypes?.[3]);

  [dStat, bonus].forEach(el => el.addEventListener("change", triggerSave));

  // 예비: row2에서 type 제외, row3에 type 토글 별도 배치
  if (isReserve) {
    row2.append(attrSel, dStat, bonus); 
    row2.append(s3.querySelector(".spirit-stat"), s3.querySelector(".spirit-type"),
                s4.querySelector(".spirit-stat"), s4.querySelector(".spirit-type"));
    const row3 = document.createElement("div");
    row3.className = "slot-row row3";
    row3.style.cssText = "display:flex; width:100%;";
    row3.appendChild(type);
    grid.append(row1, row2, row3);
  } else {
    row2.append(dStat, type, bonus); 
    row2.append(s3.querySelector(".spirit-stat"), s3.querySelector(".spirit-type"),
                s4.querySelector(".spirit-stat"), s4.querySelector(".spirit-type"));
    grid.append(row1, row2);
  }
  slot.appendChild(grid);

  if (data) {
    name.value = data.name || "";
    if (disableChk) disableChk.checked = !!data.disabled;
    dStat.value = data.dStat || "9.0";
    bonus.value = data.bonus || "부가옵";
    if (isReserve) {
      if (attrSel && data.reserveAttr) attrSel.value = data.reserveAttr;
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

  // 전체활성/전체해제 토글 버튼
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "toggle-all-disabled";
  toggleBtn.title = "이 속성의 모든 체크박스 일괄 토글";
  const updateToggleText = () => {
    const cbs = slotsDiv.querySelectorAll(".dragon-disabled");
    // 하나라도 체크돼 있으면 다음 클릭은 '전체해제'
    const anyChecked = cbs.length > 0 && Array.from(cbs).some(c => c.checked);
    toggleBtn.textContent = anyChecked ? "전체해제" : "전체활성";
    toggleBtn.classList.toggle("is-active", anyChecked);
  };
  toggleBtn.onclick = () => {
    const cbs = slotsDiv.querySelectorAll(".dragon-disabled");
    // 하나라도 체크돼 있으면 우선 '전체해제'(전부 끄기), 전부 꺼져있을 때만 '전체활성'(전부 켜기)
    const anyChecked = Array.from(cbs).some(c => c.checked);
    cbs.forEach(c => c.checked = !anyChecked);
    updateToggleText();
    triggerSave();
  };
  // 개별 체크박스가 바뀔 때 토글 버튼 텍스트 갱신
  slotsDiv.addEventListener("change", (e) => {
    if (e.target.classList && e.target.classList.contains("dragon-disabled")) updateToggleText();
  });
  slotsDiv._updateToggleText = updateToggleText;

  const addBtn = document.createElement("button");
  addBtn.textContent = "칸 추가";
  addBtn.onclick = () => { if(slotsDiv.children.length < 30) { slotsDiv.appendChild(createSlot()); triggerSave(); updateToggleText(); } };

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "칸 제거";
  removeBtn.onclick = () => { if(slotsDiv.children.length > 1) { slotsDiv.removeChild(slotsDiv.lastElementChild); triggerSave(); updateToggleText(); } };

  const header = document.createElement("div");
  header.className = "header";
  
  const nameLabel = document.createElement("strong");
  nameLabel.textContent = label;
  
  // ⭐ 여기에 색상 적용 코드 추가
  if (attrColors[label]) {
    nameLabel.style.color = attrColors[label];
  }
  
  header.append(nameLabel, addBtn, removeBtn, toggleBtn);

  attrDiv.appendChild(header);
  attrDiv.appendChild(slotsDiv);
  container.appendChild(attrDiv);
  updateToggleText();
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

  // 전체활성/전체해제 토글 버튼
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "toggle-all-disabled";
  toggleBtn.title = "예비 정령의 모든 체크박스 일괄 토글";
  const updateToggleText = () => {
    const cbs = slotsDiv.querySelectorAll(".dragon-disabled");
    const anyChecked = cbs.length > 0 && Array.from(cbs).some(c => c.checked);
    toggleBtn.textContent = anyChecked ? "전체해제" : "전체활성";
    toggleBtn.classList.toggle("is-active", anyChecked);
  };
  toggleBtn.onclick = () => {
    const cbs = slotsDiv.querySelectorAll(".dragon-disabled");
    const anyChecked = Array.from(cbs).some(c => c.checked);
    cbs.forEach(c => c.checked = !anyChecked);
    updateToggleText();
    triggerSave();
  };
  slotsDiv.addEventListener("change", (e) => {
    if (e.target.classList && e.target.classList.contains("dragon-disabled")) updateToggleText();
  });
  slotsDiv._updateToggleText = updateToggleText;

  const addBtn = document.createElement("button");
  addBtn.textContent = "칸 추가";
  addBtn.onclick = () => { if(slotsDiv.querySelectorAll('.slot').length < 30) { slotsDiv.appendChild(createSlot(null, true)); renumberReserve(); triggerSave(); updateToggleText(); } };

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "칸 제거";
  removeBtn.onclick = () => { if(slotsDiv.querySelectorAll('.slot').length > 1) { slotsDiv.removeChild(slotsDiv.lastElementChild); renumberReserve(); triggerSave(); updateToggleText(); } };

  const header = document.createElement("div");
  header.className = "header";
  
  const nameLabel = document.createElement("strong");
  nameLabel.textContent = "예비 정령";
  nameLabel.style.color = "#e67e22";

  header.append(nameLabel, addBtn, removeBtn, toggleBtn);
  reserveDiv.appendChild(header);
  reserveDiv.appendChild(slotsDiv);
  container.appendChild(reserveDiv);
  updateToggleText();
  renumberReserve();
})();

// 🔹 저장
function saveDragonUI(){
    const data = [];
    document.querySelectorAll(".attr").forEach(attrDiv => {
        const key = attrDiv.dataset.key;
        attrDiv.querySelectorAll(".slot").forEach(slot => {
            const entry = serializeSlot(slot, key);
            if (entry) data.push(entry);
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

  renumberReserve();

  // 모든 토글 버튼 텍스트 갱신 (로드된 disabled 상태 반영)
  document.querySelectorAll(".slots").forEach(div => {
    if (typeof div._updateToggleText === "function") div._updateToggleText();
  });
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