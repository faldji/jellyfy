/** Snap CSS sizes to a few pixel buckets so expo-image can reuse one file. */
export function imagePixelSize(cssSize: number): number {
  const px = Math.max(1, Math.round(cssSize));
  if (px <= 96) return 96;
  if (px <= 160) return 160;
  if (px <= 320) return 320;
  if (px <= 480) return 480;
  return 640;
}
