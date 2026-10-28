"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1024; // px; plenty for the feed and for the AI
const MAX_BYTES = 5 * 1024 * 1024;

/** Shrinks a photo in the browser and re-encodes it as JPEG. */
export async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image."))), "image/jpeg", 0.85),
  );
  if (blob.size > MAX_BYTES) throw new Error("That image is too large, even after shrinking.");
  return blob;
}

/**
 * Uploads into the admin's own folder of the "photos" bucket (the bucket's
 * policy only allows that folder) and returns the storage path.
 */
export async function uploadPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient()
    .storage.from("photos")
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}
