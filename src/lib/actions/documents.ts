"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { registerDocumentSchema, type RegisterDocumentInput } from "@/lib/validation/travel";
import { reconcileDocumentStatus, revalidateTraveller } from "@/lib/actions/travellers";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/result";
import { BUCKETS, DOC_TYPES } from "@/lib/constants";

export type RegisteredDocument = {
  id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number | null;
  merge_order: number;
  uploaded_at: string | null;
  uploaded_by_name: string | null;
};

/**
 * Called after the browser has uploaded the file straight to the private
 * bucket. Converts HEIC to JPEG (keeping the original object), soft-deletes a
 * previous document in the same required slot, inserts the row and
 * auto-advances the traveller status.
 */
export async function registerDocument(
  travellerId: string,
  input: RegisterDocumentInput,
): Promise<ActionResult<{ document: RegisteredDocument; newStatus: string | null }>> {
  const profile = await requireProfile();
  const parsed = registerDocumentSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();

  const { data: traveller } = await supabase.from("travellers").select("id").eq("id", travellerId).maybeSingle();
  if (!traveller) return fail("Traveller not found");
  if (!parsed.data.storage_path.startsWith(`${travellerId}/`)) return fail("Invalid storage path");

  let { storage_path, mime_type, file_name, file_size } = parsed.data;

  // HEIC/HEIF -> JPEG so the file can be previewed and merged into the travel pack.
  if (mime_type === "image/heic" || mime_type === "image/heif") {
    try {
      const { data: blob, error: dlError } = await supabase.storage.from(BUCKETS.travellerDocuments).download(storage_path);
      if (dlError || !blob) throw dlError ?? new Error("Download failed");
      const convert = (await import("heic-convert")).default;
      const jpeg = Buffer.from(
        await convert({ buffer: new Uint8Array(await blob.arrayBuffer()), format: "JPEG", quality: 0.9 }),
      );
      const jpegPath = storage_path.replace(/\.(heic|heif)$/i, "") + ".jpg";
      const { error: upError } = await supabase.storage
        .from(BUCKETS.travellerDocuments)
        .upload(jpegPath, jpeg, { contentType: "image/jpeg", upsert: false });
      if (upError) throw upError;
      storage_path = jpegPath;
      mime_type = "image/jpeg";
      file_name = file_name.replace(/\.(heic|heif)$/i, "") + ".jpg";
      file_size = jpeg.byteLength;
    } catch (e) {
      return fail(`HEIC conversion failed: ${errorMessage(e)}`);
    }
  }

  const docType = DOC_TYPES.find((d) => d.value === parsed.data.doc_type)!;
  let mergeOrder = docType.mergeOrder;

  if (docType.required) {
    // Replace: soft-delete the previous document in this slot (audit trail kept).
    await supabase
      .from("traveller_documents")
      .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
      .eq("traveller_id", travellerId)
      .eq("doc_type", docType.value)
      .is("deleted_at", null);
  } else {
    const { count } = await supabase
      .from("traveller_documents")
      .select("id", { count: "exact", head: true })
      .eq("traveller_id", travellerId)
      .eq("doc_type", "other")
      .is("deleted_at", null);
    mergeOrder = docType.mergeOrder + (count ?? 0);
  }

  const { data: row, error } = await supabase
    .from("traveller_documents")
    .insert({
      traveller_id: travellerId,
      doc_type: docType.value,
      file_name,
      storage_path,
      mime_type,
      file_size,
      merge_order: mergeOrder,
      uploaded_by: profile.id,
    })
    .select("id, doc_type, file_name, storage_path, mime_type, file_size, merge_order, uploaded_at")
    .single();
  if (error || !row) return fail(errorMessage(error, "Could not save document"));

  const newStatus = await reconcileDocumentStatus(supabase, travellerId);
  await revalidateTraveller(travellerId);
  return ok({ document: { ...row, uploaded_by_name: profile.display_name }, newStatus });
}

export async function deleteDocument(docId: string): Promise<ActionResult<{ newStatus: string | null }>> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("traveller_documents").select("id, traveller_id").eq("id", docId).maybeSingle();
  if (!doc || !doc.traveller_id) return fail("Document not found");
  const { error } = await supabase
    .from("traveller_documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq("id", docId);
  if (error) return fail(errorMessage(error, "Could not remove document"));
  const newStatus = await reconcileDocumentStatus(supabase, doc.traveller_id);
  await revalidateTraveller(doc.traveller_id);
  return ok({ newStatus });
}

/** Short-lived signed URL for viewing or downloading one document. */
export async function getDocumentUrl(docId: string, download = false): Promise<ActionResult<{ url: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("traveller_documents").select("storage_path, file_name").eq("id", docId).maybeSingle();
  if (!doc) return fail("Document not found");
  const { data, error } = await supabase.storage
    .from(BUCKETS.travellerDocuments)
    .createSignedUrl(doc.storage_path, 300, download ? { download: doc.file_name } : undefined);
  if (error || !data) return fail("Could not create link");
  return ok({ url: data.signedUrl });
}
