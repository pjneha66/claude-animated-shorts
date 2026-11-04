// Local Apple Vision assertion. Run on original frames, never only thumbnails.
import Foundation
import Vision
import AppKit
var findings: [[String: Any]] = []
for file in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: file)
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  do {
    try VNImageRequestHandler(url: url, options: [:]).perform([request])
    for observation in request.results ?? [] {
      if let text = observation.topCandidates(1).first, text.confidence >= 0.3 {
        findings.append(["file": file, "text": text.string, "confidence": text.confidence])
      }
    }
  } catch { fputs("OCR failed: \(file): \(error)\n", stderr); exit(2) }
}
let data = try JSONSerialization.data(withJSONObject: ["ok": findings.isEmpty, "findings": findings], options: [.prettyPrinted, .sortedKeys])
print(String(data: data, encoding: .utf8)!)
exit(findings.isEmpty ? 0 : 1)
