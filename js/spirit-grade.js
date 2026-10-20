/*
 * 정령 이름 붙이기 (정령 계산기 · 길드전 계산기 결과창에서 같이 사용)
 * 슬롯 1~4 순서의 종류(% / +)와 스탯(체/공/방)으로 판정. 해당 없으면 "" (표시 안 함)
 *
 *  %%%+  막플   ─ 1~3번이 체/공/방 하나씩            → 극막
 *                ─ 스탯 2종류가 2개씩 (예: 체체공공)  → 고점막
 *                ─ 4번 스탯이 1~3번에 없음            → 단막
 *  +%%+  유막
 *  %%%%  올퍼   ─ 체/공/방 이 모두 있음               → 밸퍼
 *  %+%+, %%++   유유막
 */
(function (root) {
  "use strict";
  var STATS = { "체": 1, "공": 1, "방": 1 };

  function spiritGrade(stats, types) {
    if (!stats || !types) return "";
    var S = [], T = "";
    for (var i = 0; i < 4; i++) {
      var s = stats[i], t = types[i];
      if (!STATS[s] || (t !== "%" && t !== "+")) return ""; // 빈 칸("옵")이 있으면 판정 안 함
      S.push(s); T += t;
    }
    var count = {};
    S.forEach(function (s) { count[s] = (count[s] || 0) + 1; });
    var kinds = Object.keys(count).length;
    var first3 = S.slice(0, 3);

    if (T === "%%%+") {
      if (first3[0] !== first3[1] && first3[1] !== first3[2] && first3[0] !== first3[2]) return "극막";
      if (kinds === 2 && Object.keys(count).every(function (k) { return count[k] === 2; })) return "고점막";
      if (first3.indexOf(S[3]) < 0) return "단막";
      return "막플";
    }
    if (T === "+%%+") return "유막";
    if (T === "%%%%") return kinds === 3 ? "밸퍼" : "올퍼";
    if (T === "%+%+" || T === "%%++") return "유유막";
    return "";
  }

  // "체% 공% 방% 체+ 부:공" 같은 정령 글자에서 판정
  function spiritGradeFromLabel(label) {
    var toks = String(label || "").trim().split(/\s+/).slice(0, 4);
    var stats = [], types = [];
    for (var i = 0; i < toks.length; i++) {
      var m = /^(체|공|방)([%+])$/.exec(toks[i]);
      if (!m) return "";
      stats.push(m[1]); types.push(m[2]);
    }
    return spiritGrade(stats, types);
  }

  root.spiritGrade = spiritGrade;
  root.spiritGradeFromLabel = spiritGradeFromLabel;
  if (typeof module !== "undefined" && module.exports) module.exports = { spiritGrade: spiritGrade, spiritGradeFromLabel: spiritGradeFromLabel };
})(typeof window !== "undefined" ? window : globalThis);
