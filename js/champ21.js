/*
 * 챔대 21층 화면
 *  - 내 정령 넣기: 고른 용(전체 / 속성 / 1마리)에 넣어 보고 (용마다 장비 최적) 비벨·스탯·TAR 을 보여줌
 *  - 정령 최적화: 고른 용 / 속성의 용만, 정령 3888가지 × 장비 전부 → 비벨 높은 정령 순
 *  - SAR (Spirit Achievement Rate): 같은 장비에서 가장 좋은 정령 대비 % — 장비 영향 없이 정령만 비교
 *    최고장비 SAR: 이 정령을 TAR 100% 기준 장비에 넣었을 때 ÷ TAR 100%
 *  - TAR: 디비룡 TAR 식으로 그 용의 TAR 100% 기준 대비 (장비 포함)
 *  입력은 이 기기 브라우저에 저장 (dv1- 로 시작 → ⋯ 메뉴 초기화 때 같이 지워짐)
 */
(function () {
  "use strict";
  var E = window.CHAMP21, TAR = window.CHAMP21_TAR || {};
  var SK = E.SK, SC = ["hp", "atk", "def"];
  var SAVE = "dv1-champ21-v1";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString(); };
  var floor1 = function (x) { return (Math.floor(x * 10 + 1e-9) / 10).toFixed(1); };
  var M = function (n) { return (n / 1e6).toFixed(1) + "M"; };

  // ── 입력 만들기 ───────────────────────────────────────────
  var slotsEl = $("spSlots");
  slotsEl.innerHTML = [0, 1, 2, 3].map(function (i) {
    return '<div class="k-slot"><span>' + (i + 1) + '번</span><div class="k-pair">' +
      '<select class="sp-stat" aria-label="' + (i + 1) + '번 스탯"><option value="0">체</option><option value="1">공</option><option value="2">방</option></select>' +
      '<select class="sp-type" aria-label="' + (i + 1) + '번 종류"><option>%</option><option>+</option></select></div></div>';
  }).join("");
  var attrOpts = '<option value="">없음</option><option value="*">전체</option>' + E.ATTRS.map(function (a) { return "<option>" + a + "</option>"; }).join("");
  ["buffHp", "buffAtk", "buffDef"].forEach(function (id) { $(id).innerHTML = attrOpts; });
  $("gemLevel").innerHTML = E.GEM_LEVELS.map(function (L) { return '<option value="' + L + '"' + (L === 40 ? " selected" : "") + ">" + L + "</option>"; }).join("");
  $("accLevel").innerHTML = E.ACC_LEVELS.map(function (L) { return '<option value="' + L + '"' + (L === 19 ? " selected" : "") + ">" + L + "%</option>"; }).join("");
  // 최적화 대상: 속성(그 속성 용 전부) / 용 1마리
  (function () {
    var byAttr = {};
    E.DRAGONS.forEach(function (d, i) { (byAttr[d.attr] = byAttr[d.attr] || []).push(i); });
    var h = '<optgroup label="속성 (그 속성 용 전부)">';
    E.ATTRS.forEach(function (a) { if (byAttr[a]) h += '<option value="a:' + a + '">' + a + " · " + byAttr[a].map(function (i) { return E.DRAGONS[i].name; }).join(", ") + "</option>"; });
    h += '</optgroup><optgroup label="용 1마리">';
    E.DRAGONS.forEach(function (d, i) { h += '<option value="d:' + i + '">' + d.name + " (" + d.attr + ")</option>"; });
    $("optTarget").innerHTML = h + "</optgroup>";
    // 내 정령 넣기: 전체도 고를 수 있음
    $("inTarget").innerHTML = '<option value="all">전체 19마리</option>' + h + "</optgroup>";
  })();
  // 고른 대상 → 용 목록 ("all" / "a:속성" / "d:번호")
  function targetList(v) {
    if (v === "all") return E.DRAGONS.slice();
    if (v && v.indexOf("a:") === 0) { var a = v.slice(2); return E.DRAGONS.filter(function (d) { return d.attr === a; }); }
    return [E.DRAGONS[+String(v).slice(2)]].filter(Boolean);
  }
  function targetName(v, n) {
    if (v === "all") return "19마리";
    if (v && v.indexOf("a:") === 0) return v.slice(2) + " " + n + "마리";
    return n ? targetList(v)[0].name : "";
  }

  // 기본 정령: 체% 공% 방% 체+
  var spStats = slotsEl.querySelectorAll(".sp-stat"), spTypes = slotsEl.querySelectorAll(".sp-type");
  [0, 1, 2, 0].forEach(function (s, i) { spStats[i].value = String(s); });
  spTypes[3].value = "+";

  // ── 커스텀 팬던트 ─────────────────────────────────────────
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
      r.querySelectorAll(".option-group").forEach(function (g) {
        var s = g.querySelector("select").value, v = parseInt(g.querySelector("input").value) || 0;
        if (s !== "" && v > 0) p[+s] += v;
      });
      if (p[0] || p[1] || p[2]) out.push({ name: "커스텀", pct: p });
    });
    return out;
  }
  function customPenData() {
    return Array.prototype.map.call($("customPenList").querySelectorAll(".custom-pendant"), function (r) {
      return Array.prototype.map.call(r.querySelectorAll(".option-group"), function (g) {
        var s = g.querySelector("select").value; return { s: s === "" ? null : +s, v: parseInt(g.querySelector("input").value) || 0 };
      });
    });
  }
  $("customPenAdd").addEventListener("click", function () { addPen(); save(); });
  $("customPenOn").addEventListener("change", function () { $("customPenList").classList.toggle("disabled-ui", !this.checked); renumber(); save(); });

  // ── 내 장비 (장비 탭) ─────────────────────────────────────
  function readMyGear() {
    var gear = {};
    try { gear = JSON.parse(localStorage.getItem("guild_gear_data") || "null") || {}; } catch (e) {}
    var SI = { "체": 0, "공": 1, "방": 2 };
    var lv = [[], [], []];
    [36, 38, 40, 42, 44].forEach(function (L, i) {
      var g = (gear.gems || [])[i] || {};
      SK.forEach(function (k, s) { var n = Math.max(0, parseInt(g[k]) || 0); for (var j = 0; j < n; j++) lv[s].push(L); });
    });
    lv.forEach(function (a) { a.sort(function (x, y) { return y - x; }); });
    var accs = [];
    (gear.accessories || []).forEach(function (a) {
      var L = parseInt(a.value);
      if (!(L >= 16 && L <= 20)) return;
      var hit = E.accList(L).filter(function (x) { return x.name === a.item + " " + L; })[0];
      if (!hit) return;
      accs.push({ name: hit.name, pct: hit.pct, enc: a.enchant === "all" ? null : (SI[a.enchant] != null ? SI[a.enchant] : -1) });
    });
    var pens = [];
    (gear.pendants || []).forEach(function (p) {
      if (p.type !== "달" && p.type !== "태양") return;
      var o = [0, 0, 0], add = function (st, v) { if (SI[st] != null) o[SI[st]] += parseInt(v) || 0; };
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
    note.hidden = false;
    note.classList.toggle("is-warn", empty);
    note.innerHTML = empty ? "장비 탭에 넣은 장비가 없어요. 장비 탭에서 젬·장신구·팬던트를 넣어 주세요."
      : "장비 탭 장비로 계산: <b>젬</b> " + gemTxt + " · <b>장신구</b> " + mg.accs.length + "개 · <b>팬던트</b> " + mg.pens.length + "개<br>가진 것 중에서 고릅니다 (젬은 스탯마다 높은 단계부터 5개까지). 용마다 따로 고르므로 장비가 겹칠 수 있어요.";
  }
  $("useMyGear").addEventListener("change", function () { syncMyGear(); save(); });
  window.addEventListener("focus", function () { if ($("useMyGear").checked) syncMyGear(); });

  // 계산에 쓸 장비 후보
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

  // ── 정령 입력 ─────────────────────────────────────────────
  function inputSpirit() {
    var slots = [0, 1, 2, 3].map(function (i) { return { stat: +spStats[i].value, type: spTypes[i].value }; });
    return { slots: slots, bonus: +$("spBonus").value };
  }
  function gradeOf(slots) {
    return typeof spiritGrade === "function" ? spiritGrade(slots.map(function (o) { return SK[o.stat]; }), slots.map(function (o) { return o.type; })) : "";
  }
  function gradeTag(g, size) { return g && typeof spiritGradeTag === "function" ? spiritGradeTag(g, { size: size || 11 }) : ""; }
  function syncGrade() {
    var sp = inputSpirit(), g = gradeOf(sp.slots);
    $("spGrade").innerHTML = g ? gradeTag(g, 12.5) : '<span class="k-dim">이름 없는 형태</span>';
    Array.prototype.forEach.call(spStats, function (el, i) { el.dataset.stat = SC[sp.slots[i].stat]; });
  }
  slotsEl.addEventListener("change", function () { syncGrade(); save(); });

  // 정령 모드 전환
  function spMode() { var r = document.querySelector('input[name="spMode"]:checked'); return r ? r.value : "input"; }
  function syncMode() {
    var opt = spMode() === "opt";
    $("spInput").hidden = opt; $("spOpt").hidden = !opt;
    $("calcButton").textContent = opt ? "정령 최적화" : "계산하기";
  }
  document.querySelectorAll('input[name="spMode"]').forEach(function (r) { r.addEventListener("change", function () { syncMode(); save(); }); });

  // ── 저장 / 불러오기 ───────────────────────────────────────
  function save() {
    try {
      localStorage.setItem(SAVE, JSON.stringify({
        mode: spMode(), sp: inputSpirit(), sort: $("sortMode").value, target: $("optTarget").value, inTarget: $("inTarget").value, limit: $("optLimit").value,
        buff: [$("buffHp").value, $("buffAtk").value, $("buffDef").value], buffMode: buffMode(),
        gem: $("gemLevel").value, acc: $("accLevel").value, pen: $("penKind").value,
        myGear: $("useMyGear").checked, customOn: $("customPenOn").checked, custom: customPenData()
      }));
    } catch (e) {}
  }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (e) {}
    if (!s) { addPen(); return; }
    var set = function (id, v) { var el = $(id); if (el && v != null && Array.prototype.some.call(el.options || [], function (o) { return o.value === String(v); })) el.value = String(v); };
    if (s.sp && s.sp.slots) s.sp.slots.forEach(function (o, i) { if (spStats[i]) { spStats[i].value = String(o.stat); spTypes[i].value = o.type === "+" ? "+" : "%"; } });
    if (s.sp) set("spBonus", s.sp.bonus);
    set("sortMode", s.sort); set("optTarget", s.target); set("inTarget", s.inTarget); set("optLimit", s.limit);
    if (s.buff) {
      var used = {};
      ["buffHp", "buffAtk", "buffDef"].forEach(function (id, k) { var v = s.buff[k]; if (v && !used[v]) { used[v] = 1; set(id, v); } });
    }
    set("gemLevel", s.gem); set("accLevel", s.acc); set("penKind", s.pen);
    $("useMyGear").checked = !!s.myGear; $("customPenOn").checked = !!s.customOn;
    $("customPenList").classList.toggle("disabled-ui", !s.customOn);
    (s.custom && s.custom.length ? s.custom : [null]).forEach(function (c) { addPen(c); });
    var r = document.querySelector('input[name="spMode"][value="' + (s.mode === "opt" ? "opt" : "input") + '"]'); if (r) r.checked = true;
    var rb = document.querySelector('input[name="buffMode"][value="' + (s.buffMode === "opt" ? "opt" : "attr") + '"]'); if (rb) rb.checked = true;
  }
  ["sortMode", "inTarget", "optTarget", "optLimit", "buffHp", "buffAtk", "buffDef", "gemLevel", "accLevel", "penKind", "spBonus"].forEach(function (id) { $(id).addEventListener("change", save); });
  $("spBonus").addEventListener("change", syncGrade);

  // ── 버프 ─────────────────────────────────────────────────
  function buffMode() { var r = document.querySelector('input[name="buffMode"]:checked'); return r ? r.value : "attr"; }
  function syncBuffMode() {
    var opt = buffMode() === "opt";
    $("buffOptBox").hidden = !opt; $("buffAttrBox").hidden = opt; $("buffAttrNote").hidden = opt;
  }
  document.querySelectorAll('input[name="buffMode"]').forEach(function (r) { r.addEventListener("change", function () { syncBuffMode(); save(); }); });
  // 버프는 용 하나에 하나: 버프 없음 / 체 +40% / 공 +40% / 방 +50%
  var ONE = [[0, 0, 0], [40, 0, 0], [0, 40, 0], [0, 0, 50]];
  // 속성별로 고르기: 버프는 용 하나에 하나
  //  - 같은 속성을 두 칸에 고르면 먼저 고른 칸을 비움
  //  - "전체"를 고르면 다른 칸을 비우고, 다른 칸에 속성을 고르면 "전체" 칸을 비움
  ["buffHp", "buffAtk", "buffDef"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      var v = this.value; if (!v) return;
      ["buffHp", "buffAtk", "buffDef"].forEach(function (o) {
        if (o === id) return;
        if (v === "*" || $(o).value === v || $(o).value === "*") $(o).value = "";
      });
    });
  });
  // 그 용이 받을 버프 상태 목록: 속성별로 고르기 = 1개, 버프 최적화 = 전부
  function buffStates(d) {
    if (buffMode() !== "opt") return [E.buffPcts(d, buffAttrs())];
    return ONE;
  }
  function buffName(bp) { var t = bp.map(function (v, s) { return v ? SK[s] + "+" + v : ""; }).filter(Boolean).join(" "); return t || "버프 없음"; }
  function bufsHtml(list, bestIdx, valFn) {
    if (list.length < 2) return "";
    return '<span class="cm-bufs">' + list.map(function (x, i) {
      return '<span class="cm-bf' + (i === bestIdx ? " is-best" : "") + '"><i>' + esc(buffName(x.bp)) + "</i>" + valFn(x) + "</span>";
    }).join("") + "</span>";
  }

  // ── 결과 표시 도우미 ─────────────────────────────────────
  function buffAttrs() { return [$("buffHp").value, $("buffAtk").value, $("buffDef").value]; }
  function tarRef(d, bp) { var row = TAR[d.name]; return row ? row[E.buffKey(bp)] : null; }
  var REF_GEAR = null, POOL = {};
  // 고른 스펙(젬·장신구·팬던트 후보)에서 낼 수 있는 최고 비벨 (정령+장비 함께 최적) — 스펙이 같으면 다시 안 구함
  function poolBest(d, bp, gear) {
    var k = d.name + "|" + bp.join() + "|" + gear.sig;
    return POOL[k] || (POOL[k] = E.bestOverall(d, bp, gear));
  }
  // 줄마다 세 가지 (모두 디비룡 TAR 과 같은 점수식: r ≤ 1 → 200r − 100)
  //  self (SAR) = 지금 비벨 ÷ 고른 스펙에서 낼 수 있는 최고 비벨 → 스펙이 같은 정령끼리 비교. 최고 스펙(44·20·태양)을 고르면 TAR 과 같음
  //  pure (최고스펙 SAR) = 이 정령을 최고 스펙에 넣었을 때 ÷ TAR 100%
  //  dbr  (TAR) = 지금 비벨 ÷ TAR 100%
  function addTars(r, d, eff, bp, gear, best) {
    REF_GEAR = REF_GEAR || E.referenceGear();
    best = best || poolBest(d, bp, gear);
    r.poolBest = best;
    r.self = best ? E.tarScore(r.v, best.v) : null;
    r.ref = tarRef(d, bp);
    r.pure = r.ref ? E.tarScore(E.bestGear(d, eff, bp, REF_GEAR).v, r.ref[0]) : null;
    r.dbr = r.ref ? E.tarScore(r.v, r.ref[0]) : null;
    r.ratio = r.ref ? r.v / r.ref[0] : 0;
    r.selfRatio = best ? r.v / best.v : 0;
    return r;
  }
  function sortKey() {
    var m = $("sortMode").value;
    if (m === "vval") return function (r) { return r.v; };
    if (m === "tar") return function (r) { return r.ratio; };
    return function (r) { return r.selfRatio || 0; };
  }
  var LEGEND = '<p class="cm-legend"><b>SAR</b> (Spirit Achievement Rate) = 고른 스펙(젬·장신구·팬던트)으로 낼 수 있는 최고 비벨 기준 TAR — 같은 스펙끼리 정령만 비교 · <b>TAR</b> = 최고 스펙(44젬·20장·태양) 기준 TAR (디비룡) · <b>최고스펙 SAR</b> = 이 정령을 최고 스펙에 넣었을 때의 TAR. 셋 다 디비룡 TAR 식이라 최고 스펙을 고르면 SAR = TAR 이에요. SAR 은 높은데 TAR 만 낮으면 정령은 좋은 거라 장비만 올리면 돼요.</p>';
  var SORT_NAME = { sar: "SAR 순", tar: "TAR 순", vval: "비벨 순" };
  function penText(p) { var t = p.pct.map(function (v, s) { return v ? SK[s] + v : ""; }).filter(Boolean).join("/"); return t ? (p.name && p.name !== "커스텀" ? p.name + " " : "커스텀 ") + t : "없음"; }
  function accText(a) { return a.name === "없음" ? "없음" : a.name + (a.enc >= 0 ? " · 인챈 " + SK[a.enc] + "21" : ""); }
  function sc(t) { return String(t).replace(/(체|공|방)(\d+%?|%|\+(?=\s|$|·|\/))?/g, function (m, st) { return '<span class="sc sc-' + SC[SK.indexOf(st)] + '">' + m + "</span>"; }); }
  function buffBadges(bp) {
    return bp.map(function (v, s) { return v ? '<span class="cm-buff">' + SK[s] + " +" + v + "%</span>" : ""; }).join("");
  }
  function statsHtml(r) {
    return '<span class="cm-st hp">' + fmt(r.hp) + '</span><span class="cm-st atk">' + fmt(r.atk) + '</span><span class="cm-st def">' + fmt(r.def) + "</span>";
  }
  function tarHtml(r) {
    var main = r.self != null ? floor1(r.self) + "%" : "-";
    return '<b>' + main + '</b><small>SAR</small>' +
      '<span class="cm-tar-sub">' + (r.dbr != null ? "<span>TAR " + floor1(r.dbr) + "%</span>" : "") + (r.pure != null ? "<span>최고장비 SAR " + floor1(r.pure) + "%</span>" : "") + "</span>";
  }
  // 정령은 좋은데 장비가 모자란 경우 표시
  function adviceTag(r) {
    if (r.pure != null && r.pure >= 99 && r.dbr != null && r.dbr < 94) return '<span class="cm-adv" title="최고장비 SAR 이 100%에 가까운 정령이에요. 버리지 말고 장비를 올리세요.">정령 OK · 장비 업글</span>';
    return "";
  }
  function gapHtml(v, ref) {
    if (!ref) return "";
    var d = v - ref[0], r = v / ref[0] * 100;
    return "TAR 100% " + M(ref[0]) + " 대비 <b>" + (d >= 0 ? "+" : "−") + M(Math.abs(d)) + "</b> (" + floor1(r) + "%)";
  }
  function refHtml(ref) {
    if (!ref) return "";
    var g = typeof spiritGradeFromLabel === "function" ? spiritGradeFromLabel(ref[1]) : "";
    return '<div class="cm-det-row"><span class="cm-det-k">TAR 100% 세팅</span><span>' + sc(esc(ref[1])) + gradeTag(g) + " · 비벨 " + fmt(ref[0]) +
      '<br><small>젬 ' + sc(esc(ref[2])) + " · " + sc(esc(ref[3])) + " · 태양 " + sc(esc(ref[4])) + " → " + ref[5].join(" / ") + "</small></span></div>";
  }

  // ── 계산: 내 정령 넣기 ────────────────────────────────────
  function runInput() {
    var sp = inputSpirit(), eff = E.spiritEffect(sp.slots, sp.bonus), gear = gearSet(), bOpt = buffMode() === "opt";
    var tv = $("inTarget").value, list = targetList(tv);
    var rows = list.map(function (d) {
      var all = buffStates(d).map(function (bp) {
        var r = E.bestGear(d, eff, bp, gear);
        r.d = d; r.bp = bp;
        return addTars(r, d, eff, bp, gear);
      });
      var bi = 0; all.forEach(function (x, i) { if (x.v > all[bi].v) bi = i; });
      var r = all[bi]; r.all = all; r.bi = bi;
      return r;
    });
    var key = sortKey(), byTar = $("sortMode").value !== "vval";
    rows.sort(function (a, b) { return key(b) - key(a) || b.v - a.v; });
    var g = gradeOf(sp.slots);
    var h = '<h2 class="res-h">' + sc(esc(E.spiritLabel(sp.slots, sp.bonus))) + gradeTag(g, 12) + ' <small class="k-dim">· ' + esc(targetName(tv, list.length)) + ' · ' + SORT_NAME[$("sortMode").value] + (bOpt ? " · 버프 최적화" : "") + "</small></h2>";
    if (bOpt) h += '<p class="cm-legend">버프 최적화: 용마다 비벨이 가장 높은 버프로 보여주고, 버프별 비벨과 (TAR)을 아래 줄에 같이 적었어요 (★ = 가장 좋은 버프).</p>';
    h += LEGEND;
    h += '<div class="cm-list">' + rows.map(function (r, i) {
      var top = (i === 0 && rows.length > 1 ? ' <span class="cm-best">' + (byTar ? "가장 잘 맞음" : "비벨 1위") + "</span>" : "") + adviceTag(r);
      var bs = r.poolBest, bsLabel = bs ? E.spiritLabel(bs.slots, bs.bonus) : "";
      return '<details class="cm-row' + (r.bp.some(Boolean) ? " is-buff" : "") + '"><summary>' +
        '<span class="cm-rank">' + (i + 1) + "</span>" +
        '<span class="cm-name"><span class="chip' + (r.bp.some(Boolean) ? " chip-buff" : "") + '">' + esc(r.d.attr) + "</span><b>" + esc(r.d.name) + "</b>" + buffBadges(r.bp) + top + "</span>" +
        '<span class="cm-v"><b>' + fmt(r.v) + '</b><small>비벨</small></span>' +
        '<span class="cm-tar">' + tarHtml(r) + "</span>" +
        '<span class="cm-stats">' + statsHtml(r) + "</span>" +
        bufsHtml(r.all, r.bi, function (x) { return "<b>" + M(x.v) + "</b>" + (x.self != null ? "<small>SAR " + floor1(x.self) + "%</small>" : ""); }) +
        '<span class="cm-gap">' + gapHtml(r.v, r.ref) + "</span>" +
        "</summary><div class=\"cm-det\">" +
        '<div class="cm-det-row"><span class="cm-det-k">장비</span><span>젬 ' + sc(esc(r.gem.text)) + " · " + sc(esc(accText(r.acc))) + " · " + sc(esc(penText(r.pen))) + "</span></div>" +
        '<div class="cm-det-row"><span class="cm-det-k">기본 스탯</span><span>' + r.d.hp + " / " + r.d.atk + " / " + r.d.def + " (이벨 " + fmt(r.d.hp + 4 * r.d.atk + 4 * r.d.def) + ") · 최종 이벨 " + fmt(r.ev) + "</span></div>" +
        (bs ? '<div class="cm-det-row"><span class="cm-det-k">이 스펙 최고<br>(SAR 100%)</span><span>' + sc(esc(bsLabel)) + gradeTag(typeof spiritGradeFromLabel === "function" ? spiritGradeFromLabel(bsLabel) : "") + " · 비벨 " + fmt(bs.v) + '<br><small>젬 ' + sc(esc(bs.gem.text)) + " · " + sc(esc(accText(bs.acc))) + " · " + sc(esc(penText(bs.pen))) + " → " + bs.hp + " / " + bs.atk + " / " + bs.def + "</small></span></div>" : "") +
        refHtml(r.ref) + "</div></details>";
    }).join("") + "</div>";
    $("cmResult").innerHTML = h;
  }

  // ── 계산: 정령 최적화 (고른 용/속성만) ───────────────────
  function runOpt(done) {
    var list = targetList($("optTarget").value);
    var gear = gearSet(), limit = +$("optLimit").value || 20;
    var out = [], i = 0;
    var res = $("cmResult");
    function step() {
      if (i >= list.length) { render(); done(); return; }
      res.innerHTML = '<div class="k-empty">정령 최적화 중… ' + list[i].name + " (" + (i + 1) + "/" + list.length + ")</div>";
      setTimeout(function () {
        var d = list[i];
        var key = sortKey();
        var states = buffStates(d).map(function (bp) {
          var raw = E.optimizeSpirits(d, bp, gear, limit), best = raw[0] || null;
          var rows = raw.map(function (r) { return addTars(r, d, E.spiritEffect(r.slots, r.bonus), bp, gear, best); });
          var top = best;
          rows.sort(function (a, b) { return key(b) - key(a) || b.v - a.v; });
          return { bp: bp, ref: tarRef(d, bp), rows: rows, top: top };
        });
        var bi = 0; states.forEach(function (x, k) { if (x.top && x.top.v > states[bi].top.v) bi = k; });
        out.push({ d: d, states: states, bi: bi, bp: states[bi].bp, ref: states[bi].ref });
        i++; step();
      }, 30);
    }
    function render() {
      var h = '<h2 class="res-h">정령 최적화 <small class="k-dim">· ' + list.map(function (d) { return esc(d.name); }).join(", ") + "</small></h2>";
      h += '<p class="cm-legend">용마다 정령 3,888가지에 장비를 전부 넣어 보고, 비벨 높은 정령 ' + limit + '개를 ' + SORT_NAME[$("sortMode").value] + '으로 보여줍니다.</p>' + LEGEND;
      out.forEach(function (o, oi) {
        var multi = o.states.length > 1;
        h += '<section class="cm-opt"><div class="cm-opt-h"><span class="chip' + (o.bp.some(Boolean) ? " chip-buff" : "") + '">' + esc(o.d.attr) + "</span><b>" + esc(o.d.name) + "</b>" + (multi ? "" : buffBadges(o.bp)) +
          '<small class="k-dim">기본 ' + o.d.hp + "/" + o.d.atk + "/" + o.d.def + (!multi && o.ref ? " · TAR 100% " + fmt(o.ref[0]) : "") + "</small></div>";
        if (multi) {
          h += '<div class="cm-btabs" role="tablist">' + o.states.map(function (st, k) {
            var top = st.top;
            return '<button type="button" class="cm-btab' + (k === o.bi ? " on" : "") + '" data-sec="' + oi + '" data-k="' + k + '">' + (k === o.bi ? "★ " : "") + esc(buffName(st.bp)) +
              "<b>" + (top ? M(top.v) : "-") + "</b>" + (top && st.ref ? "<small>TAR 100% " + M(st.ref[0]) + "</small>" : "") + "</button>";
          }).join("") + "</div>";
        }
        o.states.forEach(function (st, k) {
          h += '<div class="cm-list cm-blist" data-sec="' + oi + '" data-k="' + k + '"' + (k === o.bi ? "" : " hidden") + ">" + st.rows.map(function (r, j) {
            var lab = E.spiritLabel(r.slots, r.bonus), g = typeof spiritGradeFromLabel === "function" ? spiritGradeFromLabel(lab) : "";
            return '<details class="cm-row"><summary>' +
              '<span class="cm-rank">' + (j + 1) + "</span>" +
              '<span class="cm-name cm-sp">' + sc(esc(lab)) + gradeTag(g) + (multi ? buffBadges(st.bp) : "") + adviceTag(r) + "</span>" +
              '<span class="cm-v"><b>' + fmt(r.v) + '</b><small>비벨</small></span>' +
              '<span class="cm-tar">' + tarHtml(r) + "</span>" +
              '<span class="cm-stats">' + statsHtml(r) + "</span>" +
              '<span class="cm-gap">' + gapHtml(r.v, st.ref) + "</span>" +
              '</summary><div class="cm-det"><div class="cm-det-row"><span class="cm-det-k">장비</span><span>젬 ' + sc(esc(r.gem.text)) + " · " + sc(esc(accText(r.acc))) + " · " + sc(esc(penText(r.pen))) + "</span></div>" +
              (j === 0 ? refHtml(st.ref) : "") + "</div></details>";
          }).join("") + "</div>";
        });
        h += "</section>";
      });
      res.innerHTML = h;
      res.querySelectorAll(".cm-btab").forEach(function (b) {
        b.addEventListener("click", function () {
          var sec = b.dataset.sec;
          res.querySelectorAll('.cm-btab[data-sec="' + sec + '"]').forEach(function (x) { x.classList.toggle("on", x === b); });
          res.querySelectorAll('.cm-blist[data-sec="' + sec + '"]').forEach(function (x) { x.hidden = x.dataset.k !== b.dataset.k; });
        });
      });
    }
    step();
  }

  $("calcButton").addEventListener("click", function () {
    var btn = this;
    save();
    if (spMode() === "opt") {
      btn.disabled = true;
      runOpt(function () { btn.disabled = false; scrollToResult(); });
    } else { runInput(); scrollToResult(); }
  });
  function scrollToResult() {
    var el = document.querySelector("#cmResult .res-h");
    if (el && window.GUILD_UI_V2 && window.GUILD_UI_V2.scrollTo) window.GUILD_UI_V2.scrollTo(el);
    else if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  load(); syncMode(); syncBuffMode(); syncGrade(); syncMyGear();
})();
