/* 4마리 계산을 화면과 따로 돌림 (계산 중에도 화면이 멈추지 않게) */
importScripts("dealer-survive-engine.js?v=20261028c", "dealer-team-engine.js?v=20261028e");
self.onmessage = function (e) {
  try { self.postMessage({ ok: true, res: self.DealerTeam.solve(e.data) }); }
  catch (err) { self.postMessage({ ok: false, error: String(err && err.message || err) }); }
};
