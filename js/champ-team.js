/*
 * 챔대 27마리 정령 배치
 *  - 보유 정령(개수) × 27칸(속성마다 3칸, 칸마다 용). 버프는 속성(또는 전체)별로 — 용 하나에 하나
 *  - 정령 × 칸마다 장비를 가장 좋게 맞춘 비벨, SAR, TAR 을 다 구한 뒤 고른 기준으로 하나씩 채움
 *     · 가장 높은 짝부터  · 속성마다 하나씩 (땅 → 물 → … → 악몽 을 3바퀴)
 *  - 기준선(켜면): 기준선 이상인 칸은 같은 값으로 보고 더 올리지 않음(정령을 아낌). 다 채운 뒤
 *    기준선 아래 칸만 남은 정령으로 바꾸거나 칸끼리 바꿔서 올림 — 기준선 이상인 칸은 손대지 않음
 *  - SAR = 고른 스펙에서 낼 수 있는 최고 비벨 기준 TAR (챔대 21층 탭과 같은 식)
 *  입력은 이 기기 브라우저에 저장 (dv1- 로 시작 → ⋯ 메뉴 초기화 때 같이 지워짐)
 */
(function () {
  "use strict";
  var E = window.CHAMP21, TAR = window.CHAMP21_TAR || {};
  var SK = E.SK, SC = ["hp", "atk", "def"];
  var SAVE = "dv1-champ-team-v1";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString(); };
  var floor1 = function (x) { return (Math.floor(x * 10 + 1e-9) / 10).toFixed(1); };
  var M = function (n) { return (n / 1e6).toFixed(1) + "M"; };
  var ATTR_DRAGONS = {};
  E.DRAGONS.forEach(function (d, i) { (ATTR_DRAGONS[d.attr] = ATTR_DRAGONS[d.attr] || []).push(i); });
  var ATTRS = E.ATTRS.filter(function (a) { return ATTR_DRAGONS[a]; });

  // ── 상태 ─────────────────────────────────────────────────
  var st = { spirits: [], slots: {} };
  var NEED = 27;
  function defSpirit() { return { slots: [{ stat: 0, type: "%" }, { stat: 1, type: "%" }, { stat: 2, type: "%" }, { stat: 0, type: "+" }], bonus: 0, count: 1 }; }
  function defSlots() {
    var o = {};
    ATTRS.forEach(function (a) { var ds = ATTR_DRAGONS[a]; o[a] = [0, 1, 2].map(function (k) { return { d: ds[k % ds.length] }; }); });
    return o;
  }

  // ── 정령 목록 ─────────────────────────────────────────────
  function gradeOf(slots) {
    return typeof spiritGrade === "function" ? spiritGrade(slots.map(function (o) { return SK[o.stat]; }), slots.map(function (o) { return o.type; })) : "";
  }
  function gradeTag(g, size) { return g && typeof spiritGradeTag === "function" ? spiritGradeTag(g, { size: size || 11 }) : ""; }
  function renderSpirits() {
    var list = $("spList");
    if (!st.spirits.length) { list.innerHTML = '<p class="ct-empty">정령이 없어요. [+ 정령 추가] 또는 [용/정령 탭에서 가져오기]를 눌러 주세요.</p>'; counts(); return; }
    list.innerHTML = st.spirits.map(function (sp, i) {
      var pairs = sp.slots.map(function (o, k) {
        return '<div class="k-pair"><select class="sp-stat" data-i="' + i + '" data-k="' + k + '" data-stat="' + SC[o.stat] + '" aria-label="' + (i + 1) + "번 정령 " + (k + 1) + '번 스탯">' +
          SK.map(function (s, si) { return '<option value="' + si + '"' + (si === o.stat ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select>" +
          '<select class="sp-type" data-i="' + i + '" data-k="' + k + '" aria-label="' + (i + 1) + "번 정령 " + (k + 1) + '번 종류"><option' + (o.type === "%" ? " selected" : "") + ">%</option><option" + (o.type === "+" ? " selected" : "") + ">+</option></select></div>";
      }).join("");
      return '<div class="ct-sp">' +
        '<span class="ct-no">' + (i + 1) + "</span>" +
        '<div class="ct-pairs">' + pairs + "</div>" +
        '<div class="ct-sp-b">' +
          '<select class="sp-bonus" data-i="' + i + '" aria-label="' + (i + 1) + '번 정령 부가옵">' + ["체 +40", "공 +10", "방 +10"].map(function (t, b) { return '<option value="' + b + '"' + (b === sp.bonus ? " selected" : "") + ">부 " + t + "</option>"; }).join("") + "</select>" +
          '<label class="ct-n"><input type="number" class="sp-n" data-i="' + i + '" min="1" max="27" value="' + sp.count + '" inputmode="numeric" aria-label="' + (i + 1) + '번 정령 개수"><span>개</span></label>' +
          '<span class="ct-grade">' + gradeTag(gradeOf(sp.slots)) + "</span>" +
          '<button type="button" class="ct-del" data-i="' + i + '" aria-label="' + (i + 1) + '번 정령 지우기">✕</button>' +
        "</div></div>";
    }).join("");
    counts();
  }
  function total() { return st.spirits.reduce(function (t, s) { return t + s.count; }, 0); }
  function counts() {
    var n = total();
    $("spCount").innerHTML = st.spirits.length ? "· " + st.spirits.length + "종 " + n + "개" + (n < NEED ? ' <span class="ct-short">(' + (NEED - n) + "개 모자람)</span>" : "") : "";
  }
  $("spList").addEventListener("change", function (e) {
    var t = e.target, i = +t.dataset.i, sp = st.spirits[i];
    if (!sp) return;
    if (t.classList.contains("sp-stat")) { sp.slots[+t.dataset.k].stat = +t.value; t.dataset.stat = SC[+t.value]; }
    else if (t.classList.contains("sp-type")) sp.slots[+t.dataset.k].type = t.value;
    else if (t.classList.contains("sp-bonus")) sp.bonus = +t.value;
    else if (t.classList.contains("sp-n")) { sp.count = Math.max(1, Math.min(27, parseInt(t.value) || 1)); t.value = sp.count; }
    var row = t.closest(".ct-sp"); if (row) row.querySelector(".ct-grade").innerHTML = gradeTag(gradeOf(sp.slots));
    counts(); save();
  });
  $("spList").addEventListener("click", function (e) {
    var b = e.target.closest(".ct-del"); if (!b) return;
    st.spirits.splice(+b.dataset.i, 1); renderSpirits(); save();
  });
  $("spAdd").addEventListener("click", function () {
    var last = st.spirits[st.spirits.length - 1];
    var sp = last ? JSON.parse(JSON.stringify(last)) : defSpirit(); sp.count = 1;
    st.spirits.push(sp); renderSpirits(); save();
    var rows = $("spList").querySelectorAll(".ct-sp"); if (rows.length) rows[rows.length - 1].scrollIntoView({ block: "nearest" });
  });
  // ── 27칸 ─────────────────────────────────────────────────
  function renderSlots() {
    $("attrGrid").innerHTML = ATTRS.map(function (a) {
      var ds = ATTR_DRAGONS[a];
      return '<div class="ct-attr"><div class="ct-attr-h"><span class="chip">' + a + '</span><small class="ct-attr-buff" data-a="' + a + '"></small></div>' +
        st.slots[a].map(function (sl, k) {
          return '<div class="ct-slot"><span class="ct-slot-no">' + (k + 1) + "</span>" +
            '<select class="sl-d" data-a="' + a + '" data-k="' + k + '" aria-label="' + a + " " + (k + 1) + '번 용">' +
            ds.map(function (i) { return '<option value="' + i + '"' + (i === sl.d ? " selected" : "") + ">" + E.DRAGONS[i].name + "</option>"; }).join("") + "</select></div>";
        }).join("") + "</div>";
    }).join("");
    syncAttrBuff();
  }
  $("attrGrid").addEventListener("change", function (e) {
    var t = e.target, sl = st.slots[t.dataset.a] && st.slots[t.dataset.a][+t.dataset.k];
    if (!sl || !t.classList.contains("sl-d")) return;
    sl.d = +t.value; save();
  });

  // ── 속성 버프 (용 하나에 하나) ────────────────────────────
  var attrOpts = '<option value="">없음</option><option value="*">전체</option>' + E.ATTRS.map(function (a) { return "<option>" + a + "</option>"; }).join("");
  var BUFF_IDS = ["buffHp", "buffAtk", "buffDef"];
  BUFF_IDS.forEach(function (id) {
    $(id).innerHTML = attrOpts;
    $(id).addEventListener("change", function () {
      var v = this.value;
      if (v) BUFF_IDS.forEach(function (o) { if (o !== id && (v === "*" || $(o).value === v || $(o).value === "*")) $(o).value = ""; });
      syncAttrBuff(); save();
    });
  });
  function buffAttrs() { return BUFF_IDS.map(function (id) { return $(id).value; }); }
  function syncAttrBuff() {
    var ba = buffAttrs();
    document.querySelectorAll(".ct-attr-buff").forEach(function (el) {
      var bp = E.buffPcts({ attr: el.dataset.a }, ba), t = bp.map(function (v, s2) { return v ? SK[s2] + " +" + v + "%" : ""; }).filter(Boolean).join(" ");
      el.textContent = t; el.classList.toggle("on", !!t);
    });
  }

  // ── 장비 (챔대 21층 탭과 같음) ────────────────────────────
  $("gemLevel").innerHTML = E.GEM_LEVELS.map(function (L) { return '<option value="' + L + '"' + (L === 40 ? " selected" : "") + ">" + L + "</option>"; }).join("");
  $("accLevel").innerHTML = E.ACC_LEVELS.map(function (L) { return '<option value="' + L + '"' + (L === 19 ? " selected" : "") + ">" + L + "%</option>"; }).join("");
  var CIRC = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯"];
  function addPen(data) {
    var list = $("customPenList");
    if (list.children.length >= 16) return;
    var row = document.createElement("div");
    row.className = "custom-pendant";
    row.innerHTML = '<div class="num"></div>' + [0, 1, 2].map(function (k) {
      return '<div class="option-group"><select aria-label="옵션 ' + (k + 1) + '"><option value="">선택</option><option value="0">체력</option><option value="1">공격</option><option value="2">방어</option></select>' +
        '<input type="number" min="0" max="18" value="0" inputmode="numeric" aria-label="옵션 ' + (k + 1) + ' %"></div>';
    }).join("") + '<button type="button" class="pendant-del" aria-label="이 팬던트 지우기">✕</button>';
    if (data) row.querySelectorAll(".option-group").forEach(function (g, k) {
      var o = data[k] || {}; g.querySelector("select").value = o.s == null ? "" : String(o.s); g.querySelector("input").value = o.v || 0;
    });
    row.querySelector(".pendant-del").addEventListener("click", function () { row.remove(); renumber(); save(); });
    row.addEventListener("change", save);
    list.appendChild(row); renumber();
  }
  function renumber() {
    var rows = $("customPenList").querySelectorAll(".custom-pendant");
    rows.forEach(function (r, i) { r.querySelector(".num").textContent = CIRC[i] || i + 1; });
    $("customPenAdd").disabled = !$("customPenOn").checked || rows.length >= 16 || $("useMyGear").checked;
    $("customPenAdd").textContent = rows.length >= 16 ? "최대 16개" : "+ 팬던트 추가";
  }
  function customPens() {
    var out = [];
    $("customPenList").querySelectorAll(".custom-pendant").forEach(function (r) {
      var p = [0, 0, 0];
      r.querySelectorAll(".option-group").forEach(function (g) { var s = g.querySelector("select").value, v = parseInt(g.querySelector("input").value) || 0; if (s !== "" && v > 0) p[+s] += v; });
      if (p[0] || p[1] || p[2]) out.push({ name: "커스텀", pct: p });
    });
    return out;
  }
  function customPenData() {
    return Array.prototype.map.call($("customPenList").querySelectorAll(".custom-pendant"), function (r) {
      return Array.prototype.map.call(r.querySelectorAll(".option-group"), function (g) { var s = g.querySelector("select").value; return { s: s === "" ? null : +s, v: parseInt(g.querySelector("input").value) || 0 }; });
    });
  }
  $("customPenAdd").addEventListener("click", function () { addPen(); save(); });
  $("customPenOn").addEventListener("change", function () { $("customPenList").classList.toggle("disabled-ui", !this.checked); renumber(); save(); });
  function readMyGear() {
    var gear = {};
    try { gear = JSON.parse(localStorage.getItem("guild_gear_data") || "null") || {}; } catch (e) {}
    var SI = { "체": 0, "공": 1, "방": 2 }, lv = [[], [], []];
    [36, 38, 40, 42, 44].forEach(function (L, i) { var g = (gear.gems || [])[i] || {}; SK.forEach(function (k, s) { var n = Math.max(0, parseInt(g[k]) || 0); for (var j = 0; j < n; j++) lv[s].push(L); }); });
    lv.forEach(function (a) { a.sort(function (x, y) { return y - x; }); });
    var accs = [];
    (gear.accessories || []).forEach(function (a) {
      var L = parseInt(a.value); if (!(L >= 16 && L <= 20)) return;
      var hit = E.accList(L).filter(function (x) { return x.name === a.item + " " + L; })[0]; if (!hit) return;
      accs.push({ name: hit.name, pct: hit.pct, enc: a.enchant === "all" ? null : (SI[a.enchant] != null ? SI[a.enchant] : -1) });
    });
    var pens = [];
    (gear.pendants || []).forEach(function (p) {
      if (p.type !== "달" && p.type !== "태양") return;
      var o = [0, 0, 0], add = function (s2, v) { if (SI[s2] != null) o[SI[s2]] += parseInt(v) || 0; };
      add(p.opt1, p.stat1); add(p.opt2, p.stat2); if (p.type === "태양") add(p.opt3, p.stat3);
      pens.push({ name: p.type, pct: o });
    });
    return { lv: lv, accs: accs, pens: pens };
  }
  function syncMyGear() {
    var on = $("useMyGear").checked;
    document.querySelectorAll(".k-gearfield").forEach(function (el) {
      el.classList.toggle("is-locked", on);
      el.querySelectorAll("select, input, button").forEach(function (x) {
        if (on) { if (!x.disabled) { x.disabled = true; x.dataset.mgLocked = "1"; } }
        else if (x.dataset.mgLocked) { x.disabled = false; delete x.dataset.mgLocked; }
      });
    });
    renumber();
    var note = $("myGearNote");
    if (!on) { note.hidden = true; return; }
    var mg = readMyGear(), gemTxt = mg.lv.map(function (a, s) { return a.length ? SK[s] + " " + a.length + "개" : ""; }).filter(Boolean).join(" · ") || "없음";
    var empty = !mg.lv[0].length && !mg.lv[1].length && !mg.lv[2].length && !mg.accs.length && !mg.pens.length;
    note.hidden = false; note.classList.toggle("is-warn", empty);
    note.innerHTML = empty ? "장비 탭에 넣은 장비가 없어요. 장비 탭에서 젬·장신구·팬던트를 넣어 주세요."
      : "장비 탭 장비로 계산: <b>젬</b> " + gemTxt + " · <b>장신구</b> " + mg.accs.length + "개 · <b>팬던트</b> " + mg.pens.length + "개<br>칸마다 가진 것 중에서 따로 고릅니다 (장비가 칸끼리 겹칠 수 있어요).";
  }
  $("useMyGear").addEventListener("change", function () { syncMyGear(); save(); });
  window.addEventListener("focus", function () { if ($("useMyGear").checked) syncMyGear(); });
  function gearSet() {
    var gems, accs, pens;
    if ($("useMyGear").checked) {
      var mg = readMyGear();
      gems = E.gemCombos({ lv: mg.lv });
      accs = mg.accs.length ? E.accCombos(mg.accs) : [{ name: "없음", base: [0, 0, 0], enc: -1, pct: [0, 0, 0] }];
      pens = mg.pens.length ? mg.pens : [{ name: "없음", pct: [0, 0, 0] }];
    } else {
      gems = E.gemCombos({ level: +$("gemLevel").value });
      accs = E.accCombos(E.accList(+$("accLevel").value), true);
      pens = E.PENDANTS[$("penKind").value].map(function (p) { return { name: $("penKind").value, pct: p }; });
      if ($("customPenOn").checked) pens = pens.concat(customPens());
    }
    var seen = {};
    pens = pens.filter(function (p) { var k = p.pct.join(); if (seen[k]) return false; seen[k] = 1; return true; });
    var out = { gems: gems, accs: E.prune(accs, function (x) { return x.pct; }), pens: E.prune(pens, function (x) { return x.pct; }) };
    out.sig = out.gems.map(function (g) { return g.add.join(","); }).join(";") + "/" + out.accs.map(function (a) { return a.pct.join(","); }).join(";") + "/" + out.pens.map(function (p) { return p.pct.join(","); }).join(";");
    return out;
  }

  // ── 저장 ─────────────────────────────────────────────────
  function save() {
    try {
      localStorage.setItem(SAVE, JSON.stringify({
        spirits: st.spirits, slots: st.slots, buff: buffAttrs(), crit: $("critMode").value, fill: $("fillMode").value,
        lockOn: $("lockOn").checked, lockVal: $("lockVal").value,
        gem: $("gemLevel").value, acc: $("accLevel").value, pen: $("penKind").value,
        myGear: $("useMyGear").checked, customOn: $("customPenOn").checked, custom: customPenData()
      }));
    } catch (e) {}
  }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (e) {}
    st.slots = defSlots();
    if (!s) { st.spirits = [defSpirit()]; addPen(); return; }
    var okSlot = function (o) { return o && Array.isArray(o.slots) && o.slots.length === 4; };
    st.spirits = (s.spirits || []).filter(okSlot).map(function (o) {
      return { slots: o.slots.map(function (x) { return { stat: [0, 1, 2].indexOf(+x.stat) >= 0 ? +x.stat : 0, type: x.type === "+" ? "+" : "%" }; }),
        bonus: [0, 1, 2].indexOf(+o.bonus) >= 0 ? +o.bonus : 0, count: Math.max(1, Math.min(27, parseInt(o.count) || 1)) };
    });
    if (s.slots) ATTRS.forEach(function (a) {
      (s.slots[a] || []).slice(0, 3).forEach(function (o, k) {
        if (!o) return;
        var d = +o.d; if (ATTR_DRAGONS[a].indexOf(d) >= 0) st.slots[a][k] = { d: d };
      });
    });
    var set = function (id, v) { var el = $(id); if (el && v != null && Array.prototype.some.call(el.options || [], function (o) { return o.value === String(v); })) el.value = String(v); };
    if (s.buff) { var used = {}; BUFF_IDS.forEach(function (id, k) { var v = s.buff[k]; if (v && !used[v] && !used["*"] && !(v === "*" && Object.keys(used).length)) { used[v] = 1; set(id, v); } }); }
    set("critMode", s.crit); set("fillMode", s.fill); set("gemLevel", s.gem);
    $("lockOn").checked = !!s.lockOn; if (s.lockVal != null) $("lockVal").value = s.lockVal; set("accLevel", s.acc); set("penKind", s.pen);
    $("useMyGear").checked = !!s.myGear; $("customPenOn").checked = !!s.customOn;
    $("customPenList").classList.toggle("disabled-ui", !s.customOn);
    (s.custom && s.custom.length ? s.custom : [null]).forEach(function (c) { addPen(c); });
  }
  ["fillMode", "gemLevel", "accLevel", "penKind", "lockVal"].forEach(function (id) { $(id).addEventListener("change", save); });
  function syncLock() {
    var vv = $("critMode").value === "vval";
    $("lockOn").disabled = vv; $("lockVal").disabled = vv || !$("lockOn").checked;
    $("lockBox").classList.toggle("is-off", vv || !$("lockOn").checked);
    $("lockNote").dataset.vval = vv ? "1" : "";
  }
  $("critMode").addEventListener("change", function () { syncLock(); save(); });
  $("lockOn").addEventListener("change", function () { syncLock(); save(); });

  // ── 배치 계산 ────────────────────────────────────────────
  function tarRef(d, bp) { var row = TAR[d.name]; return row ? row[E.buffKey(bp)] : null; }
  function run() {
    var n = total();
    if (n < NEED) { $("ctResult").innerHTML = '<div class="k-empty ct-short-box">정령이 ' + n + "개라 27개보다 " + (NEED - n) + "개 모자라요. 정령을 더 넣어 주세요.</div>"; return; }
    var gear = gearSet(), crit = $("critMode").value, fill = $("fillMode").value;
    var lockOn = crit !== "vval" && $("lockOn").checked;
    var T = Math.max(50, Math.min(100, parseFloat($("lockVal").value) || 99));
    var ba = buffAttrs();
    var sps = st.spirits.map(function (s2, i) { return { i: i, sp: s2, left: s2.count, eff: E.spiritEffect(s2.slots, s2.bonus) }; });
    var slots = [];
    ATTRS.forEach(function (a) { st.slots[a].forEach(function (s2, k) { var d = E.DRAGONS[s2.d], bp = E.buffPcts(d, ba); slots.push({ a: a, k: k, d: d, bp: bp, key: d.name + "|" + bp.join() }); }); });

    // 같은 (용, 버프) 칸은 한 번만 계산
    var pool = {}, keySlot = {};
    slots.forEach(function (sl) { if (!pool[sl.key]) { pool[sl.key] = E.bestOverall(sl.d, sl.bp, gear); keySlot[sl.key] = sl; } });
    var score = sps.map(function (x) {
      var row = {};
      Object.keys(pool).forEach(function (key) {
        var sl = keySlot[key], r = E.bestGearFast(sl.d, x.eff, sl.bp, gear), ref = tarRef(sl.d, sl.bp);
        r.sar = E.tarScore(r.v, pool[key].v); r.tar = ref ? E.tarScore(r.v, ref[0]) : 0;
        row[key] = r;
      });
      return row;
    });
    var val = function (r) { return crit === "vval" ? r.v : crit === "tar" ? r.tar : r.sar; };
    var eff = function (r) { var v = val(r); return lockOn ? Math.min(v, T) : v; };
    // 더 좋은 짝? (기준선 켜면: 기준선 넘는 짝끼리는 값이 낮은 쪽 = 정령을 덜 낭비하는 쪽)
    function better(r, b) {
      if (!b) return true;
      var e1 = eff(r), e2 = eff(b);
      if (e1 !== e2) return e1 > e2;
      if (lockOn && e1 >= T) return val(r) < val(b);
      return val(r) > val(b) || (val(r) === val(b) && r.v > b.v);
    }
    var filled = slots.map(function () { return null; }), step = 0;
    function pickInto(slotIdx) {
      var bx = -1, bs = -1, br = null;
      for (var xi = 0; xi < sps.length; xi++) {
        if (sps[xi].left <= 0) continue;
        slotIdx.forEach(function (si) {
          if (filled[si]) return;
          var r = score[xi][slots[si].key];
          if (better(r, br)) { br = r; bx = xi; bs = si; }
        });
      }
      if (bx < 0) return false;
      sps[bx].left--; filled[bs] = { xi: bx, r: br, step: ++step };
      return true;
    }
    var all = slots.map(function (_, i) { return i; });
    if (fill === "round") {
      for (var round = 0; round < 3; round++) ATTRS.forEach(function (a) {
        pickInto(all.filter(function (i) { return slots[i].a === a; }));
      });
    } else {
      while (pickInto(all)) {}
    }

    // 기준선: 기준선 아래 칸만 남은 정령과 바꾸거나 칸끼리 바꿔서 올림 (기준선 이상 칸은 그대로)
    var moves = 0;
    if (lockOn) {
      var q = function (r) { return Math.min(val(r), T); };
      for (var guard = 0; guard < 2000; guard++) {
        var low = all.filter(function (i) { return filled[i] && val(filled[i].r) < T; });
        if (!low.length) break;
        var best = null;
        low.forEach(function (i) {
          var cur = filled[i];
          // 남은 정령으로 바꾸기
          sps.forEach(function (x, xi) {
            if (x.left <= 0 || xi === cur.xi) return;
            var r = score[xi][slots[i].key], gain = q(r) - q(cur.r);
            if (gain > 1e-9 && (!best || gain > best.gain)) best = { type: "swapIn", i: i, xi: xi, r: r, gain: gain };
          });
          // 기준선 아래 칸끼리 바꾸기
          low.forEach(function (j) {
            if (j <= i) return;
            var a1 = score[filled[j].xi][slots[i].key], a2 = score[cur.xi][slots[j].key];
            var gain = q(a1) + q(a2) - q(cur.r) - q(filled[j].r);
            if (gain > 1e-9 && (!best || gain > best.gain)) best = { type: "swap", i: i, j: j, r1: a1, r2: a2, gain: gain };
          });
        });
        if (!best) break;
        moves++;
        if (best.type === "swapIn") { sps[filled[best.i].xi].left++; sps[best.xi].left--; filled[best.i] = { xi: best.xi, r: best.r, step: filled[best.i].step, moved: true }; }
        else { var fi = filled[best.i], fj = filled[best.j]; filled[best.i] = { xi: fj.xi, r: best.r1, step: fi.step, moved: true }; filled[best.j] = { xi: fi.xi, r: best.r2, step: fj.step, moved: true }; }
      }
    }
    render(slots, filled, sps, pool, { crit: crit, fill: fill, lockOn: lockOn, T: T, moves: moves, val: val });
  }

  function sc(t) { return String(t).replace(/(체|공|방)(\d+%?|%|\+(?=\s|$|·|\/))?/g, function (m, s2) { return '<span class="sc sc-' + SC[SK.indexOf(s2)] + '">' + m + "</span>"; }); }
  function penText(p) { var t = p.pct.map(function (v, s) { return v ? SK[s] + v : ""; }).filter(Boolean).join("/"); return t ? (p.name && p.name !== "커스텀" ? p.name + " " : "커스텀 ") + t : "없음"; }
  function accText(a) { return a.name === "없음" ? "없음" : a.name + (a.enc >= 0 ? " · 인챈 " + SK[a.enc] + "21" : ""); }

  var CRIT_NAME = { sar: "SAR", tar: "TAR", vval: "비벨" };
  function render(slots, filled, sps, pool, o) {
    var n = 0, sumV = 0, sumSar = 0, sumTar = 0, over = 0;
    filled.forEach(function (f) { if (f) { n++; sumV += f.r.v; sumSar += f.r.sar; sumTar += f.r.tar; if (o.lockOn && o.val(f.r) >= o.T) over++; } });
    var leftList = sps.filter(function (x) { return x.left > 0; });
    var leftN = leftList.reduce(function (t, x) { return t + x.left; }, 0);
    var h = '<h2 class="res-h">배치 결과 <small class="k-dim">· ' + CRIT_NAME[o.crit] + " · " + (o.fill === "round" ? "속성마다 하나씩" : "높은 짝부터") + (o.lockOn ? " · 기준선 " + o.T + "%" : "") + "</small></h2>";
    h += '<div class="ct-sum"><div><b>' + M(sumV) + "</b><small>비벨 합</small></div>" +
      "<div><b>" + floor1(sumSar / n) + "%</b><small>평균 SAR</small></div>" +
      "<div><b>" + floor1(sumTar / n) + "%</b><small>평균 TAR</small></div>" +
      (o.lockOn ? "<div><b>" + over + '<span class="ct-of">/' + n + "</span></b><small>기준선 이상</small></div>" : "<div><b>" + leftN + "</b><small>남은 정령</small></div>") + "</div>";
    if (o.lockOn && o.moves) h += '<p class="cm-legend">기준선 아래 칸을 올리려고 ' + o.moves + "번 바꿔 넣었어요 (바뀐 칸은 ↻).</p>";
    h += '<p class="cm-legend">#번호 = 들어간 순서 · <b>SAR</b> = 그 칸(용·버프)에서 고른 스펙으로 낼 수 있는 최고 비벨 기준 TAR · <b>TAR</b> = 최고 스펙 기준 (디비룡). 칸을 누르면 장비가 보여요.</p>';
    h += '<div class="ct-res">';
    ATTRS.forEach(function (a) {
      var mine = slots.map(function (s2, i) { return { s: s2, f: filled[i] }; }).filter(function (x) { return x.s.a === a; });
      h += '<section class="ct-res-attr"><div class="ct-attr-h"><span class="chip">' + a + "</span>" + buffBadge(mine[0].s.bp) + "</div>";
      mine.forEach(function (x) {
        var s2 = x.s, f = x.f;
        if (!f) { h += '<div class="ct-cell is-none"><div class="ct-cell-h"><b>' + esc(s2.d.name) + '</b></div><p class="ct-none">정령 부족</p></div>'; return; }
        var r = f.r, spx = sps[f.xi], lab = E.spiritLabel(spx.sp.slots, spx.sp.bonus), g = gradeOf(spx.sp.slots), best = pool[s2.key];
        var ok = o.lockOn && o.val(r) >= o.T;
        h += '<details class="ct-cell' + (ok ? " is-ok" : "") + '"><summary>' +
          '<div class="ct-cell-h"><span class="ct-step">#' + f.step + (f.moved ? " ↻" : "") + "</span><b>" + esc(s2.d.name) + "</b>" +
            '<span class="ct-sar"><b>' + floor1(o.crit === "tar" ? r.tar : r.sar) + "%</b><small>" + (o.crit === "tar" ? "TAR" : "SAR") + "</small></span></div>" +
          '<div class="ct-cell-sp">' + sc(esc(lab)) + gradeTag(g) + ' <small class="k-dim">· ' + (spx.i + 1) + "번 정령</small></div>" +
          '<div class="ct-cell-v"><b>' + fmt(r.v) + '</b><small>비벨</small><span class="ct-tar">' + (o.crit === "tar" ? "SAR " + floor1(r.sar) : "TAR " + floor1(r.tar)) + "%</span></div>" +
          '<div class="cm-stats"><span class="cm-st hp">' + fmt(r.hp) + '</span><span class="cm-st atk">' + fmt(r.atk) + '</span><span class="cm-st def">' + fmt(r.def) + "</span></div>" +
          '</summary><div class="cm-det">' +
          '<div class="cm-det-row"><span class="cm-det-k">장비</span><span>젬 ' + sc(esc(r.gem.text)) + " · " + sc(esc(accText(r.acc))) + " · " + sc(esc(penText(r.pen))) + "</span></div>" +
          '<div class="cm-det-row"><span class="cm-det-k">이 칸 최고<br>(SAR 100%)</span><span>' + sc(esc(E.spiritLabel(best.slots, best.bonus))) + " · 비벨 " + fmt(best.v) + "</span></div>" +
          "</div></details>";
      });
      h += "</section>";
    });
    h += "</div>";
    if (leftList.length) {
      h += '<h3 class="ct-left-h">남은 정령 (' + leftN + "개)</h3><div class=\"ct-left\">" + leftList.map(function (x) {
        var lab = E.spiritLabel(x.sp.slots, x.sp.bonus);
        return '<span class="ct-left-i">' + (x.i + 1) + "번 " + sc(esc(lab)) + gradeTag(gradeOf(x.sp.slots)) + (x.left > 1 ? " ×" + x.left : "") + "</span>";
      }).join("") + "</div>";
    }
    $("ctResult").innerHTML = h;
  }
  function buffBadge(bp) { return bp.map(function (v, s2) { return v ? '<span class="cm-buff">' + SK[s2] + " +" + v + "%</span>" : ""; }).join(""); }

  $("calcButton").addEventListener("click", function () {
    save();
    var btn = this; btn.disabled = true;
    $("ctResult").innerHTML = '<div class="k-empty">정령 배치 계산 중…</div>';
    setTimeout(function () {
      try { run(); } finally { btn.disabled = false; }
      var el = document.querySelector("#ctResult .res-h");
      if (el && window.GUILD_UI_V2 && window.GUILD_UI_V2.scrollTo) window.GUILD_UI_V2.scrollTo(el);
      else if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  });

  load(); renderSpirits(); renderSlots(); syncMyGear(); syncLock();
})();
