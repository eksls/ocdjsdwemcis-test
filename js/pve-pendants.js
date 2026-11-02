/*
 * 탱커(PVE) 계산기 — 펜던트 "수동" 모드를 여러 개 목록으로
 *  - 펜던트를 최대 30개까지 추가, 아무 칸이나 지우기
 *  - 칸마다 "미사용" 체크박스 (용/정령 탭처럼 체크하면 계산에서 뺌, 목록에는 남음)
 *  - 체크 안 된 펜던트를 모두 후보로 넣고 최적화가 그중 가장 좋은 것을 고름
 * pve-app.js(원본 빌드)가 이 파일의 함수를 부름. 저장은 이 기기 브라우저(dv1- 로 시작 → ⋯ 메뉴 초기화 때 같이 지워짐)
 */
(function () {
  "use strict";
  var MAX = 30;
  var STATS = [["hp", "체력"], ["atk", "공격"], ["def", "방어"]];
  var VALUES = [1, 2, 3, 4, 5, 6];
  var NONE = { id: "pendant-none", kind: "none", name: "펜던트 없음", lines: [], hpPercent: 0, atkPercent: 0, defPercent: 0 };
  function key(mode) { return "dv1-pve-pendant-list-v1-" + mode; }
  function lineCount(kind) { return kind === "sun" ? 3 : 2; }
  function fixLines(kind, lines) {
    var n = lineCount(kind), out = [];
    for (var i = 0; i < n; i++) {
      var l = (lines || [])[i] || {};
      out.push({ stat: l.stat === "atk" || l.stat === "def" ? l.stat : (l.stat === "hp" ? "hp" : STATS[i % 3][0]), value: VALUES.indexOf(+l.value) >= 0 ? +l.value : 1 });
    }
    return out;
  }
  function clean(list) {
    return (Array.isArray(list) ? list : []).slice(0, MAX).map(function (p) {
      var kind = p && p.kind === "sun" ? "sun" : "generic";
      return { kind: kind, lines: fixLines(kind, p && p.lines), off: !!(p && p.off) };
    });
  }

  window.__dvPLLoad = function (mode, kind, me) {
    try {
      var saved = JSON.parse(localStorage.getItem(key(mode)) || "null");
      if (Array.isArray(saved)) return clean(saved);
    } catch (e) {}
    // 처음: 지금까지 쓰던 수동 펜던트 1개를 목록 첫 칸으로
    var k = kind === "sun" ? "sun" : "generic";
    return clean([{ kind: k, lines: me && me[k], off: false }]);
  };
  window.__dvPLSave = function (mode, list) {
    try { localStorage.setItem(key(mode), JSON.stringify(list)); } catch (e) {}
  };
  // 최적화 후보: 미사용이 아닌 펜던트 전부 (같은 옵션 합은 하나로)
  window.__dvPLCands = function (types, list, build) {
    var out = [], seen = {};
    (list || []).forEach(function (p) {
      if (p.off) return;
      (build(types, p.kind, p.lines.map(function (l) { return { stat: l.stat, value: l.value }; })) || []).forEach(function (c) {
        if (seen[c.id]) return;
        seen[c.id] = 1; out.push(c);
      });
    });
    return out.length ? out : [NONE];
  };

  // 목록 화면 (React 요소를 직접 만듦: N = jsx 런타임)
  window.__dvPLView = function (N, list, setList, types, enabled, touch) {
    var h = function (tag, props, kids) {
      props = props || {};
      if (kids !== undefined) props.children = kids;
      return Array.isArray(kids) ? N.jsxs(tag, props) : N.jsx(tag, props);
    };
    var update = function (next) { setList(next); if (typeof touch === "function") touch(); };
    var change = function (i, fn) { update(list.map(function (p, k) { return k === i ? fn({ kind: p.kind, lines: p.lines.map(function (l) { return { stat: l.stat, value: l.value }; }), off: p.off }) : p; })); };
    var used = list.filter(function (p) { return !p.off; }).length;
    var kinds = (types && types.length ? types : [{ id: "generic", name: "일반 펜던트" }, { id: "sun", name: "태양의 펜던트" }])
      .filter(function (t) { return t.id === "generic" || t.id === "sun"; });

    var rows = list.map(function (p, i) {
      var cells = [
        h("label", { className: "bo-dvpl-off", title: "체크하면 계산에서 뺍니다 (목록에는 남음)" }, [
          h("input", { type: "checkbox", checked: !!p.off, disabled: !enabled, "aria-label": (i + 1) + "번 펜던트 미사용",
            onChange: function (e) { var v = e.target.checked; change(i, function (q) { q.off = v; return q; }); } }),
          h("span", null, "미사용")
        ]),
        h("span", { className: "bo-dvpl-no" }, String(i + 1)),
        h("select", { className: "bo-dvpl-kind", value: p.kind, disabled: !enabled, "aria-label": (i + 1) + "번 펜던트 종류",
          onChange: function (e) { var v = e.target.value; change(i, function (q) { q.kind = v; q.lines = fixLines(v, q.lines); return q; }); } },
          kinds.map(function (t) { return h("option", { key: t.id, value: t.id }, t.id === "sun" ? "태양" : "일반"); }))
      ];
      cells.push(h("button", { key: "del", type: "button", className: "bo-dvpl-del", disabled: !enabled, "aria-label": (i + 1) + "번 펜던트 지우기",
        onClick: function () { update(list.filter(function (_, k) { return k !== i; })); } }, "✕"));
      cells.push(h("div", { key: "lines", className: "bo-dvpl-lines n" + p.lines.length }, p.lines.map(function (l, li) {
        return h("div", { key: "l" + li, className: "bo-dvpl-line" }, [
          h("select", { key: "s", "data-stat": l.stat, value: l.stat, disabled: !enabled, "aria-label": (i + 1) + "번 " + (li + 1) + "옵션 능력치",
            onChange: function (e) { var v = e.target.value; change(i, function (q) { q.lines[li].stat = v; return q; }); } },
            STATS.map(function (st) { return h("option", { key: st[0], value: st[0] }, st[1]); })),
          h("select", { key: "v", value: l.value, disabled: !enabled, "aria-label": (i + 1) + "번 " + (li + 1) + "옵션 퍼센트",
            onChange: function (e) { var v = +e.target.value; change(i, function (q) { q.lines[li].value = v; return q; }); } },
            VALUES.map(function (v) { return h("option", { key: v, value: v }, v + "%"); }))
        ]);
      })));
      return h("div", { key: "p" + i, className: "bo-dvpl-row" + (p.off ? " is-off" : "") }, cells);
    });

    return h("div", { className: "bo-dvpl" }, [
      h("div", { key: "head", className: "bo-dvpl-head" }, [
        h("span", { key: "c" }, "펜던트 " + list.length + "개 · 사용 " + used + "개"),
        h("button", { key: "add", type: "button", className: "bo-dvpl-add", disabled: !enabled || list.length >= MAX,
          onClick: function () {
            var last = list[list.length - 1];
            var kind = last ? last.kind : "generic";
            update(list.concat([{ kind: kind, lines: fixLines(kind, last ? last.lines : null), off: false }]));
          } }, list.length >= MAX ? "최대 30개" : "+ 펜던트 추가")
      ]),
      h("div", { key: "rows", className: "bo-dvpl-list" }, rows.length ? rows : [h("p", { key: "e", className: "bo-dvpl-empty" }, "펜던트를 추가하세요. 없으면 펜던트 없이 계산합니다.")]),
      h("p", { key: "n", className: "bo-dvpl-note" }, used
        ? "체크 안 된 펜던트 " + used + "개를 모두 넣어 보고 가장 좋은 것을 고릅니다. 미사용을 체크하면 목록에는 남고 계산에서만 빠집니다."
        : "사용할 펜던트가 없어 펜던트 없이 계산합니다.")
    ]);
  };
})();
