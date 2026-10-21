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

  // 좋은 순서: 극막 > 고점막 > 막플 > 단막 > 유막 > 밸퍼 > (올퍼) > 유유막
  // 게임 등급색처럼 좋을수록 진하고 화려하게: 금 → 보라 → 파랑 → 청록 → 회청 → 연회색
  var GRADE_ORDER = ["극막", "고점막", "막플", "단막", "유막", "밸퍼", "올퍼", "유유막"];
  var GRADE_COLORS = {
    "극막":   { bg: "#f5a524", fg: "#3b2500", bd: "#d98a00" },
    "고점막": { bg: "#7c3aed", fg: "#ffffff", bd: "#6a2bd6" },
    "막플":   { bg: "#2563eb", fg: "#ffffff", bd: "#1d4fc4" },
    "단막":   { bg: "#0f8f86", fg: "#ffffff", bd: "#0b7770" },
    "유막":   { bg: "#64748b", fg: "#ffffff", bd: "#55637a" },
    "밸퍼":   { bg: "#cfd8e3", fg: "#1e293b", bd: "#b4c0cf" },
    "올퍼":   { bg: "#e6ebf1", fg: "#475569", bd: "#cdd5df" },
    "유유막": { bg: "#f4f6f9", fg: "#7a8597", bd: "#dde2ea" }
  };
  // 작은 표시(span) HTML. prefix 는 앞에 붙일 글자(예: "입력 정령: ")
  function spiritGradeTag(grade, opts) {
    var c = GRADE_COLORS[grade];
    if (!c) return "";
    opts = opts || {};
    var size = opts.size || 11;
    return ' <span class="sp-grade" data-grade="' + grade + '" data-rank="' + (GRADE_ORDER.indexOf(grade) + 1) + '" style="' +
      "display:inline-block; font-size:" + size + "px; font-weight:bold; line-height:1.5; padding:0 " + Math.round(size * 0.55) + "px;" +
      "color:" + c.fg + "; background:" + c.bg + "; border:1px solid " + c.bd + "; border-radius:999px; white-space:nowrap; vertical-align:1px;" +
      '">' + (opts.prefix || "") + grade + "</span>";
  }

  root.spiritGrade = spiritGrade;
  root.spiritGradeTag = spiritGradeTag;
  root.SPIRIT_GRADE_ORDER = GRADE_ORDER;
  root.spiritGradeFromLabel = spiritGradeFromLabel;
  if (typeof module !== "undefined" && module.exports) module.exports = { spiritGrade: spiritGrade, spiritGradeFromLabel: spiritGradeFromLabel, spiritGradeTag: spiritGradeTag, SPIRIT_GRADE_ORDER: GRADE_ORDER };
})(typeof window !== "undefined" ? window : globalThis);
