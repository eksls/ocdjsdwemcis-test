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

  /*
   * opts = {
   *   grade: "9.0", spirit: {slots:[{stat,mode}]×4, bonus}, gemValue: 40,
   *   pendantKind: "달"|"태양", accMode, accLevel, owned, enchantValue,
   *   hits: n, guards: m, bossAtk: 2750, buffs: [체%,공%,방%], limit: 20
   * }
   * return [{ dragon, results:[...상위 limit], survivable: 개수, total: 확인한 조합 수, bestUnsafe: 가장 많이 버틴 실패 조합 }]
   */
  function solve(opts) {
    var sp = spiritStats(opts.spirit || {});
    var gv = opts.gemValue || 40;
    var gemPer = [gv * 4, gv, gv];
    var pens = pendantOptions(opts.pendantKind);
    var accs = accessoryCandidates(opts);
    var hits = Math.max(0, opts.hits | 0), guards = Math.max(0, opts.guards | 0);
    var A = opts.bossAtk || 2750;
    var buffs = opts.buffs || [0, 0, 0];
    var limit = opts.limit || 20;

    return DRAGONS.map(function (d) {
      var base = BASE_STATS[d.type][opts.grade || "9.0"];
      var all = [], total = 0, bestUnsafe = null;
      for (var h = 0; h <= 5; h++) for (var a = 0; a <= 5 - h; a++) {
        var g = [h, a, 5 - h - a];
        for (var ai = 0; ai < accs.length; ai++) {
          var acc = accs[ai];
          for (var pi = 0; pi < pens.length; pi++) {
            var pen = pens[pi];
            total++;
            var raw = [0, 1, 2].map(function (s) {
              return stat(base[s] + POTION[s], gemPer[s] * g[s], acc.pct[s], sp.plus[s], sp.pct[s], pen[s], COLLECTION[s], sp.bonus[s]);
            });
            var hp = mulFloor(raw[0], buffs[0]);
            var atk = mulFloor(Math.floor(raw[1] * (d.dark ? 125 : 100) / 100), buffs[1]);
            var def = mulFloor(Math.floor(raw[2] * (d.light ? 125 : 100) / 100), buffs[2]);
            var dm = damage(A, def);
            var taken = dm.hit * hits + dm.guard * guards;
            var left = hp - taken;
            var row = { gems: g, acc: acc, pen: pen, penLabel: pendantLabel(opts.pendantKind, pen),
              raw: raw, hp: hp, atk: atk, def: def, hit: dm.hit, guard: dm.guard, taken: taken, left: left };
            if (left >= 1) all.push(row);
            else if (!bestUnsafe || left > bestUnsafe.left) bestUnsafe = row;   // 못 버티는 조합 중 가장 단단한 것 (안내용)
          }
        }
      }
      // 정렬: 공격력 → 남는 체력 → 방어
      all.sort(function (x, y) { return y.atk - x.atk || y.left - x.left || y.def - x.def; });
      // 같은 스탯이 나오는 조합은 하나만 (먼저 나온 것)
      var out = [], seenStat = {};
      for (var i = 0; i < all.length && out.length < limit; i++) {
        var k = all[i].hp + "|" + all[i].atk + "|" + all[i].def;
        if (seenStat[k]) continue; seenStat[k] = 1;
        out.push(all[i]);
      }
      return { dragon: d, results: out, survivable: all.length, total: total, bestUnsafe: bestUnsafe };
    });
  }

  root.DealerSurvive = {
    DRAGONS: DRAGONS, BASE_STATS: BASE_STATS, ACCESSORY_STATS: ACCESSORY_STATS,
    pendantOptions: pendantOptions, spiritStats: spiritStats, stat: stat, damage: damage,
    accessoryCandidates: accessoryCandidates, solve: solve
  };
})(typeof window !== "undefined" ? window : globalThis);
