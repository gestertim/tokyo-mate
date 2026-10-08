import { describe, expect, it } from 'vitest';
import { scaledOcrSize, validateOcrBlob } from './image-payload';
describe('D04 送出副本，不改原始裁切語意', () => {
  it('2048／2049與橫直比例，不放大原圖', () => {
    expect(scaledOcrSize(2048, 1024)).toEqual({ width: 2048, height: 1024 });
    expect(scaledOcrSize(2049, 1024)).toEqual({ width: 2048, height: 1024 });
    expect(scaledOcrSize(1000, 4000)).toEqual({ width: 512, height: 2048 });
    expect(scaledOcrSize(128, 32)).toEqual({ width: 128, height: 32 });
    expect(() => scaledOcrSize(0, 1)).toThrow();
  });
  it.each(['image/jpeg', 'image/png', 'image/webp'])('%s 3MiB／+1，不反覆降品質或靜默截斷', (type) => {
    expect(() => validateOcrBlob(new Blob([new Uint8Array(3145728)], { type }))).not.toThrow();
    expect(() => validateOcrBlob(new Blob([new Uint8Array(3145729)], { type }))).toThrow('原始照片仍保留');
  });
});
