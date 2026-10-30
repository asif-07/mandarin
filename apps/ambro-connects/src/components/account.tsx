"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  PLAN_DETAILS,
  type MeResponse,
  type Plan,
  type Profile,
} from "@/lib/types";
import "./member-tools.css";

type Notice = { type: "success" | "error"; text: string } | null;

async function responseData<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "Something went wrong. Please try again.";
    throw new Error(error);
  }
  if (!body || typeof body !== "object")
    throw new Error(
      "The server returned an unexpected response. Please try again.",
    );
  return body as T;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "AC"
  );
}

export function Account() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialties, setSpecialties] = useState("");
  const [languages, setLanguages] = useState("");
  const [achievements, setAchievements] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [plan, setPlan] = useState<Plan>("global_monthly");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal, resetProfile = true) => {
      const result = await responseData<MeResponse>(
        await fetch("/api/me", { cache: "no-store", signal }),
      );
      if (!Array.isArray(result.connections) || !("user" in result))
        throw new Error("Your account could not be loaded. Please try again.");
      setData(result);
      if (resetProfile) {
        setProfile(result.profile);
        setSpecialties(result.profile?.specialties.join(", ") || "");
        setLanguages(result.profile?.languages.join(", ") || "");
        setAchievements(result.profile?.achievements.join("\n") || "");
        setPlan(
          result.membership?.member_type === "china"
            ? "china_yearly"
            : "global_monthly",
        );
      }
      setLoadError("");
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Your account could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);

  async function retry() {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Your account could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  function edit<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setNotice(null);
    try {
      const split = (value: string, separator: string | RegExp) =>
        value
          .split(separator)
          .map((item) => item.trim())
          .filter(Boolean);
      await responseData(
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...profile,
            specialties: split(specialties, ","),
            languages: split(languages, ","),
            achievements: split(achievements, /\r?\n/),
          }),
        }),
      );
      await load();
      setNotice({ type: "success", text: "Your profile has been saved." });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your profile could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(
    file: File | undefined,
    kind: "avatar" | "cover" | "portfolio",
    index?: number,
  ) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice({ type: "error", text: "Choose a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice({
        type: "error",
        text: "Please choose an image smaller than 5 MB.",
      });
      return;
    }
    setUploading(`${kind}${index ?? ""}`);
    setNotice(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", kind);
      const result = await responseData<{ url: string }>(
        await fetch("/api/upload", { method: "POST", body }),
      );
      if (typeof result.url !== "string" || !result.url.startsWith("https://"))
        throw new Error("The image upload returned an invalid link.");
      setProfile((current) => {
        if (!current) return current;
        if (kind === "portfolio" && index !== undefined)
          return {
            ...current,
            portfolio: current.portfolio.map((item, itemIndex) =>
              itemIndex === index ? { ...item, image_url: result.url } : item,
            ),
          };
        return {
          ...current,
          [kind === "avatar" ? "avatar_url" : "cover_url"]: result.url,
        };
      });
      setNotice({
        type: "success",
        text: "Image uploaded. Save your profile to publish the change.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your image could not be uploaded.",
      });
    } finally {
      setUploading("");
    }
  }

  async function submitMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      await responseData(
        await fetch("/api/membership", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, reference, note }),
        }),
      );
      await load(undefined, false);
      setReference("");
      setNote("");
      setNotice({
        type: "success",
        text: "Your details have been sent for review. Membership will activate after the Mandarin Roots team approves them.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your membership request could not be sent.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setNotice(null);
    try {
      await responseData(
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        }),
      );
      window.location.assign("/");
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "You could not be signed out. Please try again.",
      });
      setLoggingOut(false);
    }
  }

  if (loading)
    return (
      <div className="container ac-page">
        <div className="ac-loading" role="status">
          <span className="ac-spinner" />
          Loading your account…
        </div>
      </div>
    );
  if (loadError)
    return (
      <div className="container ac-page">
        <div className="panel ac-state" role="alert">
          <span className="eyebrow">Account</span>
          <h1>We couldn’t load your account.</h1>
          <p className="muted">{loadError}</p>
          <button className="btn btn-dark" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  if (!data?.user)
    return (
      <div className="container ac-page">
        <div className="panel ac-state">
          <span className="eyebrow">Your next connection starts here</span>
          <h1>A place in Ambro’s network.</h1>
          <p className="muted">
            Sign in to manage your profile, membership and business connections.
          </p>
          <div className="ac-actions">
            <Link className="btn btn-primary" href="/login">
              Sign in <span aria-hidden="true">↗</span>
            </Link>
            <Link className="btn btn-ghost" href="/join">
              Join the network
            </Link>
          </div>
        </div>
      </div>
    );
  if (!profile || !data.membership)
    return (
      <div className="container ac-page">
        <div className="panel ac-state" role="alert">
          <h1>Your account is being prepared.</h1>
          <p className="muted">
            Your profile is not available yet. Please refresh in a moment.
          </p>
          <button className="btn btn-dark" onClick={retry}>
            Refresh account
          </button>
        </div>
      </div>
    );

  const membership = data.membership;
  const isChina = membership.member_type === "china";
  const pending = membership.requests.find(
    (request) => request.status === "pending",
  );
  const profileReady = Boolean(
    data.profile?.full_name &&
      data.profile.bio &&
      data.profile.city &&
      data.profile.avatar_url &&
      data.profile.specialties.length,
  );

  return (
    <div className="container ac-page">
      <div className="ac-page-heading">
        <div className="page-intro">
          <span className="eyebrow">Your corner of the network</span>
          <h1>
            Make a great
            <br />
            first connection.
          </h1>
          <p className="muted">
            A thoughtful profile helps the right people find you.
          </p>
        </div>
        <button
          className="btn btn-ghost ac-signout"
          onClick={logout}
          disabled={loggingOut}
        >
          {loggingOut ? "Signing out…" : "Sign out"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      {notice ? (
        <div
          className={`ac-notice ac-notice-${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="ac-account-layout">
        <div>
          <div className="ac-steps panel" aria-label="Your profile progress">
            <div className="ac-step">
              <span className="ac-step-dot is-done">✓</span>
              <span>
                <strong>Account created</strong>
                <small>{data.user.email}</small>
              </span>
            </div>
            <div className="ac-step">
              <span className={`ac-step-dot ${profileReady ? "is-done" : ""}`}>
                {profileReady ? "✓" : "2"}
              </span>
              <span>
                <strong>Your introduction</strong>
                <small>
                  {profileReady
                    ? "The essentials are in place"
                    : "Add a photo, bio and specialties"}
                </small>
              </span>
            </div>
            <div className="ac-step">
              <span
                className={`ac-step-dot ${membership.active ? "is-done" : ""}`}
              >
                {membership.active ? "✓" : "3"}
              </span>
              <span>
                <strong>Membership</strong>
                <small>
                  {membership.active
                    ? "You’re part of the network"
                    : pending
                      ? "Awaiting team approval"
                      : "Submit payment or trip details"}
                </small>
              </span>
            </div>
          </div>

          <form className="panel ac-profile-form" onSubmit={saveProfile}>
            <div className="ac-form-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">01 / The introduction</span>
                  <h2>Your profile</h2>
                </div>
                <span className="chip">
                  {isChina ? "China member" : "Global member"}
                </span>
              </div>
              <div className="ac-photo-row">
                <div className="ac-profile-avatar">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Your profile" />
                  ) : (
                    <span>{initials(profile.full_name)}</span>
                  )}
                </div>
                <div>
                  <label className="btn btn-ghost ac-upload-label">
                    {uploading === "avatar"
                      ? "Uploading…"
                      : "Upload your photo"}
                    <input
                      aria-label="Upload your profile photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={Boolean(uploading)}
                      onChange={(event) => {
                        void uploadPhoto(event.target.files?.[0], "avatar");
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <p className="ac-help">JPG, PNG or WebP. Up to 5 MB.</p>
                </div>
              </div>
              <div className="form-grid ac-form-grid">
                <label className="field">
                  Full name
                  <input
                    className="input"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={profile.full_name}
                    onChange={(event) => edit("full_name", event.target.value)}
                    placeholder="How people know you"
                  />
                </label>
                <label className="field">
                  Company or business
                  <input
                    className="input"
                    autoComplete="organization"
                    maxLength={150}
                    value={profile.company}
                    onChange={(event) => edit("company", event.target.value)}
                    placeholder="Your company name"
                  />
                </label>
                <label className="field">
                  City
                  <input
                    className="input"
                    autoComplete="address-level2"
                    required
                    maxLength={100}
                    value={profile.city}
                    onChange={(event) => edit("city", event.target.value)}
                    placeholder={
                      isChina ? "Guangzhou, China" : "Your city and country"
                    }
                  />
                </label>
                <label className="field">
                  Languages
                  <input
                    className="input"
                    maxLength={300}
                    value={languages}
                    onChange={(event) => setLanguages(event.target.value)}
                    placeholder="English, Mandarin, Malayalam"
                  />
                  <span className="ac-help">
                    Up to 12 languages, separated by commas.
                  </span>
                </label>
                <label className="field ac-full-width">
                  About you
                  <textarea
                    className="input"
                    rows={5}
                    maxLength={2000}
                    value={profile.bio}
                    onChange={(event) => edit("bio", event.target.value)}
                    placeholder={
                      isChina
                        ? "Tell visitors what you do, who you help, and what working with you looks like."
                        : "Tell the network what you’re exploring and the connections you hope to make."
                    }
                  />
                  <span className="ac-help">
                    A clear introduction builds trust. {profile.bio.length}
                    /2,000
                  </span>
                </label>
                <label className="field ac-full-width">
                  Specialties
                  <input
                    className="input"
                    maxLength={600}
                    value={specialties}
                    onChange={(event) => setSpecialties(event.target.value)}
                    placeholder="Sourcing, Canton Fair, logistics"
                  />
                  <span className="ac-help">
                    Up to 12 specialties, separated by commas.
                  </span>
                </label>
              </div>
            </div>

            <div className="ac-form-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">02 / The experience</span>
                  <h2>Show what you bring.</h2>
                </div>
              </div>
              <label className="field">
                Achievements
                <textarea
                  className="input"
                  rows={4}
                  maxLength={4000}
                  value={achievements}
                  onChange={(event) => setAchievements(event.target.value)}
                  placeholder={
                    "Add one achievement per line.\nFor example: Helped a business source its first shipment."
                  }
                />
                <span className="ac-help">
                  Up to 12 achievements, one per line, each under 500
                  characters. These are shared as your own statements.
                </span>
              </label>
              <div className="ac-cover-upload">
                {profile.cover_url ? (
                  <img
                    src={profile.cover_url}
                    alt="Your profile cover"
                    className="ac-cover-preview"
                  />
                ) : (
                  <div className="ac-cover-placeholder">
                    <span aria-hidden="true">↗</span>
                    <span>A little more of your world.</span>
                  </div>
                )}
                <div className="ac-cover-footer">
                  <div>
                    <strong>Profile cover</strong>
                    <p className="ac-help">
                      Your workplace, team or a moment from your business.
                    </p>
                  </div>
                  <label className="btn btn-ghost ac-upload-label">
                    {uploading === "cover" ? "Uploading…" : "Choose image"}
                    <input
                      aria-label="Upload profile cover image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={Boolean(uploading)}
                      onChange={(event) => {
                        void uploadPhoto(event.target.files?.[0], "cover");
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="ac-form-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">03 / The proof of work</span>
                  <h2>Previous work</h2>
                  <p className="muted ac-section-description">
                    Share projects and business you’ve worked on.
                  </p>
                </div>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={
                    Boolean(uploading) || profile.portfolio.length >= 12
                  }
                  onClick={() =>
                    edit("portfolio", [
                      ...profile.portfolio,
                      { title: "", description: "", image_url: "" },
                    ])
                  }
                >
                  + Add project
                </button>
              </div>
              {profile.portfolio.length === 0 ? (
                <div className="ac-portfolio-empty">
                  <span aria-hidden="true">＋</span>
                  <p>Your work tells your story.</p>
                  <span className="muted">
                    Add a project with a photo and a few useful details.
                  </span>
                </div>
              ) : (
                <div className="ac-portfolio-list">
                  {profile.portfolio.map((item, index) => (
                    <div className="ac-portfolio-item" key={index}>
                      <div className="ac-portfolio-image">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title || `Project ${index + 1}`}
                          />
                        ) : (
                          <span aria-hidden="true">↗</span>
                        )}
                        <label className="ac-upload-label ac-image-upload">
                          {uploading === `portfolio${index}`
                            ? "Uploading…"
                            : item.image_url
                              ? "Change image"
                              : "Add project photo"}
                          <input
                            aria-label={`Upload photo for project ${index + 1}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={Boolean(uploading)}
                            onChange={(event) => {
                              void uploadPhoto(
                                event.target.files?.[0],
                                "portfolio",
                                index,
                              );
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <div className="ac-portfolio-fields">
                        <label className="field">
                          Project title
                          <input
                            className="input"
                            required
                            maxLength={150}
                            value={item.title}
                            onChange={(event) =>
                              edit(
                                "portfolio",
                                profile.portfolio.map((project, itemIndex) =>
                                  itemIndex === index
                                    ? { ...project, title: event.target.value }
                                    : project,
                                ),
                              )
                            }
                            placeholder="A project you’re proud of"
                          />
                        </label>
                        <label className="field">
                          What did you do?
                          <textarea
                            className="input"
                            rows={3}
                            maxLength={1000}
                            value={item.description}
                            onChange={(event) =>
                              edit(
                                "portfolio",
                                profile.portfolio.map((project, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...project,
                                        description: event.target.value,
                                      }
                                    : project,
                                ),
                              )
                            }
                            placeholder="Your role, the brief and the outcome."
                          />
                        </label>
                        <button
                          type="button"
                          className="ac-text-button ac-remove"
                          disabled={Boolean(uploading)}
                          onClick={() =>
                            edit(
                              "portfolio",
                              profile.portfolio.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove project {index + 1}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ac-save-bar">
              <p className="ac-help">
                {isChina
                  ? "Your China profile appears in discovery after profile approval and membership activation."
                  : "Your details help China members understand your business interests."}
              </p>
              <button
                className="btn btn-primary"
                disabled={saving || Boolean(uploading)}
                type="submit"
              >
                {saving ? "Saving…" : "Save profile"}{" "}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </form>
        </div>

        <aside className="ac-membership-column">
          <section className="ac-membership-card">
            <div className="ac-membership-top">
              <span className="eyebrow">Your membership</span>
              <span
                className={`ac-status ${membership.active ? "ac-status-active" : ""}`}
              >
                {membership.active
                  ? "Active"
                  : pending
                    ? "In review"
                    : "Not active"}
              </span>
            </div>
            <span className="ac-membership-symbol" aria-hidden="true">
              a<span>↗</span>
            </span>
            <h2>
              Ambro Connect
              <br />
              <em>{isChina ? "China" : "Global"}</em>
            </h2>
            <p>
              {isChina
                ? "Your local expertise. A world of new connections."
                : "Good people. New perspectives. Real possibilities."}
            </p>
            <div className="ac-membership-facts">
              <div>
                <span>Profile review</span>
                <strong>
                  {membership.moderation_status === "approved"
                    ? "Approved"
                    : membership.moderation_status === "pending"
                      ? "Pending"
                      : membership.moderation_status === "suspended"
                        ? "Suspended"
                        : "Needs attention"}
                </strong>
              </div>
              {membership.current ? (
                <>
                  <div>
                    <span>Current plan</span>
                    <strong>
                      {membership.current.plan === "trip_year"
                        ? "Trip benefit · 1 year"
                        : `${PLAN_DETAILS[membership.current.plan].amount.toLocaleString()} RMB / ${PLAN_DETAILS[membership.current.plan].duration}`}
                    </strong>
                  </div>
                  <div>
                    <span>{"Membership through"}</span>
                    <strong>{formatDate(membership.current.expires_at)}</strong>
                  </div>
                </>
              ) : (
                <div>
                  <span>Membership begins</span>
                  <strong>After team approval</strong>
                </div>
              )}
            </div>
            {membership.moderation_reason &&
            ["rejected", "suspended"].includes(membership.moderation_status) ? (
              <p className="ac-moderation-reason">
                <strong>A note from the team</strong>
                {membership.moderation_reason}
                {membership.moderation_status === "rejected" && isChina ? (
                  <span className="ac-resubmit-help">
                    Correct your profile and save it to submit it for another
                    review.
                  </span>
                ) : null}
              </p>
            ) : null}
          </section>

          <section className="panel ac-membership-form">
            <span className="eyebrow">A few details, then you’re in</span>
            <h3>
              {pending
                ? "Your request is with us."
                : membership.active
                  ? "Extend your connections."
                  : "Activate your membership."}
            </h3>
            {pending ? (
              <div className="ac-pending-box">
                <span className="ac-status">Awaiting approval</span>
                <p>{PLAN_DETAILS[pending.plan].label}</p>
                <dl>
                  <div>
                    <dt>Reference</dt>
                    <dd>{pending.reference}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDate(pending.created_at)}</dd>
                  </div>
                </dl>
                <p className="ac-help">
                  The Mandarin Roots team will check your details. Submission
                  does not activate membership.
                </p>
              </div>
            ) : (
              <form onSubmit={submitMembership}>
                {!isChina ? (
                  <fieldset className="ac-plan-options">
                    <legend>Choose how to join</legend>
                    <label
                      className={plan === "global_monthly" ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="membership-plan"
                        value="global_monthly"
                        checked={plan === "global_monthly"}
                        onChange={() => setPlan("global_monthly")}
                      />
                      <span>
                        <strong>Monthly membership</strong>
                        <small>100 RMB / month</small>
                      </span>
                    </label>
                    <label
                      className={plan === "trip_year" ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="membership-plan"
                        value="trip_year"
                        checked={plan === "trip_year"}
                        onChange={() => setPlan("trip_year")}
                      />
                      <span>
                        <strong>I’m joining an Ambro trip</strong>
                        <small>
                          First year included after booking verification
                        </small>
                      </span>
                    </label>
                  </fieldset>
                ) : (
                  <div className="ac-price-line">
                    <strong>
                      1,000 <span>RMB</span>
                    </strong>
                    <span>for one year</span>
                  </div>
                )}
                <p className="muted ac-payment-explanation">
                  {plan === "trip_year"
                    ? "Add your Mandarin Roots trip booking reference. Your included year starts when the team approves your booking."
                    : "Arrange payment with the Mandarin Roots team, then submit your payment reference here for confirmation."}
                </p>
                <label className="field">
                  {plan === "trip_year"
                    ? "Trip booking reference"
                    : "Payment reference"}
                  <input
                    className="input"
                    required
                    minLength={3}
                    maxLength={200}
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder={
                      plan === "trip_year"
                        ? "Your booking or invoice number"
                        : "Transaction or payment reference"
                    }
                  />
                </label>
                <label className="field ac-field-space">
                  Note <span className="ac-optional">(optional)</span>
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={
                      plan === "trip_year"
                        ? "Trip date or anything we should know."
                        : "Payment date, sender name or useful details."
                    }
                  />
                </label>
                <button
                  className="btn btn-dark ac-full-button"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "Sending for review…" : "Submit for approval"}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
                <p className="ac-help ac-membership-disclaimer">
                  Manually reviewed by Mandarin Roots. Access starts after
                  approval.
                </p>
              </form>
            )}
          </section>

          {membership.requests.some(
            (request) => request.status !== "pending",
          ) ? (
            <section className="panel ac-request-history">
              <h3>Recent requests</h3>
              {membership.requests
                .filter((request) => request.status !== "pending")
                .slice(0, 3)
                .map((request) => (
                  <div className="ac-history-item" key={request.id}>
                    <div>
                      <strong>
                        {request.plan === "trip_year"
                          ? "Trip benefit"
                          : "Membership payment"}
                      </strong>
                      <span
                        className={`ac-status ${request.status === "approved" ? "ac-status-active" : "ac-status-declined"}`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="ac-help">
                      {formatDate(request.created_at)} · {request.reference}
                    </p>
                    {request.rejection_reason ? (
                      <p className="ac-history-reason">
                        {request.rejection_reason}
                      </p>
                    ) : null}
                  </div>
                ))}
            </section>
          ) : null}
          {data.user.is_admin ? (
            <Link className="ac-admin-link" href="/admin">
              Open team dashboard <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export default Account;
