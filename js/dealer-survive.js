/* 정타 딜러 계산기 화면 (계산은 dealer-survive-engine.js) */
(function () {
  "use strict";
  var E = window.DealerSurvive;
  var STORE = "dv1-dealer-survive-v1";   // dv1- 로 시작 → 상단 ⋯ 메뉴의 초기화 때 같이 지워짐
  var GEM_VALUES = [44, 42, 40, 38, 36];
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString("ko-KR"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var lastSolved = null, activeKey = null;

  // ---------- 입력칸 만들기 ----------
  var slotsBox = $("spiritSlots");
  for (var i = 0; i < 4; i++) {
    var wrap = document.createElement("div");
    wrap.className = "ds-slot";
    wrap.innerHTML = '<span>' + (i + 1) + '번</span><div class="ds-pair">' +
      '<select class="sp-stat" aria-label="' + (i + 1) + '번 정령 스탯"><option>공</option><option>체</option><option>방</option></select>' +
      '<select class="sp-mode" aria-label="' + (i + 1) + '번 정령 종류"><option>%</option><option>+</option></select></div>';
    slotsBox.appendChild(wrap);
  }
  GEM_VALUES.forEach(function (v) {
    var o = document.createElement("option"); o.value = v; o.textContent = v; if (v === 40) o.selected = true; $("gemValue").appendChild(o);
  });

  function gemNote() {
    var v = +$("gemValue").value;
    $("gemNote").innerHTML = '젬 1개: <span class="s-hp">체력 +' + v * 4 + '</span> / <span class="s-atk">공격 +' + v + '</span> / <span class="s-def">방어 +' + v + '</span> · 5개를 어떻게 나눌지는 자동';
  }
  function hitModeUi() { $("guardField").classList.toggle("ds-hide", $("hitMode").value !== "guard"); }

  // 용/정령 탭에서 정령 불러오기
  function fillImport() {
    var sel = $("spiritImport");
    var list = [];
    try { list = (typeof loadData === "function" ? loadData(STORAGE_KEYS.DRAGON) : null) || []; } catch (e) {}
    var rIdx = 0;
    list.forEach(function (d, idx) {
      var label = d.name && d.name.trim();
      if (d.attrKey === "reserve") { rIdx++; if (!label) label = "예비 정령" + rIdx; }
      var stats = d.spiritStats || [];
      if (!label || !stats.some(function (s) { return s === "체" || s === "공" || s === "방"; })) return;
      var o = document.createElement("option");
      o.value = idx;
      o.textContent = label + " (" + stats.map(function (s, k) { return s === "옵" ? "-" : s + ((d.spiritTypes || [])[k] || ""); }).join(" ") + ")";
      sel.appendChild(o);
    });
    sel.onchange = function () {
      var d = list[+sel.value];
      if (!d) return;
      var stat = document.querySelectorAll(".sp-stat"), mode = document.querySelectorAll(".sp-mode");
      for (var k = 0; k < 4; k++) {
        var s = (d.spiritStats || [])[k], t = (d.spiritTypes || [])[k];
        if (s === "체" || s === "공" || s === "방") stat[k].value = s;
        mode[k].value = t === "+" ? "+" : "%";
      }
      $("spiritBonus").value = ({ "체": "체", "공": "공", "방": "방" })[d.bonus] || "없음";
      sel.value = "";
      paintSelects(); save();
    };
  }

  // 체/공/방 선택 색 (새 디자인의 ui-v2.js 가 data-stat 으로 칠함)
  function paintSelects() {
    document.querySelectorAll(".sp-stat").forEach(function (s) {
      s.setAttribute("data-stat", { "체": "hp", "공": "atk", "방": "def" }[s.value]);
    });
  }

  // ---------- 저장 / 불러오기 ----------
  function readForm() {
    return {
      hitMode: $("hitMode").value, hits: $("hits").value, guards: $("guards").value, bossAtk: $("bossAtk").value,
      slots: Array.prototype.map.call(document.querySelectorAll(".ds-slot"), function (w) {
        return { stat: w.querySelector(".sp-stat").value, mode: w.querySelector(".sp-mode").value };
      }),
      bonus: $("spiritBonus").value, pendantKind: $("pendantKind").value, gemValue: $("gemValue").value,
      grade: $("grade").value, accMode: $("accMode").value, limit: $("limit").value,
      buffs: [$("buffHp").value, $("buffAtk").value, $("buffDef").value]
    };
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(readForm())); } catch (e) {} }
  function load() {
    var f = null;
    try { f = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) {}
    if (!f) return;
    ["hitMode", "hits", "guards", "bossAtk", "pendantKind", "gemValue", "grade", "accMode", "limit"].forEach(function (k) {
      if (f[k] == null || !$(k)) return;
      $(k).value = f[k];
      if ($(k).tagName === "SELECT" && $(k).selectedIndex < 0) $(k).selectedIndex = 0;   // 없어진 선택지
    });
    if (f.bonus) $("spiritBonus").value = f.bonus;
    (f.slots || []).forEach(function (s, k) {
      var w = document.querySelectorAll(".ds-slot")[k]; if (!w) return;
      if (s.stat) w.querySelector(".sp-stat").value = s.stat;
      if (s.mode) w.querySelector(".sp-mode").value = s.mode;
    });
    if (f.buffs) { $("buffHp").value = f.buffs[0]; $("buffAtk").value = f.buffs[1]; $("buffDef").value = f.buffs[2]; }
  }

  // ---------- 계산 ----------
  function num(v, d) { var n = parseInt(v, 10); return isFinite(n) && n >= 0 ? n : d; }
  function run() {
    var f = readForm();
    var opts = {
      grade: f.grade, spirit: { slots: f.slots, bonus: f.bonus }, gemValue: +f.gemValue,
      pendantKind: f.pendantKind, accMode: "all", accLevel: +f.accMode || 20,
      enchantValue: 21, hits: num(f.hits, 0), guards: f.hitMode === "guard" ? num(f.guards, 0) : 0,
      bossAtk: num(f.bossAtk, 2750) || 2750, buffs: f.buffs.map(function (b) { return num(b, 0); }), limit: +f.limit || 20
    };
    lastSolved = { opts: opts, list: E.solve(opts) };
    // 처음엔 공격력이 가장 높은 용을 펼침
    if (!activeKey || !lastSolved.list.some(function (x) { return x.dragon.key === activeKey && x.results.length; })) {
      var best = null;
      lastSolved.list.forEach(function (x) { if (x.results[0] && (!best || x.results[0].atk > best.results[0].atk)) best = x; });
      activeKey = (best || lastSolved.list[0]).dragon.key;
    }
    render();
    if (window.GUILD_UI_V2) window.GUILD_UI_V2.scrollTo($("result"));
  }

  function hitText(o) {
    return "정타 " + o.hits + "대" + (o.guards ? " + 방어 " + o.guards + "회" : "");
  }
  function gemText(g) {
    var p = [];
    if (g[0]) p.push('<span class="s-hp">체' + g[0] + '</span>');
    if (g[1]) p.push('<span class="s-atk">공' + g[1] + '</span>');
    if (g[2]) p.push('<span class="s-def">방' + g[2] + '</span>');
    return "젬 " + p.join(" ");
  }
  function colorStats(text) {
    return esc(text).replace(/(체)(\d+)/g, '<span class="s-hp">$1$2</span>').replace(/(공)(\d+)/g, '<span class="s-atk">$1$2</span>').replace(/(방)(\d+)/g, '<span class="s-def">$1$2</span>');
  }

  function render() {
    var o = lastSolved.opts;
    var tabs = lastSolved.list.map(function (x) {
      var top = x.results[0];
      return '<button type="button" class="ds-tab' + (x.dragon.key === activeKey ? " is-on" : "") + (top ? "" : " is-none") + '" data-key="' + x.dragon.key + '">' +
        '<span class="t-name">' + esc(x.dragon.name) + '</span>' +
        (top ? '<span class="t-atk">' + fmt(top.atk) + '</span><span class="t-sub">남는 체력 ' + fmt(top.left) + '</span>'
             : '<span class="t-atk">생존 불가</span><span class="t-sub">조건을 낮춰 보세요</span>') + '</button>';
    }).join("");

    var cur = lastSolved.list.filter(function (x) { return x.dragon.key === activeKey; })[0];
    var body;
    if (!cur.results.length) {
      var u = cur.bestUnsafe;
      body = '<div class="ds-empty"><b>' + esc(cur.dragon.name) + '</b>은(는) ' + esc(hitText(o)) + '을(를) 버티는 조합이 없습니다.' +
        (u ? '<br>가장 단단하게 맞춘 조합(' + gemText(u.gems) + ', ' + colorStats(u.acc.label) + ', ' + colorStats(u.penLabel) + ')도 체력 ' + fmt(u.hp) + '에 받는 피해 ' + fmt(u.taken) + '라서 ' + fmt(1 - u.left) + ' 모자랍니다. 정타 수를 줄이거나 층 버프를 넣어 보세요.' : '') + '</div>';
    } else {
      body = '<div class="ds-list">' + cur.results.map(function (r, i) {
        return '<div class="ds-row">' +
          '<div class="ds-rank">' + (i + 1) + '</div>' +
          '<div class="ds-main"><span class="atk"><small>공격</small>' + fmt(r.atk) + '</span>' +
            '<span class="ds-stats"><span class="s-hp">체 <b>' + fmt(r.hp) + '</b></span><span class="s-def">방 <b>' + fmt(r.def) + '</b></span></span></div>' +
          '<div class="ds-left">받는 피해 <b>' + fmt(r.taken) + '</b> (정타 ' + fmt(r.hit) + (o.guards ? ' · 방어 ' + fmt(r.guard) : '') + ') → 남는 체력 <b>' + fmt(r.left) + '</b></div>' +
          '<div class="ds-gear"><span class="ds-chip">' + gemText(r.gems) + '</span><span class="ds-chip">' + colorStats(r.acc.label) + '</span><span class="ds-chip">' + colorStats(r.penLabel) + '</span></div>' +
        '</div>';
      }).join("") + '</div>';
    }

    $("result").innerHTML =
      '<div class="ds-head"><h2>결과 · ' + esc(hitText(o)) + ' 생존</h2><small>공격력 높은 순 · 보스 공격 ' + fmt(o.bossAtk) + '</small></div>' +
      '<div class="ds-tabs">' + tabs + '</div>' +
      '<div class="ds-head"><h2>' + esc(cur.dragon.name) + ' 상위 ' + cur.results.length + '개</h2><small>생존 조합 ' + fmt(cur.survivable) + ' / ' + fmt(cur.total) + '</small></div>' +
      body;

    Array.prototype.forEach.call(document.querySelectorAll(".ds-tab"), function (b) {
      b.onclick = function () { activeKey = b.getAttribute("data-key"); render(); };
    });
  }

  // ---------- 연결 ----------
  load();
  fillImport();
  gemNote(); hitModeUi(); paintSelects();
  document.addEventListener("change", function (e) {
    if (e.target.id === "spiritImport") return;
    if (e.target.id === "gemValue") gemNote();
    if (e.target.id === "hitMode") hitModeUi();
    paintSelects(); save();
  });
  document.addEventListener("input", function (e) { if (e.target.tagName === "INPUT") save(); });
  $("calcButton").addEventListener("click", run);
})();
