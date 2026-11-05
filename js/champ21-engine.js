/*
 * 챔피언대전(챔대) 21층 계산 엔진
 *  공식: 디비룡(dbryong.com) 챔대 계산기 (엑셀 "최종계산(챔대용)")
 *   s1 = ⌊(기본 + 젬 + 물약) × (1 + 장신구% + 인챈트%)⌋
 *   s2 = ⌊(s1 + 정령+ × ½) × (1 + 정령% × ½)⌋        ← 챔대는 정령 50%만 적용
 *   s3 = ⌊s2 × (1 + 팬던트%)⌋ + 정령 부가옵 + 컬렉션(240/60/60)
 *   최종 = ⌊s3 × (1 + 속성 버프)⌋                      ← 체·공 +40%, 방 +50%
 *  물약은 크리•회피(24/6/6), 인챈트 21%, 컬렉션은 풀컬 고정.
 *  모든 계산은 정수로 해서 소수점 오차가 없음.
 */
(function (root) {
  "use strict";

  // 21층 (SSS Lv.21) 용 — 체/공/방
  var DRAGONS = [
    { attr: "땅", name: "아델라", hp: 406, atk: 128, def: 129 },
    { attr: "물", name: "넬로", hp: 524, atk: 85, def: 140 },
    { attr: "물", name: "로티스", hp: 576, atk: 125, def: 85 },
    { attr: "불", name: "패트로아", hp: 502, atk: 116, def: 113 },
    { attr: "불", name: "스쿨드", hp: 368, atk: 131, def: 131 },
    { attr: "불", name: "다크베인", hp: 667, atk: 93, def: 93 },
    { attr: "바람", name: "허리케인", hp: 560, atk: 95, def: 120 },
    { attr: "바람", name: "크레스티드", hp: 576, atk: 83, def: 127 },
    { attr: "바람", name: "기린", hp: 595, atk: 91, def: 114 },
    { attr: "빛", name: "후긴", hp: 472, atk: 135, def: 101 },
    { attr: "빛", name: "밀라타스", hp: 576, atk: 126, def: 84 },
    { attr: "어둠", name: "아누라다", hp: 488, atk: 145, def: 87 },
    { attr: "황혼", name: "헬카이저", hp: 699, atk: 90, def: 90 },
    { attr: "황혼", name: "에슈", hp: 503, atk: 115, def: 113 },
    { attr: "여명", name: "크로마 밀라타스", hp: 576, atk: 126, def: 84 },
    { attr: "여명", name: "스텔스", hp: 472, atk: 118, def: 118 },
    { attr: "여명", name: "이블 던", hp: 607, atk: 91, def: 111 },
    { attr: "악몽", name: "블러디터스크", hp: 684, atk: 110, def: 73 },
    { attr: "악몽", name: "케이나인", hp: 486, atk: 142, def: 90 }
  ];
  var ATTRS = ["땅", "물", "불", "바람", "빛", "어둠", "황혼", "여명", "악몽"];
  var SK = ["체", "공", "방"];

  var GEM_LEVELS = [44, 42, 40, 38, 36];
  var gemVal = function (s, L) { return s === 0 ? L * 4 : L; };

  // 장신구 (디비룡 챔대 장신구표, % 정수) — 빛뿔(크리)은 비벨에 항상 손해라 뺌
  var ACC_KINDS = [
    ["악보", function (L) { return [L, 0, 0]; }],
    ["황보", function (L) { return [0, L, 0]; }],
    ["여보", function (L) { return [0, 0, L]; }],
    ["물뿔(체/공)", function (L) { return [L - 6, 6, 0]; }],
    ["물뿔(체/방)", function (L) { return [L - 6, 0, 6]; }],
    ["불뿔(공/체)", function (L) { return [6, L - 6, 0]; }],
    ["불뿔(공/방)", function (L) { return [0, L - 6, 6]; }],
    ["대뿔(방/체)", function (L) { return [6, 0, L - 6]; }],
    ["대뿔(방/공)", function (L) { return [0, 6, L - 6]; }],
    // 바뿔: 큰 쪽이 이름 앞 스탯 (16: 8/8, 17: 9/8, 18: 9/9, 19: 10/9, 20: 10/10)
    ["바뿔(체/방)", function (L) { var a = Math.ceil(L / 2), b = Math.floor(L / 2); return [a, 0, b]; }],
    ["바뿔(공/체)", function (L) { var a = Math.ceil(L / 2), b = Math.floor(L / 2); return [b, a, 0]; }],
    ["바뿔(공/방)", function (L) { var a = Math.ceil(L / 2), b = Math.floor(L / 2); return [0, a, b]; }]
  ];
  var ACC_LEVELS = [20, 19, 18, 17, 16];
  function accList(L) { return ACC_KINDS.map(function (k) { return { name: k[0] + " " + L, pct: k[1](L) }; }); }

  // 팬던트 (정령 계산기와 같은 옵션)
  var PENDANTS = {
    "없음": [[0, 0, 0]],
    "달": [[12, 0, 0], [0, 12, 0], [0, 0, 12], [6, 6, 0], [6, 0, 6], [0, 6, 6]],
    "태양": [[18, 0, 0], [0, 18, 0], [0, 0, 18], [12, 6, 0], [12, 0, 6], [6, 12, 0], [0, 12, 6], [6, 0, 12], [0, 6, 12], [6, 6, 6]]
  };

  var POT = [24, 6, 6], COLL = [240, 60, 60], BUFF = [40, 40, 50], ENC = 21;
  var SP_PCT = [24, 28, 32, 40], SP_PLUS = [54, 60, 66, 120], SP_BONUS = [40, 10, 10];

  // 한 스탯 최종값 (모두 정수)
  function stat(base, gem, s, accPct, spPct, spPlus, penPct, bonus, buffPct) {
    var s1 = Math.floor((base + gem + POT[s]) * (100 + accPct) / 100);
    var s2 = Math.floor((2 * s1 + spPlus) * (200 + spPct) / 400);
    var s3 = Math.floor(s2 * (100 + penPct) / 100) + bonus + COLL[s];
    return Math.floor(s3 * (100 + buffPct) / 100);
  }

  // 정령: slots = [{stat:0|1|2, type:"%"|"+"} ×4], bonus = 0|1|2|-1
  function spiritEffect(slots, bonus) {
    var pct = [0, 0, 0], plus = [0, 0, 0], bon = [0, 0, 0];
    (slots || []).forEach(function (o, i) {
      if (!o || o.stat == null || o.stat < 0) return;
      if (o.type === "+") plus[o.stat] += SP_PLUS[i] * (o.stat === 0 ? 4 : 1);
      else if (o.type === "%") pct[o.stat] += SP_PCT[i];
    });
    if (bonus >= 0) bon[bonus] = SP_BONUS[bonus];
    return { pct: pct, plus: plus, bon: bon };
  }
  function spiritLabel(slots, bonus) {
    return slots.map(function (o) { return SK[o.stat] + o.type; }).join(" ") + (bonus >= 0 ? " 부:" + SK[bonus] : "");
  }

  // 모든 정령 (4칸 × 체/공/방 × %/+ × 부가옵 3) = 3888
  var ALL_SPIRITS = null;
  function allSpirits() {
    if (ALL_SPIRITS) return ALL_SPIRITS;
    ALL_SPIRITS = [];
    for (var m = 0; m < 81; m++) for (var t = 0; t < 16; t++) for (var b = 0; b < 3; b++) {
      var slots = [], mm = m;
      for (var i = 0; i < 4; i++) { slots.push({ stat: mm % 3, type: ((t >> i) & 1) ? "+" : "%" }); mm = (mm / 3) | 0; }
      ALL_SPIRITS.push({ slots: slots, bonus: b, eff: spiritEffect(slots, b) });
    }
    return ALL_SPIRITS;
  }

  // 젬 5개 분배 후보 — mode "level": 한 단계 L 로 5개 / mode "owned": lv[s] = 그 스탯 젬 단계들(높은 순)
  function gemCombos(opt) {
    var out = [], seen = {};
    for (var h = 0; h <= 5; h++) for (var a = 0; a <= 5 - h; a++) {
      var n = [h, a, 5 - h - a], used;
      if (opt.lv) {
        n = n.map(function (k, s) { return Math.min(k, opt.lv[s].length); });
        used = n.map(function (k, s) { return opt.lv[s].slice(0, k); });
      } else {
        used = n.map(function (k) { var r = []; for (var j = 0; j < k; j++) r.push(opt.level); return r; });
      }
      var key = n.join(",");
      if (seen[key]) continue; seen[key] = 1;
      out.push({
        n: n,
        add: used.map(function (arr, s) { return arr.reduce(function (t, L) { return t + gemVal(s, L); }, 0); }),
        text: used.map(function (arr, s) { return arr.length ? SK[s] + " " + arr.join(",") : ""; }).filter(Boolean).join(" · ") || "없음"
      });
    }
    return out;
  }

  // 장신구 × 인챈트(체/공/방 21%) 후보
  function accCombos(list, enchantFree) {
    var out = [], seen = {};
    list.forEach(function (a) {
      var encs = a.enc != null ? [a.enc] : (enchantFree === false ? [-1] : [0, 1, 2]);
      encs.forEach(function (e) {
        var p = a.pct.slice(); if (e >= 0) p[e] += ENC;
        var k = p.join(",");
        if (seen[k]) return; seen[k] = 1;
        out.push({ name: a.name, base: a.pct, enc: e, pct: p });
      });
    });
    return out;
  }

  // 다른 것보다 모든 스탯이 같거나 낮은 후보는 뺌 (절대 더 좋을 수 없음)
  function prune(list, vec) {
    return list.filter(function (x, i) {
      var a = vec(x);
      for (var j = 0; j < list.length; j++) {
        if (j === i) continue;
        var b = vec(list[j]);
        if (b[0] >= a[0] && b[1] >= a[1] && b[2] >= a[2] && (b[0] > a[0] || b[1] > a[1] || b[2] > a[2])) return false;
      }
      return true;
    });
  }

  function buffPcts(dragon, buffAttr) {
    // buffAttr = [체 버프 속성, 공 버프 속성, 방 버프 속성] ("" = 없음)
    return [0, 1, 2].map(function (s) { return buffAttr && buffAttr[s] && buffAttr[s] === dragon.attr ? BUFF[s] : 0; });
  }
  function buffKey(bp) { return (bp[0] ? "체" : "") + (bp[1] ? "공" : "") + (bp[2] ? "방" : "") || "0"; }

  function evalOne(d, gem, acc, pen, eff, bp) {
    var base = [d.hp, d.atk, d.def], st = [0, 0, 0];
    for (var s = 0; s < 3; s++) st[s] = stat(base[s], gem.add[s], s, acc.pct[s], eff.pct[s], eff.plus[s], pen.pct[s], eff.bon[s], bp[s]);
    return { hp: st[0], atk: st[1], def: st[2], v: st[0] * st[1] * st[2], ev: st[0] + 4 * st[1] + 4 * st[2] };
  }

  // 정해진 정령으로 장비 최적 (젬 분배 × 장신구·인챈트 × 팬던트)
  function bestGear(d, eff, bp, gear) {
    var best = null;
    for (var gi = 0; gi < gear.gems.length; gi++) for (var ai = 0; ai < gear.accs.length; ai++) for (var pi = 0; pi < gear.pens.length; pi++) {
      var r = evalOne(d, gear.gems[gi], gear.accs[ai], gear.pens[pi], eff, bp);
      if (!best || r.v > best.v) { r.gem = gear.gems[gi]; r.acc = gear.accs[ai]; r.pen = gear.pens[pi]; best = r; }
    }
    return best;
  }

  // 정해진 장비로 정령 최적 (스탯마다 표를 만들어 3888 정령을 곱셈 3번으로 평가)
  function bestSpiritForGear(d, gem, acc, pen, bp) {
    var base = [d.hp, d.atk, d.def];
    // tab[s][mask*16 + types*... ] : 슬롯 집합(mask)과 그중 + 슬롯(tp ⊆ mask), 부가옵 여부
    var tabs = [0, 1, 2].map(function (s) {
      var t = new Int32Array(16 * 16 * 2);
      for (var mask = 0; mask < 16; mask++) for (var tp = 0; tp < 16; tp++) {
        if ((tp & ~mask) !== 0) continue;
        var pct = 0, plus = 0;
        for (var i = 0; i < 4; i++) if (mask & (1 << i)) { if (tp & (1 << i)) plus += SP_PLUS[i] * (s === 0 ? 4 : 1); else pct += SP_PCT[i]; }
        for (var b = 0; b < 2; b++) t[(mask * 16 + tp) * 2 + b] = stat(base[s], gem.add[s], s, acc.pct[s], pct, plus, pen.pct[s], b ? SP_BONUS[s] : 0, bp[s]);
      }
      return t;
    });
    var best = null;
    allSpirits().forEach(function (sp) {
      var m = [0, 0, 0], tp = [0, 0, 0];
      sp.slots.forEach(function (o, i) { m[o.stat] |= 1 << i; if (o.type === "+") tp[o.stat] |= 1 << i; });
      var h = tabs[0][(m[0] * 16 + tp[0]) * 2 + (sp.bonus === 0 ? 1 : 0)];
      var a = tabs[1][(m[1] * 16 + tp[1]) * 2 + (sp.bonus === 1 ? 1 : 0)];
      var df = tabs[2][(m[2] * 16 + tp[2]) * 2 + (sp.bonus === 2 ? 1 : 0)];
      var v = h * a * df;
      if (!best || v > best.v) best = { v: v, hp: h, atk: a, def: df, slots: sp.slots, bonus: sp.bonus };
    });
    return best;
  }

  // 정령 최적화: 장비 후보 전부 × 정령 3888개 → 정령마다 가장 좋은 장비와 비벨. 비벨 높은 정령 limit 개
  function optimizeSpirits(d, bp, gear, limit) {
    var base = [d.hp, d.atk, d.def], SP = allSpirits(), N = SP.length;
    var idx = SP.map(function (sp) {
      var m = [0, 0, 0], tp = [0, 0, 0];
      sp.slots.forEach(function (o, i) { m[o.stat] |= 1 << i; if (o.type === "+") tp[o.stat] |= 1 << i; });
      return [0, 1, 2].map(function (s) { return (m[s] * 16 + tp[s]) * 2 + (sp.bonus === s ? 1 : 0); });
    });
    var i0 = new Int32Array(N), i1 = new Int32Array(N), i2 = new Int32Array(N);
    idx.forEach(function (x, k) { i0[k] = x[0]; i1[k] = x[1]; i2[k] = x[2]; });
    var bestV = new Float64Array(N), bestG = new Int32Array(N).fill(-1);
    var combos = [];
    gear.gems.forEach(function (g) { gear.accs.forEach(function (a) { gear.pens.forEach(function (p) { combos.push([g, a, p]); }); }); });
    var t0 = new Int32Array(512), t1 = new Int32Array(512), t2 = new Int32Array(512), T = [t0, t1, t2];
    for (var c = 0; c < combos.length; c++) {
      var g = combos[c][0], a = combos[c][1], p = combos[c][2];
      for (var s = 0; s < 3; s++) {
        var t = T[s];
        for (var mask = 0; mask < 16; mask++) for (var tp = 0; tp < 16; tp++) {
          if ((tp & ~mask) !== 0) continue;
          var pct = 0, plus = 0;
          for (var i = 0; i < 4; i++) if (mask & (1 << i)) { if (tp & (1 << i)) plus += SP_PLUS[i] * (s === 0 ? 4 : 1); else pct += SP_PCT[i]; }
          var k2 = (mask * 16 + tp) * 2;
          t[k2] = stat(base[s], g.add[s], s, a.pct[s], pct, plus, p.pct[s], 0, bp[s]);
          t[k2 + 1] = stat(base[s], g.add[s], s, a.pct[s], pct, plus, p.pct[s], SP_BONUS[s], bp[s]);
        }
      }
      for (var k = 0; k < N; k++) {
        var v = t0[i0[k]] * t1[i1[k]] * t2[i2[k]];
        if (v > bestV[k]) { bestV[k] = v; bestG[k] = c; }
      }
    }
    var order = [];
    for (var k3 = 0; k3 < N; k3++) if (bestG[k3] >= 0) order.push(k3);
    order.sort(function (x, y) { return bestV[y] - bestV[x]; });
    return order.slice(0, limit || 20).map(function (k) {
      var cb = combos[bestG[k]], sp = SP[k];
      var r = evalOne(d, cb[0], cb[1], cb[2], sp.eff, bp);
      r.gem = cb[0]; r.acc = cb[1]; r.pen = cb[2]; r.slots = sp.slots; r.bonus = sp.bonus;
      return r;
    });
  }

  // TAR (디비룡 TAR 과 같은 점수식): r = 비벨 ÷ 기준(TAR 100%)
  function tarScore(v, M) {
    if (!M || !v) return null;
    var r = v / M;
    return r <= 1 ? Math.max(0, 200 * r - 100) : 100 * r;
  }

  // TAR 100% 기준 장비: 젬 44 × 5, 20 장신구 12종 + 인챈트 21%, 태양 팬던트(정령 계산기 옵션), 최적 정령
  function referenceGear() {
    return {
      gems: gemCombos({ level: 44 }),
      accs: prune(accCombos(accList(20), true), function (x) { return x.pct; }),
      pens: prune(PENDANTS["태양"].map(function (p) { return { name: "태양", pct: p }; }), function (x) { return x.pct; })
    };
  }

  var api = {
    DRAGONS: DRAGONS, ATTRS: ATTRS, SK: SK, GEM_LEVELS: GEM_LEVELS, ACC_LEVELS: ACC_LEVELS, PENDANTS: PENDANTS,
    BUFF: BUFF, ENC: ENC, stat: stat, spiritEffect: spiritEffect, spiritLabel: spiritLabel, allSpirits: allSpirits,
    gemCombos: gemCombos, accList: accList, accCombos: accCombos, prune: prune, buffPcts: buffPcts, buffKey: buffKey,
    evalOne: evalOne, bestGear: bestGear, optimizeSpirits: optimizeSpirits, bestSpiritForGear: bestSpiritForGear, tarScore: tarScore, referenceGear: referenceGear
  };
  root.CHAMP21 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
