/**
 * Every proof photo goes through here before upload (Today proof and feed Compose).
 * Drawing the decoded pixels onto a canvas and re-encoding them as JPEG drops EXIF,
 * GPS location and all other original metadata; the longest edge is capped at 1280px.
 */
export const PROOF_MAX_EDGE = 1280;
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Output size for a source image: never upscaled, longest edge at most PROOF_MAX_EDGE. */
export function proofSize(width: number, height: number) {
  const ratio = Math.min(1, PROOF_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function compressProof(file: File): Promise<Blob> {
  if (!PROOF_TYPES.includes(file.type) || file.size > 20 * 1024 * 1024)
    throw Error("invalid_image");
  const bitmap = await createImageBitmap(file);
  const size = proofSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw Error("invalid_image");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Re-encoding pixels drops EXIF, GPS and all original metadata.
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("invalid_image"))),
      "image/jpeg",
      0.84,
    ),
  );
}
