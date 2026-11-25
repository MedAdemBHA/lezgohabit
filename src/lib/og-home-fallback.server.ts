import imageDataUrl from "@/assets/images/og-home-fallback.png?inline";

let cachedImage: ArrayBuffer | undefined;

export function getOgHomeFallback(): ArrayBuffer {
  if (!cachedImage) {
    const comma = imageDataUrl.indexOf(",");
    if (comma < 0) throw new Error("invalid_og_fallback_asset");
    const binary = atob(imageDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    cachedImage = bytes.buffer;
  }
  return cachedImage;
}
