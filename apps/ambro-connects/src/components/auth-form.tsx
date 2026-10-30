"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
import "./mobile-forms.css";

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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const joining = mode === "join";
  const reset = mode === "reset";
  const teamLogin = mode === "login" && search.get("next") === "/admin";
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!notice) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement) active.blur();
    noticeRef.current?.focus();
  }, [notice]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
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
        router.push(teamLogin || data.user?.is_admin ? "/admin" : "/account");
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
      <section className="auth-panel" aria-labelledby="auth-form-heading">
        <h1 id="auth-form-heading" className="auth-form-heading">
          {joining
            ? "Find your place in the circle."
            : reset
              ? "Choose a new password."
              : forgot
                ? "Reset your password."
                : teamLogin
                  ? "Sign in to team approvals."
                  : "Good to see you again."}
        </h1>
        <p>
          {joining
            ? "Choose your membership and create your account."
            : forgot
              ? "We’ll send a secure reset link to your email."
              : reset
                ? "Use at least 10 characters for your new password."
                : teamLogin
                  ? "Use your designated team email and the password you chose."
                  : "Sign in to your Ambro Connects account."}
        </p>
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset className="auth-fields" disabled={busy}>
            {joining && (
              <>
                <details className="auth-preview-info">
                  <summary>Review release · registration details</summary>
                  <p>
                    Public registrations open after email verification delivery
                    is connected. Team accounts can register now.
                  </p>
                </details>
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
                      Connect China
                      <small>Living & doing business in China</small>
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
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                  placeholder="you@example.com"
                />
              </label>
            )}
            {!forgot && (
              <div className="field">
                <label htmlFor="auth-password">
                  {reset ? "New password" : "Password"}
                </label>
                <div className="auth-password-field">
                  <input
                    id="auth-password"
                    name="password"
                    autoComplete={
                      joining || reset ? "new-password" : "current-password"
                    }
                    type={passwordVisible ? "text" : "password"}
                    aria-describedby={
                      joining || reset ? "auth-password-help" : undefined
                    }
                    minLength={joining || reset ? 10 : 1}
                    maxLength={128}
                    required
                    placeholder={
                      joining || reset
                        ? "At least 10 characters"
                        : "Your password"
                    }
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? "Hide" : "Show"}
                  </button>
                </div>
                {joining || reset ? (
                  <span id="auth-password-help" className="auth-password-help">
                    Use at least 10 characters.
                  </span>
                ) : null}
              </div>
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
                    <Link href="/community">community guidelines</Link>. If I
                    join China, my approved profile will be publicly
                    discoverable.
                  </span>
                </label>
              </>
            )}
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="status error auth-feedback"
              >
                {error}
              </div>
            )}
            {notice && (
              <div
                ref={noticeRef}
                tabIndex={-1}
                role="status"
                className="status success auth-feedback"
              >
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
                  setPasswordVisible(false);
                  setError("");
                  setNotice("");
                }}
              >
                {forgot ? "Back to sign in" : "Forgot your password?"}
              </button>
            )}
            {joining && (
              <small className="muted auth-payment-note">
                No payments are collected here. Create your account first; the
                team will confirm the next step.
              </small>
            )}
          </fieldset>
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
        {!joining && !reset ? (
          <div className="auth-team-help">
            <strong>Here to approve members?</strong>
            <p>
              Use your team account. Admin access uses the same password and
              does not require a paid membership.
            </p>
            <Link href="/admin">Open approvals ↗</Link>
            <Link href="/how-to-use#team">How to use the admin portal ↗</Link>
          </div>
        ) : null}
      </section>
      <div className="auth-intro">
        <p className="eyebrow">YOUR NEXT CONNECTION STARTS HERE</p>
        <h2 className="auth-intro-heading">
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
        </h2>
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
    </div>
  );
}
