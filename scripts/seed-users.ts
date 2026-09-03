/**
 * Creates the four shared team accounts via the Supabase Admin API.
 *
 * Usage:  npx tsx scripts/seed-users.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Idempotent: existing users are updated (password + metadata) rather than
 * duplicated. Passwords are the launch defaults from the spec; rotate them
 * after launch (see SECURITY.md).
 */
import "dotenv/config";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DOMAIN = "mandarinroots.local";

const USERS = [
  { username: "ambro", display_name: "Ambro", password: "ambro@123", role: "admin" },
  { username: "asif", display_name: "Asif", password: "asif@123", role: "admin" },
  { username: "sales", display_name: "Sales", password: "sales@123", role: "sales" },
  { username: "document", display_name: "Document", password: "document@123", role: "document" },
] as const;

async function main() {
  const admin = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  for (const u of USERS) {
    const email = `${u.username}@${DOMAIN}`;
    const metadata = { username: u.username, display_name: u.display_name, role: u.role };
    const found = existing.users.find((x) => x.email === email);

    if (found) {
      const { error } = await admin.auth.admin.updateUserById(found.id, {
        password: u.password,
        user_metadata: metadata,
        email_confirm: true,
      });
      if (error) throw error;
      await admin
        .from("profiles")
        .upsert({ id: found.id, username: u.username, display_name: u.display_name, role: u.role });
      console.log(`updated  ${email}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: u.password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) throw error;
      // The on_auth_user_created trigger creates the profile; upsert as a safety net.
      await admin
        .from("profiles")
        .upsert({ id: data.user.id, username: u.username, display_name: u.display_name, role: u.role });
      console.log(`created  ${email}`);
    }
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
