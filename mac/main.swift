// content.md — ⌃⌥ を押して離すと、選んでいる文を iMessage で content.md の番号に送る。
// 1. 選んでいる文を読む（アクセシビリティで直接。読めないアプリだけ ⌘C でコピーしてクリップボードを戻す） 2. iMessage で送る
// 要る許可：アクセシビリティ（キーを見る・⌘C を送る）、オートメーション（メッセージ）。どちらもこのアプリに1回だけ。
import AppKit
import ApplicationServices

let TO = "+14156106180"   // content.md の番号（Photon の共有番号）

func log(_ s: String) {
    let line = "\(ISO8601DateFormatter().string(from: Date())) \(s)\n"
    let url = URL(fileURLWithPath: NSHomeDirectory() + "/Library/Logs/content-md.log")
    if let h = try? FileHandle(forWritingTo: url) { h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); h.closeFile() }
    else { try? line.write(to: url, atomically: true, encoding: .utf8) }
}

// iMessage を名指しして送る（Mac はこの番号を SMS で送ろうとするため）
func send(_ text: String) -> Bool {
    let q = text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    let src = "tell application \"Messages\" to send \"\(q)\" to participant \"\(TO)\" of (1st account whose service type = iMessage)"
    var err: NSDictionary?
    NSAppleScript(source: src)?.executeAndReturnError(&err)
    if let err { log("send error \(err)"); return false }
    return true
}

// クリップボードの中身を全部とっておき、あとで戻す
func snapshot() -> [[NSPasteboard.PasteboardType: Data]] {
    (NSPasteboard.general.pasteboardItems ?? []).map { item in
        var d: [NSPasteboard.PasteboardType: Data] = [:]
        for t in item.types { if let v = item.data(forType: t) { d[t] = v } }
        return d
    }
}
func restore(_ snap: [[NSPasteboard.PasteboardType: Data]]) {
    let pb = NSPasteboard.general
    pb.clearContents()
    let items = snap.map { d -> NSPasteboardItem in
        let it = NSPasteboardItem(); for (t, v) in d { it.setData(v, forType: t) }; return it
    }
    if !items.isEmpty { pb.writeObjects(items) }
}

// 選んでいる文を、キーを押さずにアクセシビリティで直接読む（入力の言葉・クリップボードに関係しない）。
// Chrome などは、こちらから頼まないと中身を見せないので、先に AXManualAccessibility を立てる。
func selectedTextByAX() -> String? {
    let sys = AXUIElementCreateSystemWide()
    var app: CFTypeRef?
    if AXUIElementCopyAttributeValue(sys, kAXFocusedApplicationAttribute as CFString, &app) == .success, let a = app {
        AXUIElementSetAttributeValue(a as! AXUIElement, "AXManualAccessibility" as CFString, kCFBooleanTrue)
    }
    var el: CFTypeRef?
    guard AXUIElementCopyAttributeValue(sys, kAXFocusedUIElementAttribute as CFString, &el) == .success, let e = el else { return nil }
    var v: CFTypeRef?
    guard AXUIElementCopyAttributeValue(e as! AXUIElement, kAXSelectedTextAttribute as CFString, &v) == .success, let t = v as? String else { return nil }
    return t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : t
}

// 読めない時だけ ⌘C。字の情報（c）も付けて、日本語入力の時でもコピーとして届くようにする。
func pressCopy() {
    let src = CGEventSource(stateID: .hidSystemState)
    for down in [true, false] {
        let e = CGEvent(keyboardEventSource: src, virtualKey: 8, keyDown: down)   // 8 = C
        e?.flags = .maskCommand
        var c: UniChar = 0x63
        e?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c)
        e?.post(tap: .cghidEventTap)
    }
}

func deliver(_ text: String, _ how: String) {
    if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { log("empty (\(how))"); return }
    log(send(text) ? "sent len=\(text.count) via \(how)" : "failed")
}

func fire() {
    let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "?"
    if let t = selectedTextByAX() { deliver(t, "ax \(front)"); return }
    let pb = NSPasteboard.general
    let snap = snapshot()
    let before = pb.changeCount
    pressCopy()
    var waited = 0.0
    func check() {
        if pb.changeCount != before {
            let text = pb.string(forType: .string) ?? ""
            restore(snap)
            deliver(text, "copy \(front)")
        } else if waited < 1.0 {
            waited += 0.03; DispatchQueue.main.asyncAfter(deadline: .now() + 0.03, execute: check)
        } else { log("nothing selected in \(front)") }
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.03, execute: check)
}

// ⌃⌥ だけを押して離したら送る。ほかのキーや修飾キーが混ざったら送らない。
var armed = false, spoiled = false, armedAt = Date()
let both: NSEvent.ModifierFlags = [.control, .option]
let watched: NSEvent.ModifierFlags = [.control, .option, .command, .shift, .function, .capsLock]

let args = CommandLine.arguments
if args.count > 2 && args[1] == "--send" { exit(send(args[2]) ? 0 : 1) }   // 試し用

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)   // Dock にもメニューにも出ない。フォーカスも取らない
let trusted = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
log("start trusted=\(trusted)")
// 許可がまだなら、オンになるのを待って起動し直す（キーを見る仕組みは許可の後でないと動かないため）。launchd がすぐ起動し直す。
if !trusted {
    Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in if AXIsProcessTrusted() { log("trusted, restarting"); exit(0) } }
}

NSEvent.addGlobalMonitorForEvents(matching: [.flagsChanged, .keyDown]) { e in
    if e.type == .keyDown { spoiled = true; return }
    let f = e.modifierFlags.intersection(watched)
    if f == both { if !armed { armed = true; spoiled = false; armedAt = Date() } }
    else if f.isEmpty {
        if armed && !spoiled && Date().timeIntervalSince(armedAt) < 1.0 { fire() }   // 長押しは送らない
        armed = false; spoiled = false
    }
    else if !f.isSubset(of: both) { spoiled = true }
}
NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown, .scrollWheel]) { _ in spoiled = true }
app.run()
