import {
  dbError,
  failure,
  isConfigured,
  response,
  serverSupabase,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isConfigured()) return response({ configured: false, members: [] });
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") || "").trim().slice(0, 100);
    const city = (url.searchParams.get("city") || "").trim().slice(0, 100);
    const specialty = (url.searchParams.get("specialty") || "")
      .trim()
      .slice(0, 100);
    const supabase = await serverSupabase();
    let requestQuery = supabase
      .from("member_directory")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (city && city !== "All cities")
      requestQuery = requestQuery.eq("city", city);
    if (specialty && specialty !== "All specialties")
      requestQuery = requestQuery.contains("specialties", [specialty]);
    // Avoid interpolating user-controlled text into PostgREST's expression grammar.
    if (query)
      requestQuery = requestQuery.ilike(
        "full_name",
        `%${query.replace(/[\\%_]/g, "\\$&")}%`,
      );
    const { data, error } = await requestQuery;
    dbError(error);
    return response({ configured: true, members: data || [] });
  } catch (error) {
    return failure(error);
  }
}
