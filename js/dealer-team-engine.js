/*
 * 정타 딜러 4마리 계산 엔진  (dealer-survive-engine.js 가 먼저 로드돼 있어야 함)
 *
 * 문제
 *  - 자리 4개: 11·12번(조건 A), 13·14번(조건 B). 자리마다 정타 n대 + 방어 m회를 맞고 체력 1 이상 남아야 함
 *  - 체크한 용 타입 중에서 4마리를 고름 (같은 타입 여러 마리 가능)
 *  - 보유 정령(1개씩), 젬(단계·스탯별 개수), 장신구(개수 또는 "전체"=무제한), 팬던트(개수 또는 달 "전체")를 나눠 씀
 *  - 4마리 공격력 합이 가장 큰 팀 (상위 K팀)
 *
 * 정확하게 푸는 방법 (분기 한정)
 *  1) 한 마리 후보 = (타입, 정령, 장신구·인챈트, 팬던트, 젬 개수 체/공/방). 젬 단계는 아직 안 정함
 *     후보의 상한 = 보유 젬 중 가장 좋은 것을 썼을 때 공격력. 그때도 못 버티면 후보에서 뺌
 *  2) 자리마다 상한 높은 순으로 보며 4마리를 고르고, 지금까지 합 + 남은 자리 상한 ≤ K번째 팀이면 멈춤
 *  3) 4마리가 정해지면 젬 단계를 정확히 배분:
 *     팀이 쓰는 스탯별 젬은 "그 스탯 상위 k개"가 최선(더 좋은 젬으로 바꿔서 손해 보는 일 없음).
 *     공격 젬은 공격력 합 최대가 되게 전부 나눠 보고, 체·방 젬은 4마리가 모두 버티는 배분이 있는지 확인
 */
(function (root) {
  "use strict";
  var DS = root.DealerSurvive;
  var GEM_LEVELS = [44, 42, 40, 38, 36, 35, 34, 33];
  var STAT_KR = ["체", "공", "방"];
  var ACC_ITEMS = Object.keys(DS.ACCESSORY_STATS);
  var mulFloor = function (x, pct) { return Math.floor(x * (100 + pct) / 100); };

  function moonOptions() { return DS.pendantOptions("달"); }
  function penLabel(kind, p) {
    var parts = [];
    [1, 0, 2].forEach(function (s) { if (p[s]) parts.push({ s: s, v: p[s] }); });
    parts.sort(function (x, y) { return y.v - x.v; });
    return kind + " " + parts.map(function (x) { return STAT_KR[x.s] + x.v; }).join(" ");
  }

  // 장신구 후보: {res: 자원 번호(-1 = 무제한), pct, label}
  function accOptions(entries, enchantValue) {
    var out = [], seenFree = {};
    (entries || []).forEach(function (e, r) {
      var lv = +e.level;
      var items = e.item === "전체" ? ACC_ITEMS : [e.item];
      var unlimited = e.item === "전체";
      var count = unlimited ? Infinity : Math.max(0, e.count | 0);
      if (!count) return;
      var encs = (e.enchant && e.enchant !== "자유" && STAT_KR.indexOf(e.enchant) >= 0) ? [STAT_KR.indexOf(e.enchant)] : [0, 1, 2];
      items.forEach(function (item) {
        var base = DS.ACCESSORY_STATS[item] && DS.ACCESSORY_STATS[item][lv];
        if (!base) return;
        encs.forEach(function (en) {
          var pct = base.map(function (v, i) { return v + (i === en ? enchantValue : 0); });
          var label = item + " " + lv + " · 인챈 " + STAT_KR[en];
          if (unlimited) { var k = pct.join(","); if (seenFree[k]) return; seenFree[k] = 1; }
          out.push({ res: unlimited ? -1 : r, pct: pct, label: label });
        });
      });
    });
    return out;
  }
  // 팬던트 후보
  function penOptions(entries) {
    var out = [], seenFree = {};
    (entries || []).forEach(function (e, q) {
      var count = e.opt === "전체" ? Infinity : Math.max(0, e.count | 0);
      if (!count) return;
      var opts = e.opt === "전체" ? moonOptions() : [e.opt];
      opts.forEach(function (p) {
        if (!Array.isArray(p) || p.length !== 3) return;
        var unlimited = e.opt === "전체";
        if (unlimited) { var k = e.kind + p.join(","); if (seenFree[k]) return; seenFree[k] = 1; }
        out.push({ res: unlimited ? -1 : q, pct: p.slice(), label: penLabel(e.kind, p) });
      });
    });
    return out;
  }

  // 젬 보유: {44:[체,공,방], ...} → 스탯별 [{v: 값, n: 개수}] (값 큰 순), HP 는 ×4
  function gemStock(gems) {
    return [0, 1, 2].map(function (s) {
      var list = [];
      GEM_LEVELS.forEach(function (lv) {
        var n = Math.max(0, ((gems || {})[lv] || [])[s] | 0);
        if (n) list.push({ lv: lv, v: lv * (s === 0 ? 4 : 1), n: n });
      });
      return list;
    });
  }
  function topSums(stock) {   // c 개 썼을 때 최대 합 (c = 0..20)
    var arr = [0], vals = [];
    stock.forEach(function (g) { for (var i = 0; i < g.n && vals.length < 20; i++) vals.push(g.v); });
    for (var c = 1; c <= 20; c++) arr.push(c <= vals.length ? arr[c - 1] + vals[c - 1] : -1);
    return arr;
  }
  // 상위 k 개를 단계별 개수로
  function topK(stock, k) {
    var out = [];
    for (var i = 0; i < stock.length && k > 0; i++) { var t = Math.min(k, stock[i].n); out.push({ lv: stock[i].lv, v: stock[i].v, n: t }); k -= t; }
    return out;
  }
  // 단계별 개수 목록에서 size 개 고르는 모든 방법 (각각 [단계별 개수])
  var msCache = new Map();
  function multisets(avail, size) {
    var ck = size + ":" + avail.map(function (g) { return g.n; }).join(",");
    var hit = msCache.get(ck);
    if (hit) return hit;
    if (msCache.size > 200000) msCache.clear();
    var res = [], pick = new Array(avail.length).fill(0);
    (function rec(i, left) {
      if (left === 0) { res.push(pick.slice()); return; }
      if (i >= avail.length) return;
      for (var t = Math.min(left, avail[i].n); t >= 0; t--) { pick[i] = t; rec(i + 1, left - t); }
      pick[i] = 0;
    })(0, size);
    msCache.set(ck, res);
    return res;
  }

  /*
   * opts = {
   *   grade, bossAtk, buffs:[체%,공%,방%], enchantValue (21),
   *   groups: [{hits, guards}, {hits, guards}]   // [11·12번, 13·14번]
   *   types: ["light-atk", ...], spirits: [{slots, bonus, name}], gems: {44:[h,a,d],...},
   *   accessories: [{level, item("전체"|이름), enchant("자유"|체|공|방), count}],
   *   pendants: [{kind, opt("전체"|[h,a,d]), count}], topK: 3, timeLimitMs
   * }
   *
   * 1) 한 마리 "후보" = (정령, 장신구 칸, 팬던트 칸, 젬 개수 체/공/방)
   *    - "전체" 장신구·팬던트와 용 타입은 개수 제한이 없으니 후보 안에서 고름
   *    - 상한 = 보유 젬 중 가장 좋은 것을 개수만큼 썼을 때, 버티는 것 중 최고 공격력
   * 2) 자리 4개에 후보를 상한 높은 순으로 넣어 보며(분기 한정), 합이 지금 K번째 팀 이하가 되면 멈춤
   * 3) 4마리가 정해지면 젬 단계를 정확히 나눔: 팀이 쓰는 젬은 스탯마다 "보유 상위 k개"가 최선이므로
   *    그 안에서 누가 어떤 단계를 가질지 전부 따져 보고, 그때마다 용 타입·장신구·팬던트를 다시 최선으로 고름
   */
  function solve(opts) {
    var t0 = Date.now();
    var A = opts.bossAtk || 2750, buffs = opts.buffs || [0, 0, 0], grade = opts.grade || "9.0";
    var encV = opts.enchantValue == null ? 21 : opts.enchantValue;
    // 자리별로 쓸 수 있는 용 타입 (엔진 자리 순서: 11, 12, 13, 14번). 없으면 opts.types 를 모든 자리에
    var POS_NAME = ["11번", "12번", "13번", "14번"];
    var slotTypes = [0, 1, 2, 3].map(function (k) { return ((opts.slotTypes && opts.slotTypes[k]) || opts.types || []).slice().sort(); });
    var slotDragons = slotTypes.map(function (ts) { return DS.DRAGONS.filter(function (d) { return ts.indexOf(d.key) >= 0; }); });
    var spirits = (opts.spirits || []).map(function (s) { return { sp: s, eff: DS.spiritStats(s) }; });
    var accEntries = opts.accessories || [], penEntries = opts.pendants || [];
    var accRes = accEntries.map(function (e) { return e.item === "전체" ? Infinity : Math.max(0, e.count | 0); });
    var penRes = penEntries.map(function (e) { return e.opt === "전체" ? Infinity : Math.max(0, e.count | 0); });
    var stock = gemStock(opts.gems);
    var gemTotal = stock.map(function (l) { return l.reduce(function (t, g) { return t + g.n; }, 0); });
    var tops = stock.map(topSums);
    var groups = (opts.groups || [{ hits: 0, guards: 0 }, { hits: 0, guards: 0 }]).map(function (g) {
      return { hits: Math.max(0, g.hits | 0), guards: Math.max(0, g.guards | 0) };
    });
    var K = Math.max(1, opts.topK || 3);
    var limitMs = opts.timeLimitMs || 10000;

    var problems = [];
    slotDragons.forEach(function (ds, k) { if (!ds.length) problems.push(POS_NAME[k] + " 자리에 용 타입을 하나 이상 고르세요."); });
    // 정령마다 가진 개수 (없으면 1개)
    var spCap = (opts.spirits || []).map(function (s) { return s.count == null ? 1 : Math.max(0, s.count | 0); });
    if (spCap.reduce(function (t, c) { return t + c; }, 0) < 4) problems.push("정령이 4개 이상 필요합니다 (개수 합).");
    if (gemTotal[0] + gemTotal[1] + gemTotal[2] < 20) problems.push("젬이 20개 이상 필요합니다 (지금 " + (gemTotal[0] + gemTotal[1] + gemTotal[2]) + "개).");
    if (accRes.reduce(function (t, c) { return t + c; }, 0) < 4) problems.push("장신구가 4개 이상 필요합니다.");
    if (penRes.reduce(function (t, c) { return t + c; }, 0) < 4) problems.push("팬던트가 4개 이상 필요합니다.");
    if (problems.length) return { teams: [], problems: problems };

    // ---- 장신구·팬던트 묶음: 0 = 무제한("전체"), r+1 = r번 칸 ----
    function dominatedFilter(list) {
      return list.filter(function (x, i) {
        return !list.some(function (y, j) {
          if (j === i) return false;
          var ge = y.pct[0] >= x.pct[0] && y.pct[1] >= x.pct[1] && y.pct[2] >= x.pct[2];
          var gt = y.pct[0] > x.pct[0] || y.pct[1] > x.pct[1] || y.pct[2] > x.pct[2];
          return ge && (gt || j < i);
        });
      });
    }
    var accSel = [dominatedFilter(accOptions(accEntries.filter(function (e) { return e.item === "전체"; }), encV))];
    accEntries.forEach(function (e, r) { accSel.push(e.item === "전체" || !accRes[r] ? [] : dominatedFilter(accOptions([e], encV))); });
    var penSel = [dominatedFilter(penOptions(penEntries.filter(function (e) { return e.opt === "전체"; })))];
    penEntries.forEach(function (e, q) { penSel.push(e.opt === "전체" || !penRes[q] ? [] : penOptions([e])); });

    function finalStat(d, s, x) {
      if (s === 0) return mulFloor(x, buffs[0]);
      if (s === 1) return mulFloor(Math.floor(x * (d.dark ? 125 : 100) / 100), buffs[1]);
      return mulFloor(Math.floor(x * (d.light ? 125 : 100) / 100), buffs[2]);
    }
    function takenOf(g, def) { var dm = DS.damage(A, def); return dm.hit * groups[g].hits + dm.guard * groups[g].guards; }

    // 후보 묶음(정령, 장신구 묶음, 팬던트 묶음)의 "틀" 목록: 타입 × 장신구 × 팬던트, 스탯 계산은 캐시
    // 자리마다 고를 수 있는 타입이 다를 수 있으므로 "타입 묶음"별로 따로 만듦
    var classesBySet = {}, classCount = 0;
    function buildClasses(dragons) {
      var classes = [];
      spirits.forEach(function (sp, si) {
        if (!spCap[si]) return;
        for (var as = 0; as < accSel.length; as++) {
          if (!accSel[as].length) continue;
          for (var ps = 0; ps < penSel.length; ps++) {
            if (!penSel[ps].length) continue;
            var frames = [];
            dragons.forEach(function (d) {
              var base = DS.BASE_STATS[d.type][grade];
              accSel[as].forEach(function (ac) {
                penSel[ps].forEach(function (pn) {
                  var cache = [new Map(), new Map(), new Map()], e = sp.eff;
                  frames.push({ d: d, ac: ac, pn: pn, val: function (s, sum) {
                    var c = cache[s].get(sum);
                    if (c === undefined) { c = finalStat(d, s, DS.stat(base[s] + [24, 6, 6][s], sum, ac.pct[s], e.plus[s], e.pct[s], pn.pct[s], [240, 60, 60][s], e.bonus[s])); cache[s].set(sum, c); }
                    return c;
                  } });
                });
              });
            });
            // 공격 젬 1점이 최종 공격력을 최소 얼마나 올리는지 (틀 중 가장 작은 배율)
            var slope = Infinity;
            frames.forEach(function (f) {
              var m = (1 + f.ac.pct[1] / 100) * (1 + sp.eff.pct[1] / 100) * (1 + f.pn.pct[1] / 100) * (f.d.dark ? 1.25 : 1) * (1 + buffs[1] / 100);
              if (m < slope) slope = m;
            });
            classes.push({ si: si, as: as, ps: ps, frames: frames, slope: slope, memo: [new Map(), new Map()] });
          }
        }
      });
      classCount += classes.length;
      return classes;
    }
    // 한 마리 값: 묶음 cl, 자리 조건 g, 젬 합 (체, 공, 방) → 버티는 틀 중 최고 공격력과 그 틀
    function classValue(cl, g, sh, sa, sd) {
      var key = (sh * 1024 + sa) * 1024 + sd, m = cl.memo[g], c = m.get(key);
      if (c !== undefined) return c;
      var bestV = -1, bestF = null;
      for (var i = 0; i < cl.frames.length; i++) {
        var f = cl.frames[i], atk = f.val(1, sa);
        if (atk <= bestV) continue;
        if (f.val(0, sh) - takenOf(g, f.val(2, sd)) < 1) continue;
        bestV = atk; bestF = f;
      }
      c = { v: bestV, f: bestF };
      m.set(key, c);
      return c;
    }

    // ---- 1) 자리별 후보 + 상한 (자리 조건과 타입 묶음이 같은 자리는 같은 목록을 씀) ----
    var slots = [0, 0, 1, 1];                       // 자리 → 조건 묶음 (11·12번 = 0, 13·14번 = 1)
    var slotKey = [0, 1, 2, 3].map(function (k) { return slots[k] + "|" + slotTypes[k].join(","); });
    var listByKey = {};
    var slotList = slotKey.map(function (key, k) {
      if (listByKey[key]) return listByKey[key];
      var setKey = slotTypes[k].join(",");
      var classes = classesBySet[setKey] || (classesBySet[setKey] = buildClasses(slotDragons[k]));
      var g = slots[k], list = [];
      classes.forEach(function (cl) {
        for (var h = 0; h <= 5; h++) for (var a = 0; a <= 5 - h; a++) {
          var dd = 5 - h - a;
          if (tops[0][h] < 0 || tops[1][a] < 0 || tops[2][dd] < 0) continue;
          var cv = classValue(cl, g, tops[0][h], tops[1][a], tops[2][dd]);
          if (cv.v >= 0) list.push({ cl: cl, si: cl.si, as: cl.as, ps: cl.ps, c: [h, a, dd], ub: cv.v });
        }
      });
      list.sort(function (x, y) { return y.ub - x.ub; });
      return (listByKey[key] = list);
    });
    var emptyAt = slotList.map(function (l) { return l.length; }).indexOf(0);
    if (emptyAt >= 0) {
      return { teams: [], problems: [POS_NAME[emptyAt] + " 자리 조건을 버틸 수 있는 조합이 없습니다. 정타·방어 횟수를 줄이거나 다른 용 타입을 골라 보세요."],
        stats: { candidates: slotList.map(function (l) { return l.length; }), ms: Date.now() - t0 } };
    }

    // ---- 3) 젬 단계 나누기 (4마리 확정 후) ----
    var spKey = spirits.map(function (x) { return x.sp.slots.map(function (q) { return q.stat + q.mode; }).join("") + x.sp.bonus; });
    function allocate(team, floor) {
      var need = [0, 1, 2].map(function (s) { return team.reduce(function (t, it) { return t + it.c[s]; }, 0); });
      var pools = [0, 1, 2].map(function (s) { return topK(stock[s], need[s]); });
      var ways = team.map(function () { return null; });
      var bestTot = floor, bestPick = null, pick = [];
      // 남은 용들의 상한 (공격력)
      var ubRest = [0, 0, 0, 0, 0];
      for (var j = 3; j >= 0; j--) ubRest[j] = ubRest[j + 1] + team[j].ub;
      // 남은 젬 풀에서 용 i 가 받을 수 있는 가장 좋은 젬 합
      function topOf(pool, c) { var t = 0; for (var i = 0; i < pool.length && c > 0; i++) { var n = Math.min(c, pool[i].n); t += n * pool[i].v; c -= n; } return t; }
      function ubFrom(j, left) {   // 용 j.. 각자 남은 풀의 가장 좋은 젬을 받는다고 할 때 합 (안전한 상한)
        var t = 0;
        for (var i = j; i < 4; i++) {
          var it = team[i], cv = classValue(it.cl, slots[i], topOf(left[0], it.c[0]), topOf(left[1], it.c[1]), topOf(left[2], it.c[2]));
          if (cv.v < 0) return -Infinity;
          t += cv.v;
        }
        return t;
      }
      (function rec(j, left, sum) {
        if (Date.now() - t0 > limitMs) return;
        if (j === 4) { if (sum > bestTot) { bestTot = sum; bestPick = pick.slice(); } return; }
        var ubNext = ubFrom(j + 1, left);
        if (ubNext === -Infinity) return;
        var it = team[j], last = j === 3;
        var mh = last ? [left[0].map(function (g) { return g.n; })] : multisets(left[0], it.c[0]);
        var ma = last ? [left[1].map(function (g) { return g.n; })] : multisets(left[1], it.c[1]);
        var md = last ? [left[2].map(function (g) { return g.n; })] : multisets(left[2], it.c[2]);
        var sumsOf = function (ms, pool) { return ms.map(function (m) { var t = 0; for (var i = 0; i < m.length; i++) t += m[i] * pool[i].v; return t; }); };
        var SH = sumsOf(mh, left[0]), SA = sumsOf(ma, left[1]), SD = sumsOf(md, left[2]);
        var cut = bestTot - sum - ubNext;   // 이 용의 값이 cut 이하면 볼 필요 없음
        var cand = [];
        for (var x = 0; x < mh.length; x++) {
          for (var y = 0; y < md.length; y++) {
            for (var z = 0; z < ma.length; z++) {
              var cv = classValue(it.cl, slots[j], SH[x], SA[z], SD[y]);
              if (cv.v < 0 || cv.v <= cut) continue;
              cand.push({ v: cv.v, f: cv.f, w: [mh[x], ma[z], md[y]], s: [SH[x], SA[z], SD[y]] });
            }
          }
        }
        cand.sort(function (p, q) { return q.v - p.v; });
        for (var c = 0; c < cand.length; c++) {
          var cd = cand[c];
          if (sum + cd.v + ubNext <= bestTot) break;
          pick[j] = cd;
          rec(j + 1, left.map(function (pool, s) { return pool.map(function (g, i) { return { lv: g.lv, v: g.v, n: g.n - cd.w[s][i] }; }); }), sum + cd.v);
        }
      })(0, pools, 0);
      if (!bestPick) return null;
      return { total: bestTot, pick: bestPick.map(function (p) {
        return { v: p.v, f: p.f, s: p.s, gems: p.w.map(function (w, s) { return w.map(function (n, i) { return { lv: pools[s][i].lv, n: n }; }).filter(function (x) { return x.n; }); }) };
      }) };
    }

    // ---- 2) 분기 한정 ----
    var best = [], threshold = -Infinity, nodes = 0, leaves = 0, timedOut = false;
    var usedSp = new Int32Array(spirits.length), usedAcc = new Array(accEntries.length).fill(0), usedPen = new Array(penEntries.length).fill(0);
    var usedGem = [0, 0, 0];
    var chosen = [], chosenIdx = [];
    function fits(it) {
      if (usedSp[it.si] >= spCap[it.si]) return false;
      if (it.as > 0 && usedAcc[it.as - 1] >= accRes[it.as - 1]) return false;
      if (it.ps > 0 && usedPen[it.ps - 1] >= penRes[it.ps - 1]) return false;
      return usedGem[0] + it.c[0] <= gemTotal[0] && usedGem[1] + it.c[1] <= gemTotal[1] && usedGem[2] + it.c[2] <= gemTotal[2];
    }
    function apply(it, sgn) {
      usedSp[it.si] += sgn;
      if (it.as > 0) usedAcc[it.as - 1] += sgn;
      if (it.ps > 0) usedPen[it.ps - 1] += sgn;
      usedGem[0] += sgn * it.c[0]; usedGem[1] += sgn * it.c[1]; usedGem[2] += sgn * it.c[2];
    }
    function bestFit(j, from) {
      var l = slotList[j];
      for (var i = from || 0; i < l.length; i++) if (fits(l[i])) return l[i].ub;
      return -Infinity;
    }
    function insert(team, al) {
      // 자리 묶음별 (정령, 용 타입)이 같으면 같은 팀으로 보고 더 좋은 장비 배분 하나만 남김
      var sig = team.map(function (it, j) { return slotKey[j] + "|" + spKey[it.si] + "|" + al.pick[j].f.d.key; }).sort().join("#");
      for (var i = 0; i < best.length; i++) if (best[i].sig === sig) {
        if (al.total <= best[i].total) return;
        best.splice(i, 1); break;
      }
      best.push({ sig: sig, total: al.total, team: team, al: al });
      best.sort(function (x, y) { return y.total - x.total; });
      if (best.length > K) best.length = K;
      if (best.length === K) threshold = best[K - 1].total;
    }
    // 공격 젬 나눠 갖기 보정: 상한은 각자 "가장 좋은 공격 젬"을 가정하므로, 고른 용들이 실제로 나눠 가지면
    // 적어도 (기울기 최소값) × (부족한 젬 점수) − 여유 만큼은 낮아짐 → 상한에서 빼도 안전
    var topA = tops[1];
    var cnt = [], topSumSel = [], slopeMin = [];
    function sharePenalty(k) {
      if (k < 2) return 0;
      var tot = 0, sumTop = 0, m = Infinity;
      for (var j = 0; j < k; j++) { tot += chosen[j].c[1]; sumTop += topA[chosen[j].c[1]]; if (chosen[j].cl.slope < m) m = chosen[j].cl.slope; }
      var D = sumTop - topA[Math.min(tot, 20)];
      var pen = m * D - 8 * k;
      return pen > 0 ? pen : 0;
    }
    function dfs(k, sum) {
      if (timedOut) return;
      if (k === 4) {
        leaves++;
        var al = allocate(chosen.slice(), best.length >= K ? threshold : -1);
        if (al) insert(chosen.slice(), al);
        if (Date.now() - t0 > limitMs) timedOut = true;
        return;
      }
      if ((++nodes & 255) === 0 && Date.now() - t0 > limitMs) { timedOut = true; return; }
      var list = slotList[k];
      // 조건·타입이 똑같은 짝 자리(11·12 또는 13·14)는 두 번째 용이 첫 번째 이후 후보만 봄 (같은 후보도 가능: 같은 정령을 2개 이상 가졌을 때)
      var start = ((k === 1 || k === 3) && slotKey[k] === slotKey[k - 1]) ? chosenIdx[k - 1] : 0;
      var rest = 0;
      for (var j = k + 1; j < 4; j++) {
        var bf = bestFit(j, (j === k + 1 && slotKey[j] === slotKey[k]) ? start : 0);
        if (bf === -Infinity) return;
        rest += bf;
      }
      for (var idx = start; idx < list.length; idx++) {
        var it = list[idx];
        if (best.length >= K && sum + it.ub + rest <= threshold) break;
        if (!fits(it)) continue;
        apply(it, 1);
        chosen[k] = it; chosenIdx[k] = idx;
        if (best.length >= K && k >= 1 && sum + it.ub + rest - sharePenalty(k + 1) <= threshold) { apply(it, -1); continue; }
        dfs(k + 1, sum + it.ub);
        apply(it, -1);
        if (timedOut) return;
      }
    }
    dfs(0, 0);

    // ---- 결과 정리 ----
    var POS = ["11번", "12번", "13번", "14번"];
    var teams = best.map(function (b) {
      var members = b.team.map(function (it, j) {
        var g = slots[j], gr = groups[g], p = b.al.pick[j], f = p.f;
        var hp = f.val(0, p.s[0]), atk = f.val(1, p.s[1]), def = f.val(2, p.s[2]);
        var dm = DS.damage(A, def), taken = dm.hit * gr.hits + dm.guard * gr.guards;
        return { pos: POS[j], group: g, dragon: f.d, spirit: spirits[it.si].sp, spiritIndex: it.si,
          acc: f.ac, pen: f.pn, gems: { h: p.gems[0], a: p.gems[1], d: p.gems[2] }, count: it.c,
          hp: hp, atk: atk, def: def, hit: dm.hit, guard: dm.guard, taken: taken, left: hp - taken,
          hits: gr.hits, guards: gr.guards };
      });
      return { total: b.total, members: members };
    });
    return { teams: teams, problems: teams.length ? [] : ["조건을 모두 버티는 4마리 조합이 없습니다. 정타·방어 횟수를 줄이거나 젬·장신구·팬던트를 더 넣어 보세요."],
      exact: !timedOut, stats: { candidates: slotList.map(function (l) { return l.length; }), classes: classCount, nodes: nodes, leaves: leaves, ms: Date.now() - t0 } };
  }

  root.DealerTeam = { solve: solve, accOptions: accOptions, penOptions: penOptions, gemStock: gemStock, GEM_LEVELS: GEM_LEVELS };
})(typeof window !== "undefined" ? window : globalThis);
