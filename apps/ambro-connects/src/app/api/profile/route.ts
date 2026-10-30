import {
  ApiError,
  authenticated,
  dbError,
  failure,
  jsonBody,
  response,
  stringValue,
} from "@/lib/supabase";

function strings(value: unknown, name: string, limit: number) {
  if (!Array.isArray(value) || value.length > 12)
    throw new ApiError(`${name} must contain at most 12 items.`);
  return [...new Set(value.map((item) => stringValue(item, name, limit)))];
}

function mediaUrl(value: unknown, name: string, userId: string) {
  const url = stringValue(value, name, 1000, false);
  if (!url) return "";
  const expected = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/member-media/${userId}/`;
  if (!url.startsWith(expected))
    throw new ApiError(
      `${name} must be uploaded to your Ambro Connects account.`,
    );
  return url;
}

export async function GET() {
  try {
    const { supabase, user } = await authenticated();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    dbError(error);
    return response({ profile: data });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await jsonBody(request);
    const { supabase, user } = await authenticated();
    if (body.id !== undefined && body.id !== user.id)
      throw new ApiError(
        "Your signed-in account changed. Reload your profile before saving.",
        409,
      );
    if (
      body.network_visible !== undefined &&
      typeof body.network_visible !== "boolean"
    )
      throw new ApiError("Choose whether to show your profile in the network.");
    if (!Array.isArray(body.portfolio) || body.portfolio.length > 12)
      throw new ApiError("Add at most 12 portfolio projects.");
    const portfolio = body.portfolio.map((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new ApiError("Check your portfolio projects.");
      const entry = item as Record<string, unknown>;
      return {
        title: stringValue(entry.title, "Project title", 150),
        description: stringValue(
          entry.description,
          "Project description",
          1000,
          false,
        ),
        image_url: mediaUrl(entry.image_url, "Project photo", user.id),
      };
    });
    const update = {
      full_name: stringValue(body.full_name, "Full name", 100),
      bio: stringValue(body.bio, "Introduction", 2000, false),
      city: stringValue(body.city, "City", 100, false),
      company: stringValue(body.company, "Company", 150, false),
      specialties: strings(body.specialties, "Specialties", 100),
      languages: strings(body.languages, "Languages", 50),
      achievements: strings(body.achievements, "Achievements", 500),
      avatar_url: mediaUrl(body.avatar_url, "Profile photo", user.id),
      cover_url: mediaUrl(body.cover_url, "Cover photo", user.id),
      portfolio,
      ...(typeof body.network_visible === "boolean"
        ? { network_visible: body.network_visible }
        : {}),
    };
    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", user.id)
      .select("*")
      .single();
    dbError(error);
    return response({ ok: true, profile: data });
  } catch (error) {
    return failure(error);
  }
}
