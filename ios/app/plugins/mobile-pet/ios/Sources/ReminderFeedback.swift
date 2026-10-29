import AVFoundation
import CryptoKit
import UIKit

final class ReminderFeedback {
  private var player: AVAudioPlayer?
  private var pulses: [DispatchWorkItem] = []
  let directory: URL
  init() {
    directory = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0].appendingPathComponent("Sounds")
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }
  func importWave(_ encoded: String) throws -> String {
    guard encoded.count <= 1_500_000, let bytes = Data(base64Encoded: encoded), Self.validWave(bytes) else {
      throw NSError(domain: "Reminder", code: 1, userInfo: [NSLocalizedDescriptionKey: "请选择 15 秒以内的音频"])
    }
    let tone = "custom-" + SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    try bytes.write(to: directory.appendingPathComponent(tone + ".wav"), options: .atomic)
    return tone
  }
  static func validWave(_ data: Data) -> Bool {
    let b = [UInt8](data)
    guard b.count >= 46 && b.count <= 44 + 16000 * 15 * 2 else { return false }
    func word(_ i: Int, _ n: Int) -> UInt32 { (0..<n).reduce(0) { $0 | (UInt32(b[i + $1]) << ($1 * 8)) } }
    return String(bytes: b[0..<4], encoding: .ascii) == "RIFF" && String(bytes: b[8..<12], encoding: .ascii) == "WAVE"
      && String(bytes: b[12..<16], encoding: .ascii) == "fmt " && String(bytes: b[36..<40], encoding: .ascii) == "data"
      && word(4, 4) == UInt32(b.count - 8) && word(16, 4) == 16 && word(20, 2) == 1 && word(22, 2) == 1
      && word(24, 4) == 16000 && word(28, 4) == 32000 && word(32, 2) == 2 && word(34, 2) == 16
      && word(40, 4) == UInt32(b.count - 44) && (b.count - 44) % 2 == 0
  }
  func soundFile(_ style: ReminderStyle) throws -> URL {
    let builtin = ["gentle", "chime", "three"].contains(style.tone)
    let custom = style.tone.range(of: "^custom-[a-f0-9]{64}$", options: .regularExpression) != nil
    guard builtin || custom else { throw NSError(domain: "Reminder", code: 2, userInfo: [NSLocalizedDescriptionKey: "铃声不存在，请重新选择"] ) }
    let url = directory.appendingPathComponent("\(style.tone)-\(style.soundSeconds)s.wav")
    if FileManager.default.fileExists(atPath: url.path) { return url }
    var bytes: Data
    if builtin { bytes = Self.builtinWave(style.tone, seconds: style.soundSeconds) }
    else {
      bytes = try Data(contentsOf: directory.appendingPathComponent(style.tone + ".wav"))
      guard Self.validWave(bytes) else { throw NSError(domain: "Reminder", code: 3) }
      bytes = Data(bytes.prefix(44 + style.soundSeconds * 16000 * 2))
      Self.put(UInt32(bytes.count - 8), at: 4, into: &bytes)
      Self.put(UInt32(bytes.count - 44), at: 40, into: &bytes)
    }
    try bytes.write(to: url, options: .atomic)
    return url
  }
  private static func put(_ number: UInt32, at offset: Int, into bytes: inout Data) {
    for i in 0..<4 { bytes[offset + i] = UInt8((number >> (i * 8)) & 255) }
  }
  private static func builtinWave(_ tone: String, seconds: Int) -> Data {
    let notes: [Double] = tone == "chime" ? [880, 1320] : tone == "three" ? [660, 784, 988] : [784]
    var bytes = Data("RIFF".utf8) + Data(repeating: 0, count: 4) + Data("WAVEfmt ".utf8)
    bytes += Data([16,0,0,0,1,0,1,0,128,62,0,0,0,125,0,0,2,0,16,0]) + Data("data".utf8) + Data(repeating: 0, count: 4)
    for i in 0..<(16000 * seconds) {
      let time = Double(i) / 16000, cycle = time.truncatingRemainder(dividingBy: 2)
      var value = 0.0
      for (index, note) in notes.enumerated() {
        let local = cycle - Double(index) * 0.32
        if local >= 0 && local < 0.8 { value += sin(local * note * 2 * .pi) * exp(-local * 7) * 0.16 }
      }
      let sample = UInt16(bitPattern: Int16(max(-1, min(1, value)) * 32767))
      bytes.append(UInt8(sample & 255)); bytes.append(UInt8(sample >> 8))
    }
    put(UInt32(bytes.count - 8), at: 4, into: &bytes); put(UInt32(bytes.count - 44), at: 40, into: &bytes)
    return bytes
  }
  func stop() { player?.stop(); player = nil; pulses.forEach { $0.cancel() }; pulses.removeAll() }
  func play(_ style: ReminderStyle) throws {
    stop()
    if style.sound {
      try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
      player = try AVAudioPlayer(contentsOf: soundFile(style)); player?.prepareToPlay()
      guard player?.play() == true else { throw NSError(domain: "Reminder", code: 4, userInfo: [NSLocalizedDescriptionKey: "声音暂时无法播放"] ) }
    }
    if style.vibration {
      let offsets = style.rhythm == "single" ? [0.0] : style.rhythm == "slow" ? [0.0, 0.36, 0.72] : [0.0, 0.23]
      for cycle in stride(from: 0.0, to: Double(style.vibrationSeconds), by: 1.5) {
        for offset in offsets where cycle + offset < Double(style.vibrationSeconds) {
          let item = DispatchWorkItem {
            if UIApplication.shared.applicationState == .active { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
          }
          pulses.append(item); DispatchQueue.main.asyncAfter(deadline: .now() + cycle + offset, execute: item)
        }
      }
    }
  }
}
