/*
 * 새 디자인(v2) 전용 동작. ui-mode.js 가 v2 일 때만 불러옴.
 *  1) 탭 안 페이지(iframe) 높이를 내용에 맞춰 늘려서, 화면 전체가 한 번에 스크롤되게 함
 *     (휴대폰에서 iframe 안쪽만 따로 스크롤되던 문제 해결)
 *  2) 상단바: 휴대폰에서 저장/불러오기/초기화를 ⋯ 메뉴로 접기
 *  3) 용/정령 페이지: 속성별 접기/펼치기 + 등록된 용 수 표시
 */
(function () {
  "use strict";
  var embedded = window.self !== window.top;
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  // 페이지 자체 스크립트의 DOMContentLoaded 작업(저장값 불러오기)이 끝난 뒤 실행
  function afterPageLoad(fn) {
    var done = false;
    function run() { if (!done) { done = true; setTimeout(fn, 0); } }
    if (document.readyState === "complete") run();
    else { document.addEventListener("DOMContentLoaded", run); window.addEventListener("load", run); }
  }

  // ---------- 탭 안 페이지: 높이 알리기 ----------
  function contentHeight() {
    var b = document.body;
    if (!b) return 0;
    // body 자체 높이 대신 자식 요소들의 실제 끝 위치를 잼 (구형 페이지의 quirks 모드에서도 줄어들 수 있게)
    var max = 0;
    for (var i = 0; i < b.children.length; i++) {
      var el = b.children[i];
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.position === "fixed" || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      var r = el.getBoundingClientRect();
      max = Math.max(max, r.bottom + (parseFloat(cs.marginBottom) || 0));
    }
    var bs = getComputedStyle(b);
    return Math.ceil(max + window.scrollY + (parseFloat(bs.paddingBottom) || 0) + (parseFloat(bs.marginBottom) || 0));
  }
  var lastSent = -1;
  function postHeight() {
    var h = contentHeight();
    if (h && Math.abs(h - lastSent) > 1) {
      lastSent = h;
      try { window.parent.postMessage({ type: "guild-ui-height", h: h }, "*"); } catch (e) {}
    }
  }
  // 부모 화면을 이 페이지의 특정 요소 위치로 스크롤
  function scrollParentTo(el) {
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY;
    if (embedded) {
      postHeight(); // 새 결과로 길어진 높이를 먼저 알려야 끝까지 스크롤됨
      try { window.parent.postMessage({ type: "guild-ui-scroll", y: y }, "*"); } catch (e) {}
    } else {
      window.scrollTo({ top: Math.max(0, y - 12), behavior: "smooth" });
    }
  }
  window.GUILD_UI_V2 = { scrollTo: scrollParentTo, refreshHeight: postHeight };

  if (embedded) {
    ready(function () {
      postHeight();
      if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
      window.addEventListener("load", postHeight);
      // 글꼴이 늦게 적용돼 높이가 바뀌는 경우
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(postHeight);
      setInterval(postHeight, 1500); // 안전장치 (ResizeObserver 미지원 브라우저)
    });
  }

  // ---------- 바깥 화면(index.html) ----------
  if (!embedded && (page === "index.html" || page === "")) {
    ready(function () {
      var iframe = document.getElementById("view");
      var bar = document.querySelector(".tabs");
      if (!iframe || !bar) return;

      function barH() { return bar.getBoundingClientRect().height; }
      function resetFrame() {
        iframe.style.height = Math.max(320, window.innerHeight - barH()) + "px";
      }
      resetFrame();

      window.addEventListener("message", function (e) {
        var d = e.data || {};
        if (e.source !== iframe.contentWindow) return;
        if (d.type === "guild-ui-height" && d.h > 0) iframe.style.height = d.h + "px";
        if (d.type === "guild-ui-scroll") {
          requestAnimationFrame(function () {
            var top = iframe.getBoundingClientRect().top + window.scrollY + d.y - barH() - 8;
            window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          });
        }
      });

      // 탭 바꾸면: 높이 초기화 + 맨 위로 + 선택한 탭이 보이게
      document.querySelectorAll(".tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          resetFrame();
          window.scrollTo(0, 0);
          if (tab.scrollIntoView) tab.scrollIntoView({ block: "nearest", inline: "center" });
        });
      });

      // 휴대폰 ⋯ 메뉴
      var more = document.getElementById("more-btn");
      if (more) {
        more.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var open = bar.classList.toggle("menu-open");
          more.setAttribute("aria-expanded", open ? "true" : "false");
        });
        document.addEventListener("click", function (ev) {
          if (!bar.contains(ev.target)) { bar.classList.remove("menu-open"); more.setAttribute("aria-expanded", "false"); }
        });
        bar.querySelectorAll(".data-actions button").forEach(function (b) {
          b.addEventListener("click", function () { bar.classList.remove("menu-open"); });
        });
      }
    });
  }

  // ---------- 정령 계산기: 결과 30개씩 보여주기, 하위 목록은 눌러서 열기 ----------
  if (page === "spirit-calc.html") {
    ready(function () {
      var area = document.querySelector(".result-area");
      if (!area) return;
      var STEP = 30;
      function page(tbody, wrapper) {
        var rows = Array.prototype.slice.call(tbody.rows);
        var shown = Math.min(STEP, rows.length);
        rows.forEach(function (r, i) { r.classList.toggle("v2-more-hidden", i >= shown); });
        if (rows.length <= shown) return;
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "v2-more";
        function label() { btn.textContent = "더 보기 (" + shown + " / " + rows.length + ")"; }
        label();
        btn.onclick = function () {
          var next = Math.min(rows.length, shown + STEP);
          for (var i = shown; i < next; i++) rows[i].classList.remove("v2-more-hidden");
          shown = next;
          if (shown >= rows.length) btn.remove(); else label();
        };
        wrapper.after(btn);
      }
      function enhance() {
        if (area.dataset.v2Done === "1" || !area.querySelector("tbody tr")) return;
        area.dataset.v2Done = "1";
        area.querySelectorAll(".table-wrapper").forEach(function (w) {
          var tb = w.querySelector("tbody"); if (tb) page(tb, w);
        });
        var bottomH = area.querySelector(".res-h-bottom");
        if (bottomH) {
          area.classList.add("v2-bottom-closed");
          var t = document.createElement("button");
          t.type = "button"; t.className = "v2-more v2-fold-bottom";
          t.textContent = bottomH.textContent.trim() + " 보기";
          t.onclick = function () {
            var closed = area.classList.toggle("v2-bottom-closed");
            t.textContent = bottomH.textContent.trim() + (closed ? " 보기" : " 접기");
          };
          bottomH.before(t);
        }
      }
      // 계산할 때마다 결과 영역을 새로 그리므로 매번 다시 적용
      new MutationObserver(function () {
        if (!area.querySelector(".v2-more, .v2-fold-bottom")) area.dataset.v2Done = "";
        enhance();
      }).observe(area, { childList: true });
      enhance();
    });
  }

  // ---------- 용/정령 페이지: 속성 접기 + 마리 수 ----------
  if (page === "dragon.html") {
    afterPageLoad(function () {
      var STORE = "ui_dragon_collapsed";
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) {}
      var state = saved || {};

      document.querySelectorAll("#container .attr").forEach(function (attr) {
        var key = attr.dataset.key;
        var header = attr.querySelector(".header");
        var title = header && header.querySelector("strong");
        if (!header || !title) return;

        var count = document.createElement("span");
        count.className = "attr-count";
        title.after(count);

        var chev = document.createElement("button");
        chev.type = "button";
        chev.className = "attr-fold";
        chev.setAttribute("aria-label", title.textContent + " 접기/펼치기");
        header.insertBefore(chev, header.firstChild);

        function named() {
          return Array.prototype.filter.call(attr.querySelectorAll(".dragon-name"), function (i) { return i.value.trim(); }).length;
        }
        function slots() { return attr.querySelectorAll(".slot").length; }
        function update() {
          var n = named();
          count.textContent = n ? n + "마리" : (slots() > 1 ? "빈 칸 " + slots() : "비어 있음");
          count.classList.toggle("is-empty", !n);
        }
        function setCollapsed(c, persist) {
          attr.classList.toggle("is-collapsed", c);
          chev.setAttribute("aria-expanded", c ? "false" : "true");
          if (persist) { state[key] = c; try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }
        }
        // 기본: 저장된 상태, 없으면 용이 등록된 속성만 펼침
        setCollapsed(key in state ? !!state[key] : named() === 0, false);
        update();

        function toggle() { setCollapsed(!attr.classList.contains("is-collapsed"), true); }
        chev.addEventListener("click", toggle);
        title.addEventListener("click", toggle);
        count.addEventListener("click", toggle);
        attr.addEventListener("input", update);
        attr.addEventListener("click", function (e) {
          if (e.target.tagName === "BUTTON" && e.target !== chev) {
            setTimeout(update, 0);
            // 칸 추가를 누르면 접혀 있어도 펼쳐서 보여줌
            if (/추가/.test(e.target.textContent)) setCollapsed(false, true);
          }
        });
      });
    });
  }
})();
