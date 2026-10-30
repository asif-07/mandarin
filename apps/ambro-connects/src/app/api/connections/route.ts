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
    if (body.consent !== true)
      throw new ApiError(
        "Please agree to share your account email when this member accepts your request.",
      );
    const { supabase, user } = await authenticated();
    if (
      body.expected_user_id !== undefined &&
      body.expected_user_id !== user.id
    ) {
      throw new ApiError(
        "Your signed-in account changed. Reload before continuing.",
        409,
      );
    }
    const { data, error } = await supabase.rpc("request_connection", {
      target: uuidValue(body.recipient_id, "Recipient ID"),
      introduction: stringValue(body.message, "Introduction", 2000),
      email_consent: body.consent,
    });
    dbError(error);
    return response({ ok: true, id: data }, 201);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!["accepted", "declined", "completed"].includes(String(body.status)))
      throw new ApiError("Choose a valid connection status.");
    if (body.status === "accepted" && body.consent !== true)
      throw new ApiError(
        "Please agree to share your account email to accept this connection.",
      );
    const { supabase } = await authenticated();
    const { error } = await supabase.rpc("change_connection", {
      target: uuidValue(body.id, "Connection ID"),
      new_status: body.status,
      email_consent: body.consent === true,
    });
    dbError(error);
    return response({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
