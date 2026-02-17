// gear.js - 장신구, 팬던트, 젬 저장/로드 + 칸 추가/제거 지원

const ACCESSORY_ITEMS = ["장신구","악보","황보","여보","물뿔(체/공)","물뿔(체/방)","불뿔(공/체)","불뿔(공/방)","대뿔(방/체)","대뿔(방/공)","바뿔(체/방)","바뿔(공/체)","바뿔(공/방)"];
const ACCESSORY_VALUES = ["스탯",18,19,20];
const ACCESSORY_ENCHANTS = ["인챈트","all","체","공","방"];
const PENDANT_TYPES = ["off","달","태양"];
const PENDANT_OPTIONS = ["옵션","체","공","방"];
const GEM_LEVELS = [36,37,38,39,40];

// 🔹 [신규] 10개 단위 구분선 업데이트 함수
function updateDividers(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // 기존 구분선 제거
  container.querySelectorAll('.unit-divider').forEach(d => d.remove());
  // 현재 슬롯들만 추출
  const slots = Array.from(container.children);
  // 10번째마다 점선 삽입
  slots.forEach((slot, index) => {
    const count = index + 1;
    if (count % 10 === 0 && count !== slots.length) {
      const divider = document.createElement("div");
      divider.className = "unit-divider";
      slot.after(divider);
    }
  });
}

// 🔹 장신구 슬롯 생성
function createAccessorySlot(data=null){
  const slot = document.createElement("div");
  slot.className = "gear-slot accessory-slot";
  const item = document.createElement("select");
  ACCESSORY_ITEMS.forEach(v=>{ const o=document.createElement("option"); o.textContent=v; o.value=v; item.appendChild(o); });
  const value = document.createElement("select");
  ACCESSORY_VALUES.forEach(v=>{ const o=document.createElement("option"); o.textContent=v; o.value=v; value.appendChild(o); });
  const enchant = document.createElement("select");
  ACCESSORY_ENCHANTS.forEach(v=>{ const o=document.createElement("option"); o.textContent=v; o.value=v; enchant.appendChild(o); });
  if(data){
    item.value = data.item || ACCESSORY_ITEMS[0];
    value.value = data.value || ACCESSORY_VALUES[0];
    enchant.value = data.enchant || ACCESSORY_ENCHANTS[0];
  }
  [item,value,enchant].forEach(el=>el.addEventListener("change", saveGearUI));
  slot.append(item,value,enchant);
  return slot;
}

// 🔹 팬던트 슬롯 생성
function createPendantSlot(data=null){
  const slot = document.createElement("div");
  slot.className = "gear-slot pendant-slot";
  // JS에서 강제 지정하던 style을 제거하여 CSS 설정이 먹히도록 함 (구조 유지용)
  const typeSelect = document.createElement("select");
  PENDANT_TYPES.forEach(v=>{ const o=document.createElement("option"); o.textContent=v; o.value=v; typeSelect.appendChild(o); });
  slot.appendChild(typeSelect);
  const optionSelects = [], statInputs = [];
  for(let i=0;i<3;i++){
    const option = document.createElement("select");
    PENDANT_OPTIONS.forEach(v=>{ const o=document.createElement("option"); o.textContent=v; o.value=v; option.appendChild(o); });
    slot.appendChild(option);
    optionSelects.push(option);
    const stat = document.createElement("input");
    stat.type="number"; stat.min=0; stat.max=6; stat.value=data ? data[`stat${i+1}`] || 0 : 0;
    slot.appendChild(stat);
    statInputs.push(stat);
  }
  if(data){
    typeSelect.value = data.type || PENDANT_TYPES[0];
    optionSelects[0].value = data.opt1 || PENDANT_OPTIONS[0];
    optionSelects[1].value = data.opt2 || PENDANT_OPTIONS[0];
    optionSelects[2].value = data.opt3 || PENDANT_OPTIONS[0];
  }
  typeSelect.onchange = () => {
    const isOff = typeSelect.value==="달"||typeSelect.value==="off";
    optionSelects[2].disabled=isOff; statInputs[2].disabled=isOff;
    optionSelects[2].style.background=isOff?"#eee":""; statInputs[2].style.background=isOff?"#eee":"";
  };
  typeSelect.onchange();
  [typeSelect,...optionSelects,...statInputs].forEach(el=>el.addEventListener("change", saveGearUI));
  return slot;
}

// 🔹 젬 슬롯 생성
function createGemSlot(level,data=null){
  const slot = document.createElement("div");
  slot.className = "gear-slot gem-slot";
  const label = document.createElement("span");
  label.textContent = level;
  slot.appendChild(label);
  ["체","공","방"].forEach((s)=>{
    const input = document.createElement("input");
    input.type="number"; input.min=0; input.value=data ? data[s] || 0 : 0;
    input.addEventListener("change", saveGearUI);
    slot.appendChild(input);
  });
  return slot;
}

// 🔹 저장 (기존 로직 유지)
function saveGearUI(){
  const accContainer = document.getElementById("accessory-container");
  const pendantContainer = document.getElementById("pendant-container");
  const gemContainer = document.getElementById("gem-container");

  const accessories = Array.from(accContainer.querySelectorAll('.accessory-slot')).map(slot=>{
    const selects = slot.querySelectorAll("select");
    return { item: selects[0].value, value: selects[1].value, enchant: selects[2].value };
  });

  const pendants = Array.from(pendantContainer.querySelectorAll('.pendant-slot')).map(slot=>{
    const selects = slot.querySelectorAll("select");
    const inputs = slot.querySelectorAll("input");
    return { type: selects[0].value, opt1: selects[1].value, opt2: selects[2].value, opt3: selects[3].value, stat1: inputs[0].value, stat2: inputs[1].value, stat3: inputs[2].value };
  });

  const gems = Array.from(gemContainer.querySelectorAll('.gem-slot')).map(slot=>{
    const inputs = slot.querySelectorAll("input");
    return { 체: inputs[0].value, 공: inputs[1].value, 방: inputs[2].value };
  });
  saveData(STORAGE_KEYS.GEAR,{ accessories, pendants, gems });
}

// 🔹 초기화 및 로드
document.addEventListener("DOMContentLoaded",()=>{
  const accContainer = document.getElementById("accessory-container");
  const pendantContainer = document.getElementById("pendant-container");
  const gemContainer = document.getElementById("gem-container");
  const gearData = loadData(STORAGE_KEYS.GEAR);

  if(gearData?.accessories) gearData.accessories.forEach(d=>accContainer.appendChild(createAccessorySlot(d)));
  if(accContainer.children.length===0) accContainer.appendChild(createAccessorySlot());
  updateDividers("accessory-container");

  if(gearData?.pendants) gearData.pendants.forEach(d=>pendantContainer.appendChild(createPendantSlot(d)));
  if(pendantContainer.children.length===0) pendantContainer.appendChild(createPendantSlot());
  updateDividers("pendant-container");

  GEM_LEVELS.forEach((lvl,i)=>{
    const data = gearData?.gems?.[i] || null;
    gemContainer.appendChild(createGemSlot(lvl,data));
  });

  // 버튼 이벤트 (점선 업데이트 포함)
  document.getElementById("add-accessory").onclick = () => { 
    if(accContainer.querySelectorAll('.accessory-slot').length<40){ 
      accContainer.appendChild(createAccessorySlot()); 
      updateDividers("accessory-container"); saveGearUI(); 
    } 
  };
  document.getElementById("remove-accessory").onclick = () => { 
    const slots = accContainer.querySelectorAll('.accessory-slot');
    if(slots.length>1){ slots[slots.length-1].remove(); updateDividers("accessory-container"); saveGearUI(); } 
  };
  document.getElementById("add-pendant").onclick = () => { 
    if(pendantContainer.querySelectorAll('.pendant-slot').length<40){ 
      pendantContainer.appendChild(createPendantSlot()); 
      updateDividers("pendant-container"); saveGearUI(); 
    } 
  };
  document.getElementById("remove-pendant").onclick = () => { 
    const slots = pendantContainer.querySelectorAll('.pendant-slot');
    if(slots.length>1){ slots[slots.length-1].remove(); updateDividers("pendant-container"); saveGearUI(); } 
  };
});