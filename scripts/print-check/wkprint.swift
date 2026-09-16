import Cocoa
import WebKit
// usage: wkprint <url> <out.pdf> <js-to-run-after-load>
let args = CommandLine.arguments
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
class D: NSObject, WKNavigationDelegate {
  let web: WKWebView; let win: NSWindow; let out: String; let js: String; var printed=false; var ran=false
  init(url: URL, out: String, js: String) {
    let cfg = WKWebViewConfiguration()
    web = WKWebView(frame: NSRect(x:0,y:0,width:980,height:1200), configuration: cfg)
    win = NSWindow(contentRect: NSRect(x:0,y:0,width:980,height:1200), styleMask: [.titled], backing: .buffered, defer: false)
    self.out=out; self.js=js
    super.init()
    win.contentView = web
    web.navigationDelegate = self
    web.load(URLRequest(url: url))
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    if ran { return }; ran = true
    DispatchQueue.main.asyncAfter(deadline: .now()+4) {
      self.web.callAsyncJavaScript(self.js, arguments: [:], in: nil, in: .page) { r in
        switch r { case .success(let v): print("js ok", v ?? "nil"); case .failure(let e): print("js err", e) }
        DispatchQueue.main.asyncAfter(deadline: .now()+2) { self.doPrint() }
      }
    }
  }
  func doPrint() {
    printed=true
    let info = NSPrintInfo()
    info.paperSize = NSSize(width: 595.28, height: 841.89)
    info.topMargin = 0; info.bottomMargin = 0; info.leftMargin = 0; info.rightMargin = 0
    info.horizontalPagination = .fit; info.verticalPagination = .automatic
    info.jobDisposition = .save
    info.dictionary()[NSPrintInfo.AttributeKey.jobSavingURL] = URL(fileURLWithPath: out)
    let op = web.printOperation(with: info)
    op.showsPrintPanel = false; op.showsProgressPanel = false
    op.view?.frame = web.bounds
    op.runModal(for: win, delegate: self, didRun: #selector(done(_:success:contextInfo:)), contextInfo: nil)
  }
  @objc func done(_ op: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) { print("printed", success); exit(0) }
}
let d = D(url: URL(string: args[1])!, out: args[2], js: args[3])
DispatchQueue.main.asyncAfter(deadline: .now()+120) { print("timeout"); exit(1) }
app.run()
