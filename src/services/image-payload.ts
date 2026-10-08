export const MAX_OCR_IMAGE_BYTES = 3145728;
export const MAX_OCR_IMAGE_EDGE = 2048;
export function scaledOcrSize(width: number, height: number): { width: number; height: number } {
  if (![width, height].every((v) => Number.isFinite(v) && v > 0))
    throw new Error('無法確認選取範圍，請重新選取。');
  const ratio = Math.min(1, MAX_OCR_IMAGE_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export function validateOcrBlob(blob: Blob): void {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size === 0)
    throw new Error('無法讀取選取影像，請重新選取範圍。');
  if (blob.size > MAX_OCR_IMAGE_BYTES)
    throw new Error('選取影像超過大小限制，請縮小文字範圍後再試；原始照片仍保留。');
}
