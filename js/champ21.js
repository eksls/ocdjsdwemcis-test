/*
 * 챔대 21층 화면
 *  - 내 정령 넣기: 19마리 전부에 넣어 보고 (용마다 장비 최적) 비벨·스탯·TAR 을 보여줌
 *  - 정령 최적화: 고른 용 / 속성의 용만, 정령 3888가지 × 장비 전부 → 비벨 높은 정령 순
 *  - TAR: n% = 같은 장비에서 가장 좋은 정령 대비, (m%) = 디비룡 TAR 식으로 그 용의 TAR 100% 기준 대비
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
  var attrOpts = '<option value="">없음</option>' + E.ATTRS.map(function (a) { return "<option>" + a + "</option>"; }).join("");
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
  })();

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
    return { gems: gems, accs: E.prune(accs, function (x) { return x.pct; }), pens: E.prune(pens, function (x) { return x.pct; }) };
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
        mode: spMode(), sp: inputSpirit(), sort: $("sortMode").value, target: $("optTarget").value, limit: $("optLimit").value,
        buff: [$("buffHp").value, $("buffAtk").value, $("buffDef").value], buffMode: buffMode(), buffMulti: $("buffMulti").checked,
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
    set("sortMode", s.sort); set("optTarget", s.target); set("optLimit", s.limit);
    if (s.buff) { set("buffHp", s.buff[0]); set("buffAtk", s.buff[1]); set("buffDef", s.buff[2]); }
    set("gemLevel", s.gem); set("accLevel", s.acc); set("penKind", s.pen);
    $("useMyGear").checked = !!s.myGear; $("customPenOn").checked = !!s.customOn;
    $("customPenList").classList.toggle("disabled-ui", !s.customOn);
    (s.custom && s.custom.length ? s.custom : [null]).forEach(function (c) { addPen(c); });
    var r = document.querySelector('input[name="spMode"][value="' + (s.mode === "opt" ? "opt" : "input") + '"]'); if (r) r.checked = true;
    var rb = document.querySelector('input[name="buffMode"][value="' + (s.buffMode === "opt" ? "opt" : "attr") + '"]'); if (rb) rb.checked = true;
    $("buffMulti").checked = !!s.buffMulti;
  }
  ["sortMode", "optTarget", "optLimit", "buffHp", "buffAtk", "buffDef", "gemLevel", "accLevel", "penKind", "spBonus"].forEach(function (id) { $(id).addEventListener("change", save); });
  $("spBonus").addEventListener("change", syncGrade);

  // ── 버프 ─────────────────────────────────────────────────
  function buffMode() { var r = document.querySelector('input[name="buffMode"]:checked'); return r ? r.value : "attr"; }
  function syncBuffMode() {
    var opt = buffMode() === "opt";
    $("buffOptBox").hidden = !opt; $("buffAttrBox").hidden = opt; $("buffAttrNote").hidden = opt;
  }
  document.querySelectorAll('input[name="buffMode"]').forEach(function (r) { r.addEventListener("change", function () { syncBuffMode(); save(); }); });
  $("buffMulti").addEventListener("change", save);
  var ONE = [[0, 0, 0], [40, 0, 0], [0, 40, 0], [0, 0, 50]];
  var MULTI = [[40, 40, 0], [40, 0, 50], [0, 40, 50], [40, 40, 50]];
  // 그 용이 받을 버프 상태 목록: 속성별로 고르기 = 1개, 버프 최적화 = 전부
  function buffStates(d) {
    if (buffMode() !== "opt") return [E.buffPcts(d, buffAttrs())];
    return $("buffMulti").checked ? ONE.concat(MULTI) : ONE;
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
  function penText(p) { var t = p.pct.map(function (v, s) { return v ? SK[s] + v : ""; }).filter(Boolean).join("/"); return t ? (p.name && p.name !== "커스텀" ? p.name + " " : "커스텀 ") + t : "없음"; }
  function accText(a) { return a.name === "없음" ? "없음" : a.name + (a.enc >= 0 ? " · 인챈 " + SK[a.enc] + "21" : ""); }
  function sc(t) { return String(t).replace(/(체|공|방)(\d+%?|%|\+(?=\s|$|·|\/))?/g, function (m, st) { return '<span class="sc sc-' + SC[SK.indexOf(st)] + '">' + m + "</span>"; }); }
  function buffBadges(bp) {
    return bp.map(function (v, s) { return v ? '<span class="cm-buff">' + SK[s] + " +" + v + "%</span>" : ""; }).join("");
  }
  function statsHtml(r) {
    return '<span class="cm-st hp">' + fmt(r.hp) + '</span><span class="cm-st atk">' + fmt(r.atk) + '</span><span class="cm-st def">' + fmt(r.def) + "</span>";
  }
  function tarHtml(v, ref, self) {
    if (!ref) return "-";
    var m = E.tarScore(v, ref[0]);
    return (self != null ? floor1(self) + "%" : "") + '<span class="cm-tar-m">(' + floor1(m) + "%)</span>";
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
    var rows = E.DRAGONS.map(function (d) {
      var all = buffStates(d).map(function (bp) {
        var r = E.bestGear(d, eff, bp, gear);
        var bestSp = E.bestSpiritForGear(d, r.gem, r.acc, r.pen, bp);
        var ref = tarRef(d, bp);
        r.d = d; r.bp = bp; r.ref = ref; r.bestSp = bestSp;
        r.self = bestSp ? Math.min(100, r.v / bestSp.v * 100) : null;
        r.ratio = ref ? r.v / ref[0] : 0;
        return r;
      });
      var bi = 0; all.forEach(function (x, i) { if (x.v > all[bi].v) bi = i; });
      var r = all[bi]; r.all = all; r.bi = bi;
      return r;
    });
    var byTar = $("sortMode").value !== "vval";
    rows.sort(function (a, b) { return byTar ? (b.ratio - a.ratio || b.v - a.v) : (b.v - a.v); });
    var g = gradeOf(sp.slots);
    var h = '<h2 class="res-h">' + sc(esc(E.spiritLabel(sp.slots, sp.bonus))) + gradeTag(g, 12) + ' <small class="k-dim">· 19마리 · ' + (byTar ? "TAR 순" : "비벨 순") + (bOpt ? " · 버프 최적화" : "") + "</small></h2>";
    if (bOpt) h += '<p class="cm-legend">버프 최적화: 용마다 비벨이 가장 높은 버프로 보여주고, 버프별 비벨과 (TAR)을 아래 줄에 같이 적었어요 (★ = 가장 좋은 버프).</p>';
    h += '<p class="cm-legend">TAR <b>n%</b> = 같은 장비에서 가장 좋은 정령 대비 · <b>(m%)</b> = 그 용의 TAR 100% 기준 대비 (디비룡 TAR 식). 줄을 누르면 자세히 보여요.</p>';
    h += '<div class="cm-list">' + rows.map(function (r, i) {
      var top = i === 0 ? ' <span class="cm-best">' + (byTar ? "가장 잘 맞음" : "비벨 1위") + "</span>" : "";
      var bs = r.bestSp, bsLabel = bs ? E.spiritLabel(bs.slots, bs.bonus) : "";
      return '<details class="cm-row' + (r.bp.some(Boolean) ? " is-buff" : "") + '"><summary>' +
        '<span class="cm-rank">' + (i + 1) + "</span>" +
        '<span class="cm-name"><span class="chip' + (r.bp.some(Boolean) ? " chip-buff" : "") + '">' + esc(r.d.attr) + "</span><b>" + esc(r.d.name) + "</b>" + buffBadges(r.bp) + top + "</span>" +
        '<span class="cm-v"><b>' + fmt(r.v) + '</b><small>비벨</small></span>' +
        '<span class="cm-tar"><b>' + tarHtml(r.v, r.ref, r.self) + "</b><small>TAR</small></span>" +
        '<span class="cm-stats">' + statsHtml(r) + "</span>" +
        bufsHtml(r.all, r.bi, function (x) { return "<b>" + M(x.v) + "</b>" + (x.ref ? "<small>(" + floor1(E.tarScore(x.v, x.ref[0])) + "%)</small>" : ""); }) +
        '<span class="cm-gap">' + gapHtml(r.v, r.ref) + "</span>" +
        "</summary><div class=\"cm-det\">" +
        '<div class="cm-det-row"><span class="cm-det-k">장비</span><span>젬 ' + sc(esc(r.gem.text)) + " · " + sc(esc(accText(r.acc))) + " · " + sc(esc(penText(r.pen))) + "</span></div>" +
        '<div class="cm-det-row"><span class="cm-det-k">기본 스탯</span><span>' + r.d.hp + " / " + r.d.atk + " / " + r.d.def + " (이벨 " + fmt(r.d.hp + 4 * r.d.atk + 4 * r.d.def) + ") · 최종 이벨 " + fmt(r.ev) + "</span></div>" +
        (bs ? '<div class="cm-det-row"><span class="cm-det-k">이 장비 최고 정령</span><span>' + sc(esc(bsLabel)) + gradeTag(typeof spiritGradeFromLabel === "function" ? spiritGradeFromLabel(bsLabel) : "") + " · 비벨 " + fmt(bs.v) + " (" + bs.hp + "/" + bs.atk + "/" + bs.def + ")</span></div>" : "") +
        refHtml(r.ref) + "</div></details>";
    }).join("") + "</div>";
    $("cmResult").innerHTML = h;
  }

  // ── 계산: 정령 최적화 (고른 용/속성만) ───────────────────
  function runOpt(done) {
    var tv = $("optTarget").value, list;
    if (tv.indexOf("a:") === 0) { var a = tv.slice(2); list = E.DRAGONS.filter(function (d) { return d.attr === a; }); }
    else list = [E.DRAGONS[+tv.slice(2)]].filter(Boolean);
    var gear = gearSet(), limit = +$("optLimit").value || 20;
    var out = [], i = 0;
    var res = $("cmResult");
    function step() {
      if (i >= list.length) { render(); done(); return; }
      res.innerHTML = '<div class="k-empty">정령 최적화 중… ' + list[i].name + " (" + (i + 1) + "/" + list.length + ")</div>";
      setTimeout(function () {
        var d = list[i];
        var states = buffStates(d).map(function (bp) { return { bp: bp, ref: tarRef(d, bp), rows: E.optimizeSpirits(d, bp, gear, limit) }; });
        var bi = 0; states.forEach(function (x, k) { if (x.rows[0] && x.rows[0].v > states[bi].rows[0].v) bi = k; });
        out.push({ d: d, states: states, bi: bi, bp: states[bi].bp, ref: states[bi].ref });
        i++; step();
      }, 30);
    }
    function render() {
      var h = '<h2 class="res-h">정령 최적화 <small class="k-dim">· ' + list.map(function (d) { return esc(d.name); }).join(", ") + "</small></h2>";
      h += '<p class="cm-legend">용마다 정령 3,888가지에 장비를 전부 넣어 보고, 그 정령의 가장 좋은 장비로 계산한 비벨 순입니다. <b>(m%)</b> = 그 용의 TAR 100% 기준 대비.</p>';
      out.forEach(function (o, oi) {
        var multi = o.states.length > 1;
        h += '<section class="cm-opt"><div class="cm-opt-h"><span class="chip' + (o.bp.some(Boolean) ? " chip-buff" : "") + '">' + esc(o.d.attr) + "</span><b>" + esc(o.d.name) + "</b>" + (multi ? "" : buffBadges(o.bp)) +
          '<small class="k-dim">기본 ' + o.d.hp + "/" + o.d.atk + "/" + o.d.def + (!multi && o.ref ? " · TAR 100% " + fmt(o.ref[0]) : "") + "</small></div>";
        if (multi) {
          h += '<div class="cm-btabs" role="tablist">' + o.states.map(function (st, k) {
            var top = st.rows[0];
            return '<button type="button" class="cm-btab' + (k === o.bi ? " on" : "") + '" data-sec="' + oi + '" data-k="' + k + '">' + (k === o.bi ? "★ " : "") + esc(buffName(st.bp)) +
              "<b>" + (top ? M(top.v) : "-") + "</b>" + (top && st.ref ? "<small>TAR 100% " + M(st.ref[0]) + "</small>" : "") + "</button>";
          }).join("") + "</div>";
        }
        o.states.forEach(function (st, k) {
          h += '<div class="cm-list cm-blist" data-sec="' + oi + '" data-k="' + k + '"' + (k === o.bi ? "" : " hidden") + ">" + st.rows.map(function (r, j) {
            var lab = E.spiritLabel(r.slots, r.bonus), g = typeof spiritGradeFromLabel === "function" ? spiritGradeFromLabel(lab) : "";
            return '<details class="cm-row"><summary>' +
              '<span class="cm-rank">' + (j + 1) + "</span>" +
              '<span class="cm-name cm-sp">' + sc(esc(lab)) + gradeTag(g) + (multi ? buffBadges(st.bp) : "") + "</span>" +
              '<span class="cm-v"><b>' + fmt(r.v) + '</b><small>비벨</small></span>' +
              '<span class="cm-tar"><b>' + tarHtml(r.v, st.ref, null) + "</b><small>TAR</small></span>" +
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
