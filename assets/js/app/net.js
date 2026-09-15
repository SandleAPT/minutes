// ── 클라우드(Apps Script) 요청 공통 계층 ─────────────────────────────────────
// 왜 필요한가 (2026-09-16): 구글 Apps Script 웹앱(/exec)은 자체 오류와 무관하게
// 구글 쪽 배달 단계에서 실패할 때가 있다. 이날 확인한 실패 모습은 세 가지였다.
//   ① 302 로 넘어간 뒤 응답이 영영 오지 않음 → 앱이 "불러오는 중…"에서 멈춤
//   ② script.googleusercontent.com 이 404(드라이브 "페이지를 찾을 수 없음") HTML 을 돌려줌
//      → r.json() 이 터져 "저장 오류"처럼 보임
//   ③ 아주 가끔 성공
// 시트에 손도 대지 않는 action=ping 도 똑같이 실패했으므로 우리 코드·시트 크기 문제가 아니다.
// 그래서 여기서 ⑴ 제한시간을 두고 ⑵ 몇 번 다시 시도한다. 사람 손으로 다시 누르는 일을
// 코드가 대신하는 것뿐이라, 구글이 정상일 때는 동작이 예전과 똑같다.
//
// 재시도가 안전한 이유: 이 백엔드의 쓰기 동작은 모두 같은 요청을 두 번 보내도 결과가 같다.
//   save   = 같은 id 행을 덮어씀      delete = 없으면 deleted:false
//   setTags= 같은 태그를 다시 씀       verify = 읽기만 함
window.GasNet = (function () {
  "use strict";
  var TIMEOUT = 13000;   // 한 번의 시도를 기다리는 시간
  var TRIES = 4;         // 첫 시도 포함 횟수
  var WAITS = [500, 1200, 2500];

  function attempt(url, opts) {
    var ac = (typeof AbortController === "function") ? new AbortController() : null;
    var timer = null;
    var o = { cache: "no-store" };
    for (var k in (opts || {})) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    if (ac) o.signal = ac.signal;
    var p = new Promise(function (resolve, reject) {
      timer = setTimeout(function () { if (ac) ac.abort(); reject(new Error("timeout")); }, TIMEOUT);
      fetch(url, o).then(function (r) {
        return r.text().then(function (txt) {
          if (!r.ok) throw new Error("http " + r.status);
          var j;
          try { j = JSON.parse(txt); } catch (e) { throw new Error("bad-reply"); } // 구글 오류 HTML
          return j;
        });
      }).then(resolve, reject);
    });
    return p.then(
      function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }

  function json(url, opts) {
    var n = 0;
    function run() {
      return attempt(url, opts).catch(function (e) {
        n++;
        if (n >= TRIES) { GasNet.lastError = e; throw e; }
        return new Promise(function (r) { setTimeout(r, WAITS[n - 1] || 2500); }).then(run);
      });
    }
    return run();
  }

  return { json: json, lastError: null, TIMEOUT: TIMEOUT, TRIES: TRIES };
})();
