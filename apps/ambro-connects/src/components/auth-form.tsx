"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe2,
  MapPin,
  ArrowUpRight,
  ShieldCheck,
  Users,
  Plane,
} from "lucide-react";

export function AuthForm({ mode }: { mode: "join" | "login" | "reset" }) {
  const search = useSearchParams();
  const router = useRouter();
  const [type, setType] = useState(
    search.get("type") === "china" ? "china" : "global",
  );
  const [trip, setTrip] = useState(search.get("plan") === "trip_year");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    search.get("error") === "confirmation"
      ? "This email link has expired or could not be confirmed. Please sign in if you already confirmed it, or request a password reset."
      : search.get("error") === "unavailable"
        ? "Authentication is temporarily unavailable. Please try again."
        : "",
  );
  const [notice, setNotice] = useState("");
  const [forgot, setForgot] = useState(false);
  const joining = mode === "join";
  const reset = mode === "reset";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reset
            ? "update-password"
            : forgot
              ? "reset-password"
              : joining
                ? "signup"
                : "login",
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          member_type: type,
          plan:
            type === "china"
              ? "china_yearly"
              : trip
                ? "trip_year"
                : "global_monthly",
          trip_reference: f.get("trip_reference"),
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(
          data.error || "We couldn’t complete that. Please try again.",
        );
      if (forgot) {
        setNotice(
          "If an account exists for that email, you’ll receive a password reset link.",
        );
      } else if (joining) {
        setNotice(
          data.message ||
            "Check your email to confirm your account, then sign in to finish your profile and membership request.",
        );
        if (data.confirmation_required === false) router.push("/account");
      } else {
        router.push("/account");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container auth-layout">
      <div className="auth-intro">
        <p className="eyebrow">YOUR NEXT CONNECTION STARTS HERE</p>
        <h1>
          {joining ? (
            <>
              A wider world.
              <br />
              <em>Your kind of people.</em>
            </>
          ) : reset ? (
            <>
              A fresh start.
              <br />
              <em>Welcome back.</em>
            </>
          ) : (
            <>
              Your circle.
              <br />
              <em>One hello away.</em>
            </>
          )}
        </h1>
        <p>
          {joining
            ? "People in China. People going to China. One shared space for what comes next."
            : "Pick up where you left off. Your people, plans and next possibilities are right here."}
        </p>
        <div className="auth-feature">
          <Users size={20} />
          <span>People first. Business follows.</span>
        </div>
        <div className="auth-feature">
          <ShieldCheck size={20} />
          <span>Your contact details stay private until you connect.</span>
        </div>
        <div className="auth-feature">
          <Plane size={20} />
          <span>A trip with Ambro includes your first year.</span>
        </div>
        <p className="auth-note">
          Ambro Connects is a community by Hamras and Mandarin Roots.
          Memberships are confirmed by the team, with no automatic billing.
        </p>
      </div>
      <section className="auth-panel">
        <h2>
          {joining
            ? "Find your place in the circle."
            : reset
              ? "Choose a new password."
              : forgot
                ? "Reset your password."
                : "Good to see you again."}
        </h2>
        <p>
          {joining
            ? "Choose your membership and create your account."
            : forgot
              ? "We’ll send a secure reset link to your email."
              : reset
                ? "Use at least 10 characters for your new password."
                : "Sign in to your Ambro Connects account."}
        </p>
        <form onSubmit={submit}>
          {joining && (
            <>
              <div className="status">
                Preview release · Public registrations open after email
                verification delivery is connected. Team accounts can register
                now.
              </div>
              <div
                className="type-toggle"
                role="group"
                aria-label="Membership type"
              >
                <button
                  type="button"
                  aria-pressed={type === "global"}
                  className={type === "global" ? "selected" : ""}
                  onClick={() => setType("global")}
                >
                  <Globe2 size={20} />
                  <span>
                    Connect Global<small>Visiting or exploring China</small>
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={type === "china"}
                  className={type === "china" ? "selected" : ""}
                  onClick={() => setType("china")}
                >
                  <MapPin size={20} />
                  <span>
                    Connect China<small>Living & doing business in China</small>
                  </span>
                </button>
              </div>
              <label className="field">
                Your full name
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                  placeholder="How should we call you?"
                />
              </label>
            </>
          )}
          {!reset && (
            <label className="field">
              Email address
              <input
                name="email"
                autoComplete="email"
                type="email"
                maxLength={254}
                required
                placeholder="you@example.com"
              />
            </label>
          )}
          {!forgot && (
            <label className="field">
              {reset ? "New password" : "Password"}
              <input
                name="password"
                autoComplete={
                  joining || reset ? "new-password" : "current-password"
                }
                type="password"
                minLength={joining || reset ? 10 : 1}
                maxLength={128}
                required
                placeholder={
                  joining || reset ? "At least 10 characters" : "Your password"
                }
              />
            </label>
          )}
          {joining && (
            <>
              {type === "global" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={trip}
                    onChange={(e) => setTrip(e.target.checked)}
                  />
                  <span>
                    I’m joining an Ambro / Mandarin Roots China trip. I’d like
                    my complimentary year.
                  </span>
                </label>
              )}
              {type === "global" && trip && (
                <p className="status">
                  Add your trip booking reference in My space after confirming
                  your email. Your complimentary year starts after team
                  verification.
                </p>
              )}
              <div className="status">
                <strong>
                  {type === "china"
                    ? "RMB 1,000 / year"
                    : trip
                      ? "First 12 months complimentary"
                      : "RMB 100 / month"}
                </strong>
                <br />
                {type === "china"
                  ? "Profile review and manual payment confirmation required."
                  : trip
                    ? "Subject to booking verification. No automatic paid renewal."
                    : "Manual payment confirmation required. No automatic billing."}
              </div>
              <label className="check-label">
                <input type="checkbox" required />
                <span>
                  I agree to the <Link href="/terms">membership terms</Link>,{" "}
                  <Link href="/privacy">privacy notice</Link> and{" "}
                  <Link href="/community">community guidelines</Link>. If I join
                  China, my approved profile will be publicly discoverable.
                </span>
              </label>
            </>
          )}
          {error && (
            <div role="alert" className="status error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="status success">
              {notice}
            </div>
          )}
          <button disabled={busy} className="btn btn-primary" type="submit">
            {busy
              ? "One moment…"
              : joining
                ? "Create my account"
                : reset
                  ? "Save new password"
                  : forgot
                    ? "Send reset link"
                    : "Sign in"}
            <ArrowUpRight size={17} />
          </button>
          {!joining && !reset && (
            <button
              type="button"
              className="clear-filter"
              onClick={() => {
                setForgot(!forgot);
                setError("");
                setNotice("");
              }}
            >
              {forgot ? "Back to sign in" : "Forgot your password?"}
            </button>
          )}
          {joining && (
            <small className="muted" style={{ fontSize: 10 }}>
              No payments are collected here. Create your account first; the
              team will confirm the next step.
            </small>
          )}
        </form>
        <div className="auth-foot">
          {joining ? (
            <>
              Already in the circle? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New to Ambro Connects? <Link href="/join">Join the circle</Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
