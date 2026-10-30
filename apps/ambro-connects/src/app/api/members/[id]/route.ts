import {
  ApiError,
  dbError,
  failure,
  response,
  serverSupabase,
  uuidValue,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = uuidValue((await params).id, "Member ID");
    const supabase = await serverSupabase();
    const [memberResult, reviewsResult] = await Promise.all([
      supabase.from("member_directory").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("reviews")
        .select(
          "id,connection_id,reviewer_id,recipient_id,rating,body,status,created_at",
        )
        .eq("recipient_id", id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    dbError(memberResult.error);
    dbError(reviewsResult.error);
    if (!memberResult.data)
      throw new ApiError("This member is not currently available.", 404);
    // Reviewer names are intentionally not public without their separate consent.
    return response({
      member: memberResult.data,
      reviews: (reviewsResult.data || []).map((review) => ({
        ...review,
        reviewer_name: "Verified Global member",
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
