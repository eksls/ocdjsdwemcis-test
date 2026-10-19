/*
 * ExactOptimizer — 길드전 3마리 팀 비벨 합의 "정확한" 최댓값을 구하는 엔진
 * =====================================================================
 *
 * [문제 정의]
 *   팀 T = {(용 i, 타입 t_i, 장신구 a_i, 인챈트 e_i, 팬던트 p_i, 젬 묶음 g_i)} 3개
 *   최대화:  Σ_i  H_i · A_i · D_i                         (용별 비벨 = 체×공×방)
 *   제약:    용 중복 금지 / 장신구·팬던트는 보유 개수까지 / 젬은 스탯·단계별 보유 개수까지
 *            용 1마리당 젬 슬롯 5칸 / 예비 정령 수 ≤ 설정값
 *
 *   스탯 하나(s ∈ 체,공,방)는 그 스탯 젬 합 G 에만 의존한다:
 *     x  = 기본 + G + 물약
 *     x += ⌊x · 장신구%/100⌋
 *     x += 정령+
 *     x += ⌊x · 정령%/100⌋
 *     x += 정령 부가옵
 *     x += ⌊x · 팬던트%/100⌋
 *     S(G) = x + 컬렉션 + ⌊기본 · 버프%/100⌋
 *   모든 계수가 0 이상이므로 S(G)는 G에 대해 단조 비감소 → 비벨 V = S_체·S_공·S_방 도 단조 비감소.
 *
 * [정리 1: 젬은 "상위 N개"만 쓰면 된다]
 *   어떤 해에서 스탯 s 젬을 세 마리가 합쳐 N개 쓴다면, 그 N개를 보유 젬 중 상위 N개로 바꾸고
 *   순위끼리 1:1 대응시키면 모든 젬 값이 같거나 커진다. 단조성 때문에 비벨도 같거나 커진다.
 *   → 젬 문제는 "용별 스탯 개수 (h,a,d), h+a+d=5" 와 "상위 N개를 세 마리에게 나누는 방법"으로 줄어든다.
 *     (보유 젬이 모자라면 값 0인 빈 칸으로 채운다 = 젬을 덜 낀 경우까지 포함)
 *
 * [정리 2: 상한(UB)]
 *   옵션 o = (타입, 장신구, 인챈트, 팬던트, (h,a,d)) 의 UB(o) = 그 용이 혼자 각 스탯 상위 젬을 가져갈 때 비벨.
 *   실제 어떤 배분에서도 그 용의 젬 합 ≤ 상위 젬 합 이므로 실제 비벨 ≤ UB(o).
 *   → 팀 합 ≤ UB(o1)+UB(o2)+UB(o3). 이 값이 현재 최고 이하이면 그 가지는 최적해를 포함할 수 없다.
 *
 * [알고리즘: 분기 한정 + 정확 젬 분배]
 *   1) 용·타입 후보마다 모든 옵션의 UB 계산 (상위 18마리 같은 자르기 없음)
 *   2) 빠른 탐욕해로 초기 최고값(incumbent)을 잡고, UB가 모자란 옵션은 미리 버림 (정리 2로 안전)
 *   3) 용 3마리 조합 × 옵션 조합을 UB 내림차순으로 훑으며 UB 합 ≤ 최고값이면 즉시 중단
 *   4) 살아남은 조합만 정리 1의 젬 분배를 "전부" 따져 정확한 값을 계산
 *   잘라낸 가지는 모두 정리 2로 최적해를 포함하지 않음이 보장되므로, 결과는 수학적 최적해다.
 */
(function (root) {
  'use strict';

  const POT = [24, 6, 6];
  const DEFAULT_COLL = [240, 60, 60];
  const SLOTS = 5;

  // 21가지 젬 개수 모양 (h,a,d), h+a+d=5
  const SHAPES = [];
  for (let h = 0; h <= SLOTS; h++) for (let a = 0; a <= SLOTS - h; a++) SHAPES.push([h, a, SLOTS - h - a]);

  // 정수 연산만 사용 (x·p 는 정수, /100 의 버림은 부동소수 오차 없이 정확)
  function statVal(v, s, G, ap, pp, coll) {
    let x = v.base[s] + G + POT[s];
    x += Math.floor(x * ap / 100);
    x += v.spPlus[s];
    x += Math.floor(x * v.spPct[s] / 100);
    x += v.bonus[s];
    x += Math.floor(x * pp / 100);
    return x + coll[s] + Math.trunc(v.base[s] * v.mult100[s] / 100);
  }

  function solve(input) {
    const t0 = Date.now();
    const coll = input.coll || DEFAULT_COLL;
    const maxReserve = input.maxReserve == null ? Infinity : input.maxReserve;
    const accs = input.accs || [];
    const pens = input.pens || [];
    const stats = { options: 0, keptOptions: 0, triplesVisited: 0, pairEvals: 0, exactEvals: 0, ms: 0 };

    // ---------- 젬 재고: 스탯별 값 내림차순 펼침 (부족분은 값 0 빈칸) ----------
    const NEED_MAX = SLOTS * 3;
    const gemStock = [0, 1, 2].map(s => {
      const groups = (input.gems?.[s] || []).filter(g => g.count > 0).slice().sort((x, y) => y.val - x.val);
      const items = [];
      for (const g of groups) for (let n = 0; n < g.count && items.length < NEED_MAX; n++) items.push({ lv: g.lv, val: g.val });
      while (items.length < NEED_MAX) items.push({ lv: 0, val: 0 });
      const pre = [0];
      items.forEach(it => pre.push(pre[pre.length - 1] + it.val));
      return { items, pre };
    });

    // 상위 N개를 (값,개수) 묶음으로
    function topGroups(s, N) {
      const out = [];
      const items = gemStock[s].items;
      for (let i = 0; i < N; i++) {
        const it = items[i];
        const last = out[out.length - 1];
        if (last && last.val === it.val && last.lv === it.lv) last.n++;
        else out.push({ lv: it.lv, val: it.val, n: 1 });
      }
      return out;
    }

    // 상위 N개(N = k0+k1+k2)를 세 마리에게 나누는 모든 방법 (젬 합이 같은 분배는 하나로 합침)
    const splitMemo = new Map();
    function getSplits(s, k0, k1, k2) {
      const key = s * 1000 + k0 * 100 + k1 * 10 + k2;
      let res = splitMemo.get(key);
      if (res) return res;
      const groups = topGroups(s, k0 + k1 + k2);
      const G = groups.length;
      const seen = new Set();
      res = [];
      const c0 = new Array(G).fill(0), c1 = new Array(G).fill(0);
      const rec1 = (gi, rem, sum0, sum1) => {
        if (gi === G) {
          if (rem !== 0) return;
          let tot = 0; groups.forEach(g => { tot += g.val * g.n; });
          const sum2 = tot - sum0 - sum1;
          const sk = sum0 + ',' + sum1;
          if (seen.has(sk)) return;
          seen.add(sk);
          res.push({ sums: [sum0, sum1, sum2], cnt: [c0.slice(), c1.slice(), groups.map((g, i) => g.n - c0[i] - c1[i])], groups });
          return;
        }
        const max = Math.min(rem, groups[gi].n - c0[gi]);
        for (let n = 0; n <= max; n++) { c1[gi] = n; rec1(gi + 1, rem - n, sum0, sum1 + n * groups[gi].val); }
        c1[gi] = 0;
      };
      const rec0 = (gi, rem, sum0) => {
        if (gi === G) { if (rem === 0) rec1(0, k1, sum0, 0); return; }
        const max = Math.min(rem, groups[gi].n);
        for (let n = 0; n <= max; n++) { c0[gi] = n; rec0(gi + 1, rem - n, sum0 + n * groups[gi].val); }
        c0[gi] = 0;
      };
      rec0(0, k0, 0);
      splitMemo.set(key, res);
      return res;
    }

    // ---------- 용별 옵션 생성 ----------
    // ctx = (용, 타입, 장신구 선택, 팬던트) → 스탯 계산 캐시를 공유
    const accChoices = [{ gi: -1, enc: '', pct: [0, 0, 0] }];
    accs.forEach((a, gi) => a.choices.forEach(c => accChoices.push({ gi, enc: c.enc, pct: c.pct })));
    const penChoices = [{ pi: -1, pct: [0, 0, 0] }];
    pens.forEach((p, pi) => penChoices.push({ pi, pct: p.pct }));
    const dragons = input.dragons || [];

    function forEachOption(di, cb) {
      const d = dragons[di];
      d.variants.forEach((v, vi) => {
        for (const ac of accChoices) for (const pc of penChoices) {
          const ctx = { di, vi, v, ac, pc, memo: [new Map(), new Map(), new Map()] };
          const tbl = [0, 1, 2].map(s => {
            const t = [];
            for (let k = 0; k <= SLOTS; k++) t.push(statVal(v, s, gemStock[s].pre[k], ac.pct[s], pc.pct[s], coll));
            return t;
          });
          for (const sh of SHAPES) cb(ctx, sh, tbl[0][sh[0]] * tbl[1][sh[1]] * tbl[2][sh[2]]);
        }
      });
    }
    function statOf(ctx, s, G) {
      const m = ctx.memo[s];
      let v = m.get(G);
      if (v === undefined) { v = statVal(ctx.v, s, G, ctx.ac.pct[s], ctx.pc.pct[s], coll); m.set(G, v); }
      return v;
    }

    // ---------- 호환성 (장신구·팬던트 개수, 용 중복, 예비 수) ----------
    function compatible(list) {
      const accUse = new Map(), penUse = new Map();
      let reserve = 0;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        for (let j = 0; j < i; j++) if (list[j].ctx.di === o.ctx.di) return false;
        if (dragons[o.ctx.di].isReserve) reserve++;
        const gi = o.ctx.ac.gi, pi = o.ctx.pc.pi;
        if (gi >= 0) { const u = (accUse.get(gi) || 0) + 1; if (u > accs[gi].count) return false; accUse.set(gi, u); }
        if (pi >= 0) { const u = (penUse.get(pi) || 0) + 1; if (u > pens[pi].count) return false; penUse.set(pi, u); }
      }
      return reserve <= maxReserve;
    }

    // 할당 없는 빠른 호환성 검사 (분기 한정 안쪽 루프용)
    function compat2(a, b) {
      const ga = a.ctx.ac.gi, pa = a.ctx.pc.pi;
      if (ga >= 0 && ga === b.ctx.ac.gi && accs[ga].count < 2) return false;
      if (pa >= 0 && pa === b.ctx.pc.pi && pens[pa].count < 2) return false;
      return true;
    }
    function compat3(a, b, c) {
      if (!compat2(a, c) || !compat2(b, c)) return false;
      const g = c.ctx.ac.gi, p = c.ctx.pc.pi;
      if (g >= 0 && g === a.ctx.ac.gi && g === b.ctx.ac.gi && accs[g].count < 3) return false;
      if (p >= 0 && p === a.ctx.pc.pi && p === b.ctx.pc.pi && pens[p].count < 3) return false;
      return true;
    }

    // 두 마리 상한: 두 마리가 상위 젬을 "실제로 나눠 가질 때"의 정확한 최댓값.
    // 정리: 세 마리 해에서 a,b 가 가진 젬은 각 스탯 상위 (k_a+k_b)개 이하로 순위 대응되므로
    //       V_a + V_b ≤ pairEval(a,b),  V_c ≤ UB(c)  →  팀 합 ≤ pairEval(a,b) + UB(c)  (유효한 상한)
    function pairEval(a, b) {
      const sp = [0, 1, 2].map(s => getSplits(s, a.sh[s], b.sh[s], 0));
      let best = -1;
      const va = sp.map((list, s) => list.map(x => statOf(a.ctx, s, x.sums[0])));
      const vb = sp.map((list, s) => list.map(x => statOf(b.ctx, s, x.sums[1])));
      for (let x = 0; x < sp[0].length; x++) for (let y = 0; y < sp[1].length; y++) {
        const pa = va[0][x] * va[1][y], pb = vb[0][x] * vb[1][y];
        for (let z = 0; z < sp[2].length; z++) { const t = pa * va[2][z] + pb * vb[2][z]; if (t > best) best = t; }
      }
      return best;
    }

    // ---------- 정확 평가: 젬 분배 전수 ----------
    function exactEval(trio) {
      stats.exactEvals++;
      const sp = [0, 1, 2].map(s => getSplits(s, trio[0].sh[s], trio[1].sh[s], trio[2].sh[s]));
      const val = sp.map((list, s) => list.map(spl => trio.map((o, i) => statOf(o.ctx, s, spl.sums[i]))));
      let best = -1, bi = null;
      for (let x = 0; x < sp[0].length; x++) {
        const vx = val[0][x];
        for (let y = 0; y < sp[1].length; y++) {
          const vy = val[1][y];
          const p0 = vx[0] * vy[0], p1 = vx[1] * vy[1], p2 = vx[2] * vy[2];
          for (let z = 0; z < sp[2].length; z++) {
            const vz = val[2][z];
            const t = p0 * vz[0] + p1 * vz[1] + p2 * vz[2];
            if (t > best) { best = t; bi = [x, y, z]; }
          }
        }
      }
      return { total: best, pick: bi.map((ix, s) => sp[s][ix]) };
    }

    function buildResult(trio, ev) {
      return trio.map((o, i) => {
        const gemLevels = [0, 1, 2].map(s => {
          const spl = ev.pick[s];
          const out = [];
          spl.groups.forEach((g, gi) => { for (let n = 0; n < spl.cnt[i][gi]; n++) if (g.lv) out.push(g.lv); });
          return out;
        });
        const st = [0, 1, 2].map(s => statOf(o.ctx, s, ev.pick[s].sums[i]));
        return {
          dragonIndex: o.ctx.di, variantIndex: o.ctx.vi,
          accIndex: o.ctx.ac.gi, enc: o.ctx.ac.enc, penIndex: o.ctx.pc.pi,
          shape: o.sh.slice(), gemLevels, stats: st, vval: st[0] * st[1] * st[2],
        };
      });
    }

    const n = dragons.length;
    if (n < 3) return { total: 0, team: [], stats };

    // ---------- 1단계: 용별 최대 UB ----------
    const mx = new Array(n).fill(0);
    for (let di = 0; di < n; di++) forEachOption(di, (ctx, sh, ub) => { stats.options++; if (ub > mx[di]) mx[di] = ub; });

    // ---------- 2단계: 초기 최고값 (탐욕) ----------
    let best = -1, bestTeam = null;
    {
      const order = [...Array(n).keys()].sort((x, y) => mx[y] - mx[x]).slice(0, Math.min(n, 6));
      const full = new Map();
      for (const di of order) {
        const list = [];
        forEachOption(di, (ctx, sh, ub) => list.push({ ctx, sh, ub }));
        list.sort((x, y) => y.ub - x.ub);
        full.set(di, list);
      }
      const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) for (let k = j + 1; k < order.length; k++) {
        const ids = [order[i], order[j], order[k]];
        for (const p of PERMS) {
          const chosen = [];
          for (const idx of p) {
            const o = full.get(ids[idx]).find(c => compatible([...chosen, c]));
            if (!o) break;
            chosen.push(o);
          }
          if (chosen.length < 3) continue;
          const ev = exactEval(chosen);
          if (ev.total > best) { best = ev.total; bestTeam = buildResult(chosen, ev); }
        }
      }
    }

    // ---------- 3단계: 상한으로 옵션 미리 버리기 + 분기 한정 ----------
    const sortedMx = mx.slice().sort((x, y) => y - x);
    const sets = [];
    for (let di = 0; di < n; di++) {
      // 다른 두 마리가 낼 수 있는 최대 UB 합
      const others = sortedMx[0] === mx[di] ? sortedMx[1] + sortedMx[2]
        : sortedMx[1] === mx[di] ? sortedMx[0] + sortedMx[2] : sortedMx[0] + sortedMx[1];
      const thr = best - others;
      if (mx[di] <= thr) continue;
      const list = [];
      forEachOption(di, (ctx, sh, ub) => { if (ub > thr) list.push({ ctx, sh, ub }); });
      list.sort((x, y) => y.ub - x.ub);
      list.forEach((o, idx) => { o.idx = idx; });
      stats.keptOptions += list.length;
      sets.push({ di, opts: list, top: list[0].ub });
    }
    sets.sort((x, y) => y.top - x.top);
    const m = sets.length;

    for (let i = 0; i < m - 2; i++) {
      if (sets[i].top + sets[i + 1].top + sets[i + 2].top <= best) break;
      for (let j = i + 1; j < m - 1; j++) {
        if (sets[i].top + sets[j].top + sets[j + 1].top <= best) break;
        const pairCache = new Map();   // (i,j) 고정 동안 (a,b) 두 마리 값 재사용
        const nB = sets[j].opts.length;
        for (let k = j + 1; k < m; k++) {
          const A = sets[i].opts, B = sets[j].opts, C = sets[k].opts;
          if (A[0].ub + B[0].ub + C[0].ub <= best) break;
          const rs = (dragons[sets[i].di].isReserve ? 1 : 0) + (dragons[sets[j].di].isReserve ? 1 : 0) + (dragons[sets[k].di].isReserve ? 1 : 0);
          if (rs > maxReserve) continue;
          stats.triplesVisited++;
          for (const a of A) {
            if (a.ub + B[0].ub + C[0].ub <= best) break;
            for (const b of B) {
              if (a.ub + b.ub + C[0].ub <= best) break;
              if (!compat2(a, b)) continue;
              const pk = a.idx * nB + b.idx;
              let ab = pairCache.get(pk);           // a,b 젬 공유를 반영한 정확한 두 마리 값
              if (ab === undefined) { ab = pairEval(a, b); pairCache.set(pk, ab); stats.pairEvals++; }
              if (ab + C[0].ub <= best) continue;
              for (const c of C) {
                if (ab + c.ub <= best) break;       // 공유 반영 상한으로 중단 (유효)
                if (!compat3(a, b, c)) continue;
                const trio = [a, b, c];
                const ev = exactEval(trio);
                if (ev.total > best) { best = ev.total; bestTeam = buildResult(trio, ev); }
              }
            }
          }
        }
      }
    }

    stats.ms = Date.now() - t0;
    if (!bestTeam) return { total: 0, team: [], stats };
    bestTeam.sort((x, y) => y.vval - x.vval);
    return { total: best, team: bestTeam, stats };
  }

  const api = { solve, statVal, SHAPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ExactOptimizer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
