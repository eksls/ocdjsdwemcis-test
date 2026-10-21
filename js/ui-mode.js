/*
 * 디자인 모드 스위치 (모든 페이지 <head> 에서 가장 먼저 불러옴)
 *  - "v2" (새 디자인, 기본값): <html class="ui-v2">, 모바일 viewport, css/ui-v2.css + js/ui-v2.js 로드
 *  - "v1" (이전 디자인): 아무것도 하지 않음 → 예전 화면 그대로
 * 저장 키는 "guild_" 로 시작하지 않게 해서 [초기화] 버튼에 지워지지 않게 함.
 */
(function () {
  var KEY = "ui_design_mode";
  var mode = "v2";
  try { if (localStorage.getItem(KEY) === "v1") mode = "v1"; } catch (e) {}
  window.GUILD_UI = {
    key: KEY,
    mode: mode,
    set: function (m) { try { localStorage.setItem(KEY, m); } catch (e) {} }
  };
  if (mode !== "v2") return;

  var root = document.documentElement;
  root.classList.add("ui-v2");
  if (window.self !== window.top) root.classList.add("ui-v2-embedded");
  if (/pve\.html$/i.test(location.pathname)) root.classList.add("ui-v2-pve"); // 딜러/탱커: 자체 디자인 유지

  // 이 스크립트 위치 기준으로 css/js 경로 계산 (하위 폴더에서 열어도 동작)
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/js\/ui-mode\.js(\?.*)?$/, "") : "";

  if (!document.querySelector('meta[name="viewport"]')) {
    document.write('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  }
  document.write(
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">' +
    '<link rel="stylesheet" href="' + base + 'css/ui-v2.css?v=20261021b">' +
    '<script src="' + base + 'js/ui-v2.js?v=20261021b"><\/script>'
  );
})();
