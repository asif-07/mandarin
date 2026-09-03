import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderInvoiceHtml } from "@/lib/pdf/invoice-template";
import { htmlToPdf } from "@/lib/pdf/browser";
import { loadTemplateAssets } from "@/lib/pdf/assets";
import { invoiceToTemplateData } from "@/lib/invoice/template-data";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/invoices/:id/pdf[?regenerate=1]
 * Generates the PDF on first request (or when regenerate=1), stores it in the
 * private `invoices` bucket, records the path, and redirects to a 60-second
 * signed download URL. Later requests reuse the stored file.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", id)
    .single();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const regenerate = request.nextUrl.searchParams.get("regenerate") === "1";
  let pdfPath = invoice.pdf_path;

  if (!pdfPath || regenerate) {
    try {
      const html = renderInvoiceHtml(invoiceToTemplateData(invoice, invoice.invoice_items), await loadTemplateAssets());
      const pdf = await htmlToPdf(html);
      const year = invoice.issue_date.slice(0, 4);
      pdfPath = `${year}/${invoice.invoice_number}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKETS.invoices)
        .upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;

      await supabase.from("invoices").update({ pdf_path: pdfPath }).eq("id", id);
    } catch (e) {
      console.error("invoice pdf generation failed", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "PDF generation failed" },
        { status: 500 },
      );
    }
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKETS.invoices)
    .createSignedUrl(pdfPath, 60, { download: `${invoice.invoice_number}.pdf` });
  if (signError || !signed) {
    return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
