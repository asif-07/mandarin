import {
  ApiError,
  authenticated,
  dbError,
  failure,
  jsonBody,
  response,
  stringValue,
  uuidValue,
} from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (
      typeof body.rating !== "number" ||
      !Number.isInteger(body.rating) ||
      body.rating < 1 ||
      body.rating > 5
    )
      throw new ApiError("Choose a rating from 1 to 5.");
    const { supabase } = await authenticated();
    const { data, error } = await supabase.rpc("submit_review", {
      target: uuidValue(body.connection_id, "Connection ID"),
      stars: body.rating,
      review_body: stringValue(body.body, "Review", 2000),
    });
    dbError(error);
    return response(
      { ok: true, id: data, message: "Your review is awaiting moderation." },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
