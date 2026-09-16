# Safari(WebKit) 인쇄 확인

크롬에서는 멀쩡한데 Safari로 인쇄·PDF 저장하면 깨지는 경우가 있다(v428: `.formatted-text` grid 줄 겹침).
맥에서 WebKit 인쇄 결과를 그대로 만들어 눈으로 확인하는 도구. Xcode 명령줄 도구(swiftc)만 있으면 된다.

```bash
# 1) 저장소 상위 폴더에서 로컬 서버
cd ~/Project && python3 -m http.server 8765 --bind 127.0.0.1
# 2) 컴파일 (한 번)
swiftc -O scripts/print-check/wkprint.swift -o /tmp/wkprint
# 3) 앱을 열고 → 데이터 로드 대기 → 전체 인쇄 문서로 바꾼 뒤 → A4 PDF로 인쇄
/tmp/wkprint "http://localhost:8765/minutes/?wk=1" /tmp/out.pdf \
  'for(let i=0;i<40 && !(state.agendas||[]).some(a=>a.title);i++) await new Promise(r=>setTimeout(r,500)); const html=printableDocumentHtml(await buildPrintableContent(false)); document.open(); document.write(html); document.close(); return buildMeetingName();'
# 4) 쪽마다 PNG
mkdir -p /tmp/pages && swift scripts/print-check/render-pages.swift /tmp/out.pdf /tmp/pages
```

- 새 WKWebView 라 첨부 원본(IndexedDB)이 없다 → `buildPrintableContent(false)`(첨부 제외)로 찍는다.
- 회의 데이터는 클라우드에서 불러오므로 3)의 대기 루프가 필요하다.
