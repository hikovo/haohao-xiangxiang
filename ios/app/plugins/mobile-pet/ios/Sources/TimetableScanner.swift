import Foundation
import Vision
import CoreGraphics
import ImageIO
import PDFKit
struct TimetableScanBlock: Codable { var text: String; var x: Double; var y: Double; var width: Double; var height: Double; var confidence: Float }
struct TimetableScanPage: Codable { var number: Int; var blocks: [TimetableScanBlock] }
struct TimetableScanResult: Codable { var pages: [TimetableScanPage] }
/// Vision runs on device. Original documents and OCR text are never uploaded or saved automatically.
enum TimetableScanner {
 static func scan(_ bytes:Data) throws -> TimetableScanResult {
  guard bytes.count <= 20_000_000 else { throw TimetableFailure(message:"文件太大啦，请选择 20 MB 以内的截图或 PDF") }
  var images: [(Int,CGImage)] = []; var pages: [TimetableScanPage] = []
  if bytes.starts(with:Data("%PDF".utf8)),let provider = CGDataProvider(data:bytes as CFData),let pdf = CGPDFDocument(provider) {
   guard pdf.numberOfPages <= 12 else { throw TimetableFailure(message:"一次最多识别 12 页，请选课程表所在的页") }
   let textPDF = PDFDocument(data:bytes)
   for i in 1...max(1,pdf.numberOfPages) {
    if let page = textPDF?.page(at:i-1),page.rotation == 0,let text = page.string,!text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty {
     let bounds = page.bounds(for:.mediaBox),ns = text as NSString
     let regex = try NSRegularExpression(pattern:"(?:周|星期)[一二三四五六日天]|\\S+")
     let blocks = regex.matches(in:text,range:NSRange(location:0,length:ns.length)).prefix(3000).compactMap { match -> TimetableScanBlock? in
      guard let selection = page.selection(for:match.range) else { return nil }; let r = selection.bounds(for:page)
      guard bounds.width > 0 && bounds.height > 0 && r.width > 0 && r.height > 0 else { return nil }
      return .init(text:ns.substring(with:match.range),x:(r.minX-bounds.minX)/bounds.width,y:1-(r.maxY-bounds.minY)/bounds.height,width:r.width/bounds.width,height:r.height/bounds.height,confidence:1)
     }
     if !blocks.isEmpty { pages.append(.init(number:i,blocks:blocks)); continue }
    }
    guard let page = pdf.page(at:i) else { continue }; let bounds = page.getBoxRect(.mediaBox); guard bounds.width > 0 && bounds.height > 0 else { continue }; let scale = min(max(bounds.width,bounds.height)>1000 ? 1 : 3,2600/max(bounds.width,bounds.height)); let w = Int(bounds.width*scale),h = Int(bounds.height*scale)
    guard let ctx = CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }; ctx.setFillColor(CGColor(gray:1,alpha:1)); ctx.fill(CGRect(x:0,y:0,width:w,height:h)); ctx.concatenate(page.getDrawingTransform(.mediaBox,rect:CGRect(x:0,y:0,width:w,height:h),rotate:0,preserveAspectRatio:true)); ctx.drawPDFPage(page); if let image = ctx.makeImage() { images.append((i,image)) }
   }
  } else if let source = CGImageSourceCreateWithData(bytes as CFData,nil),let image = CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:2800,kCGImageSourceCreateThumbnailWithTransform:true] as CFDictionary) { images.append((1,image)) }
  guard !images.isEmpty || !pages.isEmpty else { throw TimetableFailure(message:"这个文件暂时读不了，试试清晰的截图或普通 PDF") }
  for (i,image) in images {
   let request = VNRecognizeTextRequest(); request.recognitionLevel = .accurate; request.recognitionLanguages = ["zh-Hans","en-US"]; request.usesLanguageCorrection = false
   try VNImageRequestHandler(cgImage:image,options:[:]).perform([request]); let blocks = (request.results ?? []).prefix(3000).compactMap { item -> TimetableScanBlock? in guard let text = item.topCandidates(1).first else { return nil }; let r = item.boundingBox; return .init(text:text.string,x:r.minX,y:1-r.maxY,width:r.width,height:r.height,confidence:text.confidence) }; pages.append(.init(number:i,blocks:blocks))
  }
  return .init(pages:pages.sorted { $0.number < $1.number })
 }
}
