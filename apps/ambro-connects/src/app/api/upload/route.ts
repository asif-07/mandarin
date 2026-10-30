import { randomUUID } from "node:crypto";
import {
  ApiError,
  authenticated,
  checkMutation,
  dbError,
  failure,
  response,
} from "@/lib/supabase";

export const runtime = "nodejs";

function imageExtension(bytes: Uint8Array, type: string) {
  if (
    type === "image/jpeg" &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "jpg";
  if (
    type === "image/png" &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    )
  )
    return "png";
  if (
    type === "image/webp" &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "webp";
  throw new ApiError("Choose a valid JPEG, PNG or WebP image.");
}

export async function POST(request: Request) {
  try {
    checkMutation(request);
    if (Number(request.headers.get("content-length") || 0) > 4_300_000)
      throw new ApiError("Photos must be smaller than 4 MB.", 413);
    const { supabase, user } = await authenticated();
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!["avatar", "cover", "portfolio"].includes(String(kind)))
      throw new ApiError("Choose a valid photo type.");
    if (!(file instanceof File) || file.size === 0)
      throw new ApiError("Choose a photo to upload.");
    if (file.size > 4_194_304)
      throw new ApiError("Photos must be smaller than 4 MB.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = imageExtension(bytes, file.type);
    const path = `${user.id}/${kind}/${randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("member-media")
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    dbError(error);
    const { data } = supabase.storage.from("member-media").getPublicUrl(path);
    return response({ ok: true, url: data.publicUrl, path }, 201);
  } catch (error) {
    return failure(error);
  }
}
