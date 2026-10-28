/*
 * 정타 딜러 계산 엔진
 *  - 빛 공격형 / 어둠 공방형 / 어둠 체공형 / 어둠 방어형 / 어둠 공격형 각각에 대해
 *    정타 n대 (+ 방어 m회)를 맞고 체력이 1 이상 남는 조합 중 최종 공격력이 가장 높은 순으로 정렬
 *  - 젬 분배(21가지) × 장신구·인챈트 × 팬던트 옵션을 전부 확인 (근사 없음)
 *
 * 스탯 계산 순서 (닉뭐 탱계산기·디비룡과 같은 순서)
 *   ① 기본 + 물약(체24/공6/방6) + 젬            → 버림
 *   ② × (1 + 장신구%)                           → 버림
 *   ③ (+ 정령 +수치) × (1 + 정령%)              → 버림
 *   ④ × (1 + 팬던트%)                           → 버림
 *   ⑤ + 컬렉션(체240/공60/방60) + 부가옵(체40/공10/방10)
 *   ⑥ 빛: 방어 ×1.25, 어둠: 공격 ×1.25          → 버림
 *   ⑦ 층 버프 %                                 → 버림
 * 받는 피해 (보스 공격력 A, 방어 D)
 *   정타 1대 = floor(44·A / (D + 22)),  방어 1회 = floor(44·A / (3·D + 22))
 */
(function (root) {
  "use strict";

  var BASE_STATS = {
    "공":   { "9.0": [876, 325, 161], "8.0": [876, 305, 161], "7.0": [876, 285, 161] },
    "체공": { "9.0": [1160, 282, 133], "8.0": [1120, 272, 133], "7.0": [1080, 262, 133] },
    "공방": { "9.0": [720, 262, 263], "8.0": [720, 252, 253], "7.0": [720, 242, 243] },
    "방":   { "9.0": [788, 185, 323], "8.0": [788, 185, 303], "7.0": [788, 185, 283] }
  };
  var DRAGONS = [
    { key: "light-atk",  name: "빛 공격형",   short: "빛공",    type: "공",   light: true,  dark: false },
    { key: "dark-atkdef", name: "어둠 공방형", short: "어둠공방", type: "공방", light: false, dark: true },
    { key: "dark-hpatk", name: "어둠 체공형", short: "어둠체공", type: "체공", light: false, dark: true },
    { key: "dark-def",   name: "어둠 방어형", short: "어둠방",   type: "방",   light: false, dark: true },
    { key: "dark-atk",   name: "어둠 공격형", short: "어둠공",   type: "공",   light: false, dark: true }
  ];
  var POTION = [24, 6, 6];
  var COLLECTION = [240, 60, 60];
  var BONUS = { "없음": [0, 0, 0], "체": [40, 0, 0], "공": [0, 10, 0], "방": [0, 0, 10] };
  var SPIRIT_PLUS = [54, 60, 66, 120];   // 체력은 ×4
  var SPIRIT_PERCENT = [24, 28, 32, 40];
  var STAT_KR = ["체", "공", "방"];
  // 장신구 % (17~20). 바뿔은 주옵 쪽이 1 높음 (17: 9/8, 19: 10/9). 인챈트는 고른 스탯에 +21%
  var ACCESSORY_STATS = {
    "황보": { 17: [0, 17, 0], 18: [0, 18, 0], 19: [0, 19, 0], 20: [0, 20, 0] },
    "여보": { 17: [0, 0, 17], 18: [0, 0, 18], 19: [0, 0, 19], 20: [0, 0, 20] },
    "악보": { 17: [17, 0, 0], 18: [18, 0, 0], 19: [19, 0, 0], 20: [20, 0, 0] },
    "물뿔(체/공)": { 17: [11, 6, 0], 18: [12, 6, 0], 19: [13, 6, 0], 20: [14, 6, 0] },
    "물뿔(체/방)": { 17: [11, 0, 6], 18: [12, 0, 6], 19: [13, 0, 6], 20: [14, 0, 6] },
    "불뿔(공/체)": { 17: [6, 11, 0], 18: [6, 12, 0], 19: [6, 13, 0], 20: [6, 14, 0] },
    "불뿔(공/방)": { 17: [0, 11, 6], 18: [0, 12, 6], 19: [0, 13, 6], 20: [0, 14, 6] },
    "대뿔(방/체)": { 17: [6, 0, 11], 18: [6, 0, 12], 19: [6, 0, 13], 20: [6, 0, 14] },
    "대뿔(방/공)": { 17: [0, 6, 11], 18: [0, 6, 12], 19: [0, 6, 13], 20: [0, 6, 14] },
    "바뿔(공/체)": { 17: [8, 9, 0], 18: [9, 9, 0], 19: [9, 10, 0], 20: [10, 10, 0] },
    "바뿔(공/방)": { 17: [0, 9, 8], 18: [0, 9, 9], 19: [0, 10, 9], 20: [0, 10, 10] },
    "바뿔(체/방)": { 17: [9, 0, 8], 18: [9, 0, 9], 19: [10, 0, 9], 20: [10, 0, 10] }
  };

  // 팬던트 옵션 후보 (최대 옵션 기준)
  function pendantOptions(kind) {
    var out = [];
    if (kind === "태양") {
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) if (a !== b) {
        var p = [0, 0, 0]; p[a] = 12; p[b] = 6; out.push(p);
      }
      out.push([6, 6, 6]);
    } else {
      for (var s = 0; s < 3; s++) { var q = [0, 0, 0]; q[s] = 12; out.push(q); }
      for (var i = 0; i < 3; i++) for (var j = i + 1; j < 3; j++) { var r = [0, 0, 0]; r[i] = 6; r[j] = 6; out.push(r); }
    }
    return out;
  }
  function pendantLabel(kind, p) {
    var parts = [];
    [1, 0, 2].forEach(function (s) { if (p[s]) parts.push({ s: s, v: p[s] }); });
    parts.sort(function (x, y) { return y.v - x.v; });
    return kind + " " + parts.map(function (x) { return STAT_KR[x.s] + x.v; }).join(" ");
  }

  function spiritStats(spirit) {
    var plus = [0, 0, 0], pct = [0, 0, 0];
    (spirit.slots || []).forEach(function (sl, i) {
      var s = STAT_KR.indexOf(sl.stat);
      if (s < 0 || i > 3) return;
      if (sl.mode === "+") plus[s] += SPIRIT_PLUS[i] * (s === 0 ? 4 : 1);
      else pct[s] += SPIRIT_PERCENT[i];
    });
    return { plus: plus, pct: pct, bonus: BONUS[spirit.bonus] || BONUS["없음"] };
  }

  var mulFloor = function (x, pct) { return Math.floor(x * (100 + pct) / 100); };

  // 한 스탯 계산 (①~⑤)
  function stat(base, gem, acc, plus, sp, pen, coll, bonus) {
    var x = base + gem;
    x = mulFloor(x, acc);
    x = mulFloor(x + plus, sp);
    x = mulFloor(x, pen);
    return x + coll + bonus;
  }

  function damage(bossAtk, def) {
    return {
      hit: Math.floor(44 * bossAtk / (def + 22)),
      guard: Math.floor(44 * bossAtk / (3 * def + 22))
    };
  }

  // 장신구 후보: [{label, pct:[h,a,d]}]
  //  opts.accMode: "all" (모든 장신구, opts.accLevel) | "owned" (opts.owned = 장비 탭 장신구 목록)
  function accessoryCandidates(opts) {
    var enc = opts.enchantValue == null ? 21 : opts.enchantValue;
    var list = [], seen = {};
    function add(item, lv, encMode) {
      var base = ACCESSORY_STATS[item] && ACCESSORY_STATS[item][lv];
      if (!base) return;
      var encs = encMode === "all" ? [0, 1, 2] : (STAT_KR.indexOf(encMode) >= 0 ? [STAT_KR.indexOf(encMode)] : [-1]);
      encs.forEach(function (e) {
        var key = item + "|" + lv + "|" + e;
        if (seen[key]) return; seen[key] = 1;
        var pct = base.map(function (v, i) { return v + (i === e ? enc : 0); });
        list.push({ item: item, level: lv, enchant: e >= 0 ? STAT_KR[e] : "", pct: pct,
          label: item + " " + lv + (e >= 0 ? " · 인챈 " + STAT_KR[e] : "") });
      });
    }
    if (opts.accMode === "owned") {
      (opts.owned || []).forEach(function (a) { add(a.item, parseInt(a.value, 10), a.enchant); });
    } else {
      Object.keys(ACCESSORY_STATS).forEach(function (item) { add(item, opts.accLevel || 20, "all"); });
    }
    return list;
  }

  // ---------- 정령 후보 ----------
  //  manual: 입력한 정령 1개 / allAtk: 올공퍼 (공% ×4, 부가옵만 체·공·방)
  //  allPct: 올퍼 (%%%% 형태 전부) / noMakple: 막플(%%%+) 형태만 빼고 전부
  var MODE_PATTERNS = (function () {
    var out = [];
    for (var m = 0; m < 16; m++) out.push([0, 1, 2, 3].map(function (i) { return (m >> (3 - i)) & 1 ? "+" : "%"; }));
    return out;   // 0번 = %%%%, 1번 = %%%+
  })();
  function spiritCandidates(mode, manual) {
    if (mode !== "allAtk" && mode !== "allPct" && mode !== "noMakple") return [manual || { slots: [], bonus: "없음" }];
    var list = [], seen = {};
    var bonuses = ["체", "공", "방"];
    function add(stats, modes, bonus) {
      var sp = { slots: stats.map(function (st, i) { return { stat: st, mode: modes[i] }; }), bonus: bonus };
      var e = spiritStats(sp);
      var key = e.plus.join(",") + "|" + e.pct.join(",") + "|" + e.bonus.join(",");
      if (seen[key]) return; seen[key] = 1;   // 효과가 완전히 같은 정령은 하나만
      list.push(sp);
    }
    if (mode === "allAtk") { bonuses.forEach(function (b) { add(["공", "공", "공", "공"], ["%", "%", "%", "%"], b); }); return list; }
    var patterns = mode === "allPct" ? [MODE_PATTERNS[0]]
      : MODE_PATTERNS.filter(function (p) { return p.join("") !== "%%%+"; });
    patterns.forEach(function (modes) {
      for (var c = 0; c < 81; c++) {
        var stats = [Math.floor(c / 27) % 3, Math.floor(c / 9) % 3, Math.floor(c / 3) % 3, c % 3].map(function (x) { return STAT_KR[x]; });
        bonuses.forEach(function (b) { add(stats, modes, b); });
      }
    });
    return list;
  }

  /*
   * opts = {
   *   grade: "9.0", spirit: {slots:[{stat,mode}]×4, bonus}, spiritMode: "manual"|"allAtk"|"allPct"|"noMakple",
   *   gemValue: 40, pendantKind: "달"|"태양", accLevel, enchantValue,
   *   hits: n, guards: m, bossAtk: 2750, buffs: [체%,공%,방%], limit: 20
   * }
   * return [{ dragon, results:[...상위 limit], survivable, total, spirits, bestUnsafe }]
   *
   * 빠르게 하는 방법 (결과는 전부 확인한 것과 같음)
   *  - 스탯마다 (젬 개수 × 장신구% × 팬던트%) 표를 정령마다 한 번만 만들어 조합은 표에서 꺼내 씀
   *  - 정령을 "낼 수 있는 최대 공격력" 높은 순으로 보다가, 그 최대치가 이미 찾은 상위 n번째보다 낮으면 멈춤
   */
  function solve(opts) {
    var gv = opts.gemValue || 40;
    var gemPer = [gv * 4, gv, gv];
    var pens = pendantOptions(opts.pendantKind);
    var accs = accessoryCandidates(opts);
    var hits = Math.max(0, opts.hits | 0), guards = Math.max(0, opts.guards | 0);
    var A = opts.bossAtk || 2750;
    var buffs = opts.buffs || [0, 0, 0];
    var limit = opts.limit || 20;
    var spirits = spiritCandidates(opts.spiritMode, opts.spirit);
    var effs = spirits.map(spiritStats);
    var many = spirits.length > 1;

    // 스탯별로 서로 다른 장신구%, 팬던트% 값과 그 번호
    var accVals = [[], [], []], penVals = [[], [], []];
    var accIx = accs.map(function (a) { return [0, 1, 2].map(function (s) { var k = accVals[s].indexOf(a.pct[s]); if (k < 0) { k = accVals[s].length; accVals[s].push(a.pct[s]); } return k; }); });
    var penIx = pens.map(function (p) { return [0, 1, 2].map(function (s) { var k = penVals[s].indexOf(p[s]); if (k < 0) { k = penVals[s].length; penVals[s].push(p[s]); } return k; }); });
    var NA = accVals.map(function (v) { return v.length; }), NP = penVals.map(function (v) { return v.length; });
    var gearCount = 21 * accs.length * pens.length;

    return DRAGONS.map(function (d) {
      var base = BASE_STATS[d.type][opts.grade || "9.0"];
      var finalOf = [
        function (x) { return mulFloor(x, buffs[0]); },
        function (x) { return mulFloor(Math.floor(x * (d.dark ? 125 : 100) / 100), buffs[1]); },
        function (x) { return mulFloor(Math.floor(x * (d.light ? 125 : 100) / 100), buffs[2]); }
      ];
      // 정령 e 의 스탯 s 표: [젬 개수][장신구 번호][팬던트 번호] → 최종 수치
      function table(e, s) {
        var t = new Int32Array(6 * NA[s] * NP[s]);
        for (var g = 0; g <= 5; g++) for (var ia = 0; ia < NA[s]; ia++) for (var ip = 0; ip < NP[s]; ip++) {
          t[(g * NA[s] + ia) * NP[s] + ip] = finalOf[s](stat(base[s] + POTION[s], gemPer[s] * g, accVals[s][ia], e.plus[s], e.pct[s], penVals[s][ip], COLLECTION[s], e.bonus[s]));
        }
        return t;
      }
      // 정령마다 낼 수 있는 최대 공격력 (공격 젬 5개 + 가장 좋은 장신구·팬던트)
      var order = effs.map(function (e, i) {
        var t = table(e, 1), mx = 0;
        for (var k = 0; k < t.length; k++) if (t[k] > mx) mx = t[k];
        return { i: i, ub: mx, ta: t };
      });
      if (many) order.sort(function (x, y) { return y.ub - x.ub || x.i - y.i; });

      var cand = [], full = false, threshold = -1, survivable = 0, checked = 0, bestUnsafe = null;
      function compact() {
        cand.sort(function (x, y) { return y.atk - x.atk || y.left - x.left || y.def - x.def || x.seq - y.seq; });
        var out = [], seenStat = {};
        for (var i = 0; i < cand.length && out.length < limit; i++) {
          var k = cand[i].hp + "|" + cand[i].atk + "|" + cand[i].def;
          if (seenStat[k]) continue; seenStat[k] = 1;   // 같은 스탯이 나오는 조합은 하나만 (먼저 나온 것)
          out.push(cand[i]);
        }
        cand = out;
        if (cand.length >= limit) { full = true; threshold = cand[cand.length - 1].atk; }
      }
      var seq = 0;
      for (var oi = 0; oi < order.length; oi++) {
        var o = order[oi];
        if (many && full && o.ub < threshold) break;   // 이 뒤 정령은 상위 n 개에 들 수 없음
        checked++;
        var e = effs[o.i], TA = o.ta, TH = table(e, 0), TD = table(e, 2);
        var TK = new Int32Array(TD.length);
        for (var k2 = 0; k2 < TD.length; k2++) { var dm = damage(A, TD[k2]); TK[k2] = dm.hit * hits + dm.guard * guards; }
        for (var h = 0; h <= 5; h++) for (var a = 0; a <= 5 - h; a++) {
          var dd = 5 - h - a;
          for (var ai = 0; ai < accs.length; ai++) {
            var ax = accIx[ai];
            var bH = (h * NA[0] + ax[0]) * NP[0], bA = (a * NA[1] + ax[1]) * NP[1], bD = (dd * NA[2] + ax[2]) * NP[2];
            for (var pi = 0; pi < pens.length; pi++) {
              var px = penIx[pi];
              var atk = TA[bA + px[1]];
              if (many && full && atk < threshold) continue;
              var hp = TH[bH + px[0]], kd = bD + px[2], left = hp - TK[kd];
              if (left < 1) {
                if (!survivable && (!bestUnsafe || left > bestUnsafe.left)) bestUnsafe = { gems: [h, a, dd], acc: accs[ai], pen: pens[pi], spirit: spirits[o.i], hp: hp, atk: atk, def: TD[kd], taken: TK[kd], left: left };
                continue;
              }
              survivable++;
              if (full && atk < threshold) continue;
              cand.push({ seq: seq++, gems: [h, a, dd], acc: accs[ai], pen: pens[pi], spirit: spirits[o.i], hp: hp, atk: atk, def: TD[kd], taken: TK[kd], left: left });
              if (cand.length >= limit * 4 + 64) compact();
            }
          }
        }
      }
      compact();
      cand.forEach(function (r) {
        var dm = damage(A, r.def); r.hit = dm.hit; r.guard = dm.guard;
        r.penLabel = pendantLabel(opts.pendantKind, r.pen);
        delete r.seq;
      });
      if (bestUnsafe) bestUnsafe.penLabel = pendantLabel(opts.pendantKind, bestUnsafe.pen);
      return { dragon: d, results: cand, survivable: survivable, total: gearCount * spirits.length,
        spirits: spirits.length, spiritsChecked: checked, exactCount: !many, bestUnsafe: survivable ? null : bestUnsafe };
    });
  }

  root.DealerSurvive = {
    DRAGONS: DRAGONS, BASE_STATS: BASE_STATS, ACCESSORY_STATS: ACCESSORY_STATS,
    pendantOptions: pendantOptions, spiritStats: spiritStats, stat: stat, damage: damage,
    accessoryCandidates: accessoryCandidates, spiritCandidates: spiritCandidates, solve: solve
  };
})(typeof window !== "undefined" ? window : globalThis);
