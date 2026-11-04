// Downsize a photo in the browser before sending it to Muse: at most 1280 px
// on the long side, JPEG. Keeps requests small and image token cost bounded.
const MAX_SIDE = 1280;
export async function photoToDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  if (file.size > 25_000_000)
    throw new Error("This photo is larger than 25 MB. Choose a smaller one.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
