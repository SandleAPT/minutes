  window.GA_MEASUREMENT_ID = "G-MH479X0GSE"; // GA4 속성 "산들마을 회의록" 웹 스트림 (CommunityNotice의 G-GGDNLH6MCQ와 별도)
  (function () {
    var id = window.GA_MEASUREMENT_ID;
    if (!id) return;
    var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date());
    var admin = false; try { admin = !!localStorage.getItem("sandle_admin_key"); } catch (e) {}
    gtag("set", "user_properties", { app_role: admin ? "admin" : "viewer" }); // 관리자 기기 조회는 탐색에서 분리해 볼 수 있게
    gtag("config", id, { send_page_view: true });
  })();
  // 앱 내부 이벤트 전송(탭 이동·주제 선택·회의록 열기·내보내기). GA 미설정이면 무시.
  window.track = function (name, params) { try { if (window.gtag && window.GA_MEASUREMENT_ID) gtag("event", name, params || {}); } catch (e) {} };
