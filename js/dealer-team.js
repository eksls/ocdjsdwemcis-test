/* 정타 딜러 4마리 화면 (계산은 dealer-team-engine.js) */
(function () {
  "use strict";
  var DS = window.DealerSurvive, DT = window.DealerTeam;
  var STORE = "dv1-dealer-team-v1";      // dv1- → ⋯ 메뉴의 초기화 때 같이 지워짐
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString("ko-KR"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var SC = { "체": "s-hp", "공": "s-atk", "방": "s-def" };
  var GEM_LV = [44, 42, 40, 38, 36, 35, 34, 33];
  var ACC_ITEMS = Object.keys(DS.ACCESSORY_STATS);
  var ACC_NAME = {
    "황보": "황보 (공)", "여보": "여보 (방)", "악보": "악보 (체)",
    "물뿔(체/공)": "물뿔 체/공", "물뿔(체/방)": "물뿔 체/방", "불뿔(공/체)": "불뿔 공/체", "불뿔(공/방)": "불뿔 공/방",
    "대뿔(방/체)": "대뿔 방/체", "대뿔(방/공)": "대뿔 방/공", "바뿔(공/체)": "바뿔 공/체", "바뿔(공/방)": "바뿔 공/방", "바뿔(체/방)": "바뿔 체/방"
  };
  function accItemsFor(level) {
    if (+level === 20) return ACC_ITEMS;
    if (+level === 17) return ["전체", "황보"];
    return ["전체"].concat(ACC_ITEMS);
  }
  var PEN_OPTS = {
    "달": ["전체", "공12", "체12", "방12", "공6체6", "공6방6", "체6방6"],
    "태양": ["공12체6", "공12방6", "체12공6", "체12방6", "방12공6", "방12체6", "체6공6방6"]
  };
  function penVec(key) {
    var v = [0, 0, 0], re = /(체|공|방)(\d+)/g, m;
    while ((m = re.exec(key))) v[["체", "공", "방"].indexOf(m[1])] = +m[2];
    return v;
  }
  function penText(key) { return key === "전체" ? "전체" : key.replace(/(\d+)(?=[체공방])/g, "$1 "); }

  // ---------- 상태 ----------
  function defaults() {
    return {
      hitsA: 4, guardsA: 1, hitsB: 3, guardsB: 0, bossAtk: 2750, grade: "9.0",
      types: DS.DRAGONS.map(function (d) { return d.key; }),
      spirits: [],
      gems: { 44: [0, 10, 0], 42: [0, 0, 0], 40: [5, 5, 5], 38: [0, 0, 0], 36: [0, 0, 0], 35: [0, 0, 0], 34: [0, 0, 0], 33: [0, 0, 0] },
      accs: [{ level: 19, item: "전체", enchant: "자유", count: 0 }, { level: 20, item: "황보", enchant: "공", count: 1 }],
      pens: [{ kind: "달", opt: "전체", count: 0 }],
      buffs: [0, 0, 0], topK: 3, timeLimit: 15000
    };
  }
  var st;
  try { st = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { st = null; }
  if (!st || !Array.isArray(st.spirits)) st = defaults();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {} }

  // ---------- 그리기 ----------
  function sel(cls, opts, value, attrs) {
    return '<select class="' + cls + '"' + (attrs || "") + ">" + opts.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? " selected" : "") + ">" + esc(t) + "</option>";
    }).join("") + "</select>";
  }
  function statAttr(v) { return ' data-stat="' + ({ "체": "hp", "공": "atk", "방": "def" }[v] || "") + '"'; }

  function renderTypes() {
    $("typeChecks").innerHTML = DS.DRAGONS.map(function (d) {
      var on = st.types.indexOf(d.key) >= 0;
      return '<label class="dt-check' + (on ? " is-on" : "") + '"><input type="checkbox" data-type="' + d.key + '"' + (on ? " checked" : "") + '><span>' + esc(d.short) + "</span><small>" + esc(d.name) + "</small></label>";
    }).join("");
  }
  function renderSpirits() {
    $("spiritList").innerHTML = st.spirits.map(function (sp, i) {
      var grade = typeof spiritGrade === "function" ? spiritGrade(sp.slots.map(function (s) { return s.stat; }), sp.slots.map(function (s) { return s.mode; })) : null;
      return '<div class="dt-row dt-sp" data-i="' + i + '">' +
        '<span class="dt-no">' + (i + 1) + "</span>" +
        '<div class="dt-sp-slots">' + sp.slots.map(function (s, k) {
          return '<div class="ds-pair">' + sel("sp-stat", ["공", "체", "방"], s.stat, ' data-k="' + k + '"' + statAttr(s.stat)) + sel("sp-mode", ["%", "+"], s.mode, ' data-k="' + k + '"') + "</div>";
        }).join("") + "</div>" +
        '<div class="dt-sp-bonus">' + sel("sp-bonus", [["체", "체+40"], ["공", "공+10"], ["방", "방+10"], ["없음", "부옵 없음"]], sp.bonus) +
        '<label class="dt-count"><input type="number" class="sp-n" min="1" max="99" inputmode="numeric" value="' + (sp.count || 1) + '" aria-label="정령 ' + (i + 1) + ' 개수"><span>개</span></label>' +
        (grade && typeof spiritGradeTag === "function" ? spiritGradeTag(grade, { size: 10.5 }) : "") + "</div>" +
        '<button type="button" class="dt-del" aria-label="정령 ' + (i + 1) + ' 지우기">✕</button></div>';
    }).join("") || '<p class="dt-empty">"용/정령 탭에서 가져오기"를 누르거나 "+ 추가"로 정령을 넣으세요.</p>';
    $("spiritCount").textContent = st.spirits.reduce(function (t, s) { return t + (s.count || 1); }, 0) + "개";
  }
  function renderGems() {
    var tot = [0, 0, 0];
    var rows = GEM_LV.map(function (lv) {
      var g = st.gems[lv] || [0, 0, 0];
      g.forEach(function (n, s) { tot[s] += +n || 0; });
      return '<div class="dt-gem-row"><span class="dt-gem-lv">' + lv + "</span>" + [0, 1, 2].map(function (s) {
        return '<input type="number" min="0" max="99" inputmode="numeric" class="gem-n ' + ["s-hp", "s-atk", "s-def"][s] + '" data-lv="' + lv + '" data-s="' + s + '" value="' + (g[s] || 0) + '" aria-label="' + lv + " " + ["체력", "공격", "방어"][s] + ' 젬 개수">';
      }).join("") + "</div>";
    }).join("");
    $("gemGrid").innerHTML = '<div class="dt-gem-row dt-gem-head"><span></span><span class="s-hp">체력</span><span class="s-atk">공격</span><span class="s-def">방어</span></div>' + rows +
      '<div class="dt-gem-row dt-gem-sum"><span>합</span><span class="s-hp">' + tot[0] + '</span><span class="s-atk">' + tot[1] + '</span><span class="s-def">' + tot[2] + "</span></div>";
    $("gemCount").textContent = (tot[0] + tot[1] + tot[2]) + "개";
  }
  function renderAccs() {
    $("accList").innerHTML = st.accs.map(function (a, i) {
      var items = accItemsFor(a.level);
      if (items.indexOf(a.item) < 0) a.item = items[0];
      var all = a.item === "전체";
      return '<div class="dt-row dt-acc" data-i="' + i + '">' +
        sel("acc-level", [[20, "20"], [19, "19"], [18, "18"], [17, "17"]], a.level) +
        sel("acc-item", items.map(function (it) { return [it, it === "전체" ? "전체 (종류 전부)" : (+a.level === 17 && it === "황보" ? "황보주 (공17%)" : ACC_NAME[it])]; }), a.item) +
        sel("acc-enc", [["자유", "인챈 자유"], ["공", "인챈 공"], ["체", "인챈 체"], ["방", "인챈 방"]], a.enchant) +
        (all ? '<span class="dt-inf">∞</span>' : '<input type="number" class="acc-n" min="1" max="99" inputmode="numeric" value="' + (a.count || 1) + '" aria-label="개수">') +
        '<button type="button" class="dt-del" aria-label="장신구 지우기">✕</button></div>';
    }).join("") || '<p class="dt-empty">장신구를 추가하세요.</p>';
    var n = st.accs.reduce(function (t, a) { return a.item === "전체" ? Infinity : t + (+a.count || 0); }, 0);
    $("accCount").textContent = n === Infinity ? "제한 없음" : n + "개";
  }
  function renderPens() {
    $("penList").innerHTML = st.pens.map(function (p, i) {
      var opts = PEN_OPTS[p.kind];
      if (opts.indexOf(p.opt) < 0) p.opt = opts[0];
      var all = p.opt === "전체";
      return '<div class="dt-row dt-pen" data-i="' + i + '">' +
        sel("pen-kind", ["달", "태양"], p.kind) +
        sel("pen-opt", opts.map(function (o) { return [o, penText(o)]; }), p.opt) +
        (all ? '<span class="dt-inf">∞</span>' : '<input type="number" class="pen-n" min="1" max="99" inputmode="numeric" value="' + (p.count || 1) + '" aria-label="개수">') +
        '<button type="button" class="dt-del" aria-label="팬던트 지우기">✕</button></div>';
    }).join("") || '<p class="dt-empty">팬던트를 추가하세요.</p>';
    var n = st.pens.reduce(function (t, p) { return p.opt === "전체" ? Infinity : t + (+p.count || 0); }, 0);
    $("penCount").textContent = n === Infinity ? "제한 없음" : n + "개";
  }
  function renderSimple() {
    ["hitsA", "guardsA", "hitsB", "guardsB", "bossAtk", "grade", "topK", "timeLimit"].forEach(function (k) { if ($(k)) $(k).value = st[k]; });
    $("buffHp").value = st.buffs[0]; $("buffAtk").value = st.buffs[1]; $("buffDef").value = st.buffs[2];
  }
  function renderAll() { renderSimple(); renderTypes(); renderSpirits(); renderGems(); renderAccs(); renderPens(); }

  // ---------- 입력 반영 ----------
  function num(v, d) { var n = parseInt(v, 10); return isFinite(n) && n >= 0 ? n : d; }
  document.addEventListener("change", function (e) {
    var t = e.target, row = t.closest && t.closest(".dt-row"), i = row ? +row.getAttribute("data-i") : -1;
    if (t.matches("[data-type]")) {
      var k = t.getAttribute("data-type");
      st.types = st.types.filter(function (x) { return x !== k; });
      if (t.checked) st.types.push(k);
      renderTypes();
    } else if (t.classList.contains("sp-stat")) { st.spirits[i].slots[+t.getAttribute("data-k")].stat = t.value; renderSpirits(); }
    else if (t.classList.contains("sp-mode")) { st.spirits[i].slots[+t.getAttribute("data-k")].mode = t.value; renderSpirits(); }
    else if (t.classList.contains("sp-bonus")) { st.spirits[i].bonus = t.value; }
    else if (t.classList.contains("acc-level")) { st.accs[i].level = +t.value; renderAccs(); }
    else if (t.classList.contains("acc-item")) { st.accs[i].item = t.value; renderAccs(); }
    else if (t.classList.contains("acc-enc")) { st.accs[i].enchant = t.value; }
    else if (t.classList.contains("pen-kind")) { st.pens[i].kind = t.value; renderPens(); }
    else if (t.classList.contains("pen-opt")) { st.pens[i].opt = t.value; renderPens(); }
    else if (["hitsA", "guardsA", "hitsB", "guardsB", "bossAtk", "topK", "timeLimit"].indexOf(t.id) >= 0) st[t.id] = num(t.value, st[t.id]);
    else if (t.id === "grade") st.grade = t.value;
    save();
  });
  document.addEventListener("input", function (e) {
    var t = e.target, row = t.closest && t.closest(".dt-row"), i = row ? +row.getAttribute("data-i") : -1;
    if (t.classList.contains("gem-n")) {
      var lv = t.getAttribute("data-lv"), s = +t.getAttribute("data-s");
      st.gems[lv] = st.gems[lv] || [0, 0, 0];
      st.gems[lv][s] = num(t.value, 0);
      var tot = [0, 0, 0];
      GEM_LV.forEach(function (l) { (st.gems[l] || [0, 0, 0]).forEach(function (n, q) { tot[q] += n; }); });
      var sum = document.querySelector(".dt-gem-sum");
      if (sum) sum.innerHTML = '<span>합</span><span class="s-hp">' + tot[0] + '</span><span class="s-atk">' + tot[1] + '</span><span class="s-def">' + tot[2] + "</span>";
      $("gemCount").textContent = (tot[0] + tot[1] + tot[2]) + "개";
    } else if (t.classList.contains("sp-n")) {
      st.spirits[i].count = Math.max(1, num(t.value, 1));
      $("spiritCount").textContent = st.spirits.reduce(function (q, s) { return q + (s.count || 1); }, 0) + "개";
    } else if (t.classList.contains("acc-n")) st.accs[i].count = num(t.value, 1);
    else if (t.classList.contains("pen-n")) st.pens[i].count = num(t.value, 1);
    else if (t.id === "buffHp") st.buffs[0] = num(t.value, 0);
    else if (t.id === "buffAtk") st.buffs[1] = num(t.value, 0);
    else if (t.id === "buffDef") st.buffs[2] = num(t.value, 0);
    else if (["hitsA", "guardsA", "hitsB", "guardsB", "bossAtk"].indexOf(t.id) >= 0) st[t.id] = num(t.value, st[t.id]);
    save();
  });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.classList.contains("dt-del")) {
      var row = t.closest(".dt-row"), i = +row.getAttribute("data-i");
      if (row.classList.contains("dt-sp")) { st.spirits.splice(i, 1); renderSpirits(); }
      else if (row.classList.contains("dt-acc")) { st.accs.splice(i, 1); renderAccs(); }
      else if (row.classList.contains("dt-pen")) { st.pens.splice(i, 1); renderPens(); }
      save();
    }
  });
  $("spiritAdd").onclick = function () {
    st.spirits.push({ slots: [0, 1, 2, 3].map(function () { return { stat: "공", mode: "%" }; }), bonus: "공", count: 1 });
    renderSpirits(); save();
  };
  $("spiritImport").onclick = function () {
    var list = [];
    try { list = (loadData(STORAGE_KEYS.DRAGON) || []); } catch (e) {}
    var keyOf = function (s) { return JSON.stringify({ slots: s.slots, bonus: s.bonus }); };
    var have = {}, fresh = {}, added = 0;
    st.spirits.forEach(function (s) { have[keyOf(s)] = 1; });
    list.forEach(function (d) {
      var stats = d.spiritStats || [], types = d.spiritTypes || [];
      if (!stats.every(function (s) { return s === "체" || s === "공" || s === "방"; })) return;   // 4칸이 다 채워진 정령만
      var sp = { slots: stats.slice(0, 4).map(function (s, k) { return { stat: s, mode: types[k] === "+" ? "+" : "%" }; }), bonus: ({ "체": "체", "공": "공", "방": "방" })[d.bonus] || "없음" };
      var key = keyOf(sp);
      if (have[key]) return;                        // 이미 목록에 있던 정령은 건드리지 않음
      if (fresh[key]) { fresh[key].count++; added++; return; }   // 같은 정령이 여러 마리에 있으면 개수로 합침
      sp.count = 1; fresh[key] = sp; st.spirits.push(sp); added++;
    });
    renderSpirits(); save();
    toast(added ? "정령 " + added + "개를 가져왔습니다." : "새로 가져올 정령이 없습니다 (용/정령 탭에 4칸이 다 채워진 정령만 가져옵니다).");
  };
  $("gemClear").onclick = function () { GEM_LV.forEach(function (lv) { st.gems[lv] = [0, 0, 0]; }); renderGems(); save(); };
  $("accAdd").onclick = function () { st.accs.push({ level: 20, item: "황보", enchant: "공", count: 1 }); renderAccs(); save(); };
  $("penAdd").onclick = function () { st.pens.push({ kind: "태양", opt: "공12체6", count: 1 }); renderPens(); save(); };

  function toast(msg) {
    var el = $("dtToast");
    if (!el) { el = document.createElement("div"); el.id = "dtToast"; el.className = "dt-toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  // ---------- 계산 ----------
  function buildOpts() {
    return {
      grade: st.grade, bossAtk: st.bossAtk || 2750, buffs: st.buffs.slice(), enchantValue: 21,
      groups: [{ hits: st.hitsA, guards: st.guardsA }, { hits: st.hitsB, guards: st.guardsB }],
      types: st.types.slice(), spirits: st.spirits,
      gems: st.gems,
      accessories: st.accs.map(function (a) { return { level: +a.level, item: a.item, enchant: a.enchant, count: a.item === "전체" ? 0 : (+a.count || 0) }; }),
      pendants: st.pens.map(function (p) { return { kind: p.kind, opt: p.opt === "전체" ? "전체" : penVec(p.opt), count: p.opt === "전체" ? 0 : (+p.count || 0) }; }),
      topK: +st.topK || 3, timeLimitMs: +st.timeLimit || 15000
    };
  }
  var worker = null, running = false, tick = null;
  function setRunning(on, started) {
    running = on;
    var btn = $("calcButton");
    clearInterval(tick);
    if (on) {
      var limit = (+st.timeLimit || 15000) / 1000;
      var upd = function () { btn.textContent = "계산 중… " + Math.floor((Date.now() - started) / 1000) + "초 (최대 " + limit + "초) · 누르면 멈춤"; };
      upd(); tick = setInterval(upd, 500);
    } else btn.textContent = "4마리 계산하기";
  }
  function run() {
    if (running) {   // 계산 중에 누르면 멈춤
      if (worker) { worker.terminate(); worker = null; }
      setRunning(false);
      return;
    }
    var opts = buildOpts(), started = Date.now();
    setRunning(true, started);
    var done = function (res) { setRunning(false); render(res, opts); };
    try {
      worker = new Worker("js/dealer-team-worker.js?v=20261028e");
      worker.onmessage = function (e) { worker.terminate(); worker = null; if (e.data.ok) done(e.data.res); else { setRunning(false); $("result").innerHTML = '<div class="ds-empty">계산 중 오류: ' + esc(e.data.error) + "</div>"; } };
      worker.onerror = function () { if (worker) worker.terminate(); worker = null; setTimeout(function () { done(DT.solve(opts)); }, 30); };
      worker.postMessage(JSON.parse(JSON.stringify(opts)));
    } catch (e) {
      setTimeout(function () { done(DT.solve(opts)); }, 30);   // 파일로 열었을 때 등 Worker 를 못 쓰면 화면에서 바로 계산
    }
  }

  // ---------- 결과 ----------
  var ORDER = [2, 0, 1, 3];   // 화면 순서: 13, 11, 12, 14번
  function spiritText(sp) {
    var slots = sp.slots.map(function (s) { return '<span class="' + SC[s.stat] + '">' + esc(s.stat + s.mode) + "</span>"; }).join(" ");
    var b = sp.bonus && sp.bonus !== "없음" ? ' <span class="dt-dim">·</span> <span class="' + SC[sp.bonus] + '">' + sp.bonus + "+" + (sp.bonus === "체" ? 40 : 10) + "</span>" : "";
    var grade = typeof spiritGrade === "function" ? spiritGrade(sp.slots.map(function (s) { return s.stat; }), sp.slots.map(function (s) { return s.mode; })) : null;
    return slots + b + (grade && typeof spiritGradeTag === "function" ? " " + spiritGradeTag(grade, { size: 10.5 }) : "");
  }
  function gemsText(m) {
    var parts = [];
    [["a", "공", "s-atk"], ["h", "체", "s-hp"], ["d", "방", "s-def"]].forEach(function (x) {
      var list = m.gems[x[0]] || [];
      if (!list.length) return;
      parts.push('<span class="' + x[2] + '">' + x[1] + " " + list.map(function (g) { return g.lv + (g.n > 1 ? "×" + g.n : ""); }).join(" ") + "</span>");
    });
    return parts.join(" <span class=\"dt-dim\">·</span> ") || "젬 없음";
  }
  function colorStats(text) {
    return esc(text).replace(/(체)(\d+)/g, '<span class="s-hp">$1$2</span>').replace(/(공)(\d+)/g, '<span class="s-atk">$1$2</span>').replace(/(방)(\d+)/g, '<span class="s-def">$1$2</span>');
  }
  function render(res, opts) {
    var box = $("result");
    if (!res.teams || !res.teams.length) {
      box.innerHTML = '<div class="ds-empty">' + (res.problems || []).map(esc).join("<br>") + "</div>";
      if (window.GUILD_UI_V2) window.GUILD_UI_V2.scrollTo(box);
      return;
    }
    var badge = res.exact
      ? '<span class="dt-badge ok">최적 확인</span>'
      : '<span class="dt-badge warn">' + Math.round((opts.timeLimitMs || 15000) / 1000) + '초 안에 찾은 최선</span>';
    var html = '<div class="ds-head"><h2>결과</h2><small>' + badge + " " + fmt(res.stats.ms) + "ms</small></div>";
    if (!res.exact) html += '<p class="ds-note dt-warn">끝까지 확인하지 못해 더 좋은 팀이 있을 수 있습니다. "찾는 시간"을 늘려 다시 계산해 보세요.</p>';
    html += res.teams.map(function (t, ti) {
      return '<section class="dt-team' + (ti === 0 ? " is-best" : "") + '">' +
        '<div class="dt-team-h"><span class="dt-team-rank">' + (ti + 1) + '위</span><span class="dt-team-total"><small>공격력 합</small>' + fmt(t.total) + "</span>" +
        (ti > 0 ? '<span class="dt-team-diff">1위보다 ' + fmt(res.teams[0].total - t.total) + " 낮음</span>" : "") + "</div>" +
        '<div class="dt-members">' + ORDER.map(function (k) {
          var m = t.members[k];
          return '<div class="dt-m">' +
            '<div class="dt-m-h"><span class="dt-pos">' + m.pos + '</span><b>' + esc(m.dragon.short) + '</b><small>' + esc(m.dragon.name) + "</small></div>" +
            '<div class="dt-m-atk"><small>공격</small>' + fmt(m.atk) + "</div>" +
            '<div class="ds-stats"><span class="s-hp">체 <b>' + fmt(m.hp) + '</b></span><span class="s-def">방 <b>' + fmt(m.def) + "</b></span></div>" +
            '<div class="ds-left">정타 ' + m.hits + (m.guards ? " + 방어 " + m.guards : "") + " → 피해 <b>" + fmt(m.taken) + "</b>, 남는 체력 <b>" + fmt(m.left) + "</b></div>" +
            '<div class="dt-m-line">' + spiritText(m.spirit) + "</div>" +
            '<div class="dt-m-line">' + gemsText(m) + "</div>" +
            '<div class="ds-gear"><span class="ds-chip">' + colorStats(m.acc.label.replace(/^황보 17/, "황보주 17")) + '</span><span class="ds-chip">' + colorStats(m.pen.label) + "</span></div>" +
          "</div>";
        }).join("") + "</div></section>";
    }).join("");
    box.innerHTML = html;
    if (window.GUILD_UI_V2) window.GUILD_UI_V2.scrollTo(box);
  }

  renderAll();
  $("calcButton").addEventListener("click", run);
})();
