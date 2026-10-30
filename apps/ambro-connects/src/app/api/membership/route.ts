import {
  ApiError,
  authenticated,
  dbError,
  failure,
  jsonBody,
  response,
  stringValue,
} from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const { supabase, user } = await authenticated();
    if (
      body.expected_user_id !== undefined &&
      body.expected_user_id !== user.id
    )
      throw new ApiError(
        "Your signed-in account changed. Reload your profile before submitting membership details.",
        409,
      );
    if (
      !["china_yearly", "global_monthly", "trip_year"].includes(
        String(body.plan),
      )
    )
      throw new ApiError("Choose a valid membership plan.");
    const { data, error } = await supabase.rpc("request_membership", {
      chosen_plan: body.plan,
      payment_reference: stringValue(
        body.reference,
        "Payment or trip booking reference",
        200,
      ),
      member_note: stringValue(body.note, "Note", 1000, false),
    });
    dbError(error);
    return response(
      {
        ok: true,
        id: data,
        message:
          "Your reference is with the Ambro team for verification. Membership activates only after approval.",
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
