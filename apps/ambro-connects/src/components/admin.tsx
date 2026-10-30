"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PLAN_DETAILS, type AdminQueues, type MeResponse } from "@/lib/types";
import "./member-tools.css";

type QueueKind = "profile" | "membership" | "review";
type Decision = "approved" | "rejected";

async function responseData<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "Something went wrong. Please try again.",
    );
  if (!body || typeof body !== "object")
    throw new Error("The server returned an unexpected response.");
  return body as T;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function Admin() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [queues, setQueues] = useState<AdminQueues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<QueueKind>("membership");
  const [busy, setBusy] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const account = await responseData<MeResponse>(
      await fetch("/api/me", { cache: "no-store", signal }),
    );
    if (!("user" in account))
      throw new Error("Your account could not be loaded.");
    setMe(account);
    if (account.user?.is_admin) {
      const result = await responseData<AdminQueues>(
        await fetch("/api/admin", { cache: "no-store", signal }),
      );
      if (
        !Array.isArray(result.profiles) ||
        !Array.isArray(result.requests) ||
        !Array.isArray(result.reviews)
      )
        throw new Error("The review queue could not be loaded.");
      setQueues(result);
    } else setQueues(null);
    setError("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "The review queue could not be loaded.",
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The review queue could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function decide(kind: QueueKind, id: string, decision: Decision) {
    const key = `${kind}-${id}`;
    const reason = reasons[key]?.trim() || "";
    if (decision === "rejected" && !reason) {
      setNotice({
        type: "error",
        text: "Add a reason before rejecting this item.",
      });
      document.getElementById(`reason-${key}`)?.focus();
      return;
    }
    setBusy(key);
    setNotice(null);
    try {
      await responseData(
        await fetch("/api/admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, id, decision, reason }),
        }),
      );
      await load();
      setReasons((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      const item =
        kind === "membership"
          ? "Membership request"
          : kind === "profile"
            ? "Profile"
            : "Review";
      setNotice({
        type: "success",
        text: `${item} ${decision}.${kind === "membership" && decision === "approved" ? " The membership period has been recorded by the server." : ""}`,
      });
    } catch (cause) {
      setNotice({
        type: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "The decision could not be saved.",
      });
    } finally {
      setBusy("");
    }
  }

  function decisionControls(
    kind: QueueKind,
    id: string,
    approvalLabel: string,
  ) {
    const key = `${kind}-${id}`;
    return (
      <div className="ac-admin-decision">
        <label className="field" htmlFor={`reason-${key}`}>
          Review note <span className="ac-optional">(required to reject)</span>
          <textarea
            id={`reason-${key}`}
            className="input"
            rows={2}
            maxLength={1000}
            value={reasons[key] || ""}
            onChange={(event) =>
              setReasons((current) => ({
                ...current,
                [key]: event.target.value,
              }))
            }
            placeholder="Explain anything that needs to be corrected or confirmed."
          />
        </label>
        <div className="ac-actions">
          <button
            className="btn btn-primary"
            disabled={Boolean(busy)}
            onClick={() => decide(kind, id, "approved")}
          >
            {busy === key ? "Saving decision…" : approvalLabel}{" "}
            <span aria-hidden="true">✓</span>
          </button>
          <button
            className="btn btn-ghost ac-reject-button"
            disabled={Boolean(busy)}
            onClick={() => decide(kind, id, "rejected")}
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="container ac-page">
        <div className="ac-loading" role="status">
          <span className="ac-spinner" />
          Loading the team dashboard…
        </div>
      </div>
    );
  if (error)
    return (
      <div className="container ac-page">
        <div className="panel ac-state" role="alert">
          <span className="eyebrow">Team dashboard</span>
          <h1>The queue couldn’t be loaded.</h1>
          <p className="muted">{error}</p>
          <button className="btn btn-dark" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  if (!me?.user)
    return (
      <div className="container ac-page">
        <div className="panel ac-state">
          <span className="eyebrow">Mandarin Roots team</span>
          <h1>Sign in to continue.</h1>
          <p className="muted">
            This dashboard is available to authorised team members.
          </p>
          <Link className="btn btn-dark" href="/login?next=/admin">
            Sign in <span aria-hidden="true">↗</span>
          </Link>
          <Link className="ac-admin-link" href="/how-to-use#team">
            How to use the admin portal ↗
          </Link>
        </div>
      </div>
    );
  if (!me.user.is_admin || !queues)
    return (
      <div className="container ac-page">
        <div className="panel ac-state">
          <span className="eyebrow">Team access</span>
          <h1>This area is for the team.</h1>
          <p className="muted">
            Your account does not have administrator access. Memberships,
            profiles and reviews are approved by the Mandarin Roots team.
          </p>
          <Link className="btn btn-dark" href="/account">
            Back to your account <span aria-hidden="true">↗</span>
          </Link>
          <Link className="ac-admin-link" href="/how-to-use#team">
            Help with team access ↗
          </Link>
        </div>
      </div>
    );

  const profiles = queues.profiles.filter(
    (profile) => profile.moderation_status === "pending",
  );
  const requests = queues.requests.filter(
    (request) => request.status === "pending",
  );
  const reviews = queues.reviews.filter(
    (review) => review.status === "pending",
  );
  const count =
    tab === "membership"
      ? requests.length
      : tab === "profile"
        ? profiles.length
        : reviews.length;

  return (
    <div className="container ac-page">
      <div className="ac-page-heading">
        <div className="page-intro">
          <span className="eyebrow">Mandarin Roots / Team dashboard</span>
          <h1>
            Good people.
            <br />
            Thoughtful checks.
          </h1>
          <p className="muted">
            Review the details that help keep Ambro’s network useful and
            trustworthy.
          </p>
        </div>
        <div className="ac-heading-actions">
          <Link className="btn btn-ghost" href="/how-to-use#approvals">
            How to approve <span aria-hidden="true">↗</span>
          </Link>
          <button className="btn btn-ghost" onClick={retry}>
            Refresh queue <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>
      {notice ? (
        <div
          className={`ac-notice ac-notice-${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      ) : null}
      <div className="ac-admin-summary">
        <div>
          <span className="eyebrow">Awaiting your review</span>
          <strong>{requests.length + profiles.length + reviews.length}</strong>
          <p>One careful check at a time.</p>
        </div>
        <p>
          Approve membership only after checking the payment or trip booking in
          your own records. The server applies the plan’s price and membership
          period.
        </p>
      </div>
      <div className="ac-connections-toolbar">
        <div className="ac-tabs ac-admin-tabs" aria-label="Review queue">
          <button
            aria-pressed={tab === "membership"}
            onClick={() => setTab("membership")}
          >
            Memberships <span>{requests.length}</span>
          </button>
          <button
            aria-pressed={tab === "profile"}
            onClick={() => setTab("profile")}
          >
            Profiles <span>{profiles.length}</span>
          </button>
          <button
            aria-pressed={tab === "review"}
            onClick={() => setTab("review")}
          >
            Reviews <span>{reviews.length}</span>
          </button>
        </div>
        <p className="ac-help">
          {count} {count === 1 ? "item" : "items"} to review
        </p>
      </div>
      {count === 0 ? (
        <div className="panel ac-connections-empty">
          <div className="ac-empty-symbol" aria-hidden="true">
            ✓
          </div>
          <span className="eyebrow">A little breathing room</span>
          <h2>You’re up to date here.</h2>
          <p className="muted">
            New{" "}
            {tab === "membership"
              ? "payment and trip membership requests"
              : tab === "profile"
                ? "profiles for review"
                : "member reviews"}{" "}
            will appear in this queue.
          </p>
        </div>
      ) : (
        <div className="ac-admin-list">
          {tab === "membership"
            ? requests.map((request) => (
                <article className="panel ac-admin-card" key={request.id}>
                  <div className="ac-admin-card-top">
                    <div>
                      <span className="eyebrow">
                        {request.plan === "trip_year"
                          ? "Trip booking check"
                          : "Payment check"}
                      </span>
                      <h2>{request.full_name || "Network member"}</h2>
                      <p className="muted">
                        Ambro Connect{" "}
                        {request.member_type === "china" ? "China" : "Global"} ·
                        Submitted {formatDate(request.created_at)}
                      </p>
                    </div>
                    <span className="ac-status">Pending</span>
                  </div>
                  <div className="ac-admin-request-details">
                    <div>
                      <span>Requested membership</span>
                      <strong>{PLAN_DETAILS[request.plan].label}</strong>
                    </div>
                    <div>
                      <span>
                        {request.plan === "trip_year"
                          ? "Trip benefit"
                          : "Amount to verify"}
                      </span>
                      <strong>
                        {request.plan === "trip_year"
                          ? "1 year included"
                          : `${PLAN_DETAILS[request.plan].amount.toLocaleString()} RMB / ${PLAN_DETAILS[request.plan].duration}`}
                      </strong>
                    </div>
                    <div className="ac-full-width">
                      <span>
                        {request.plan === "trip_year"
                          ? "Booking reference"
                          : "Payment reference"}
                      </span>
                      <strong className="ac-reference">
                        {request.reference}
                      </strong>
                    </div>
                  </div>
                  {request.note ? (
                    <div className="ac-admin-member-note">
                      <span className="eyebrow">Member’s note</span>
                      <p>{request.note}</p>
                    </div>
                  ) : null}
                  {decisionControls(
                    "membership",
                    request.id,
                    request.plan === "trip_year"
                      ? "Approve trip benefit"
                      : "Confirm payment & activate",
                  )}
                </article>
              ))
            : null}
          {tab === "profile"
            ? profiles.map((profile) => (
                <article className="panel ac-admin-card" key={profile.id}>
                  <div className="ac-admin-card-top">
                    <div className="ac-person">
                      <div className="ac-person-avatar">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" />
                        ) : (
                          <span>
                            {profile.full_name.slice(0, 2).toUpperCase() ||
                              "AC"}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="eyebrow">
                          Profile check /{" "}
                          {profile.member_type === "china" ? "China" : "Global"}
                        </span>
                        <h2>{profile.full_name || "Network member"}</h2>
                        <p className="muted">
                          {[profile.company, profile.city]
                            .filter(Boolean)
                            .join(" · ") || "No business or city added"}
                        </p>
                      </div>
                    </div>
                    <span className="ac-status">Pending</span>
                  </div>
                  <div className="ac-admin-profile-body">
                    <div>
                      <span className="eyebrow">Introduction</span>
                      <p>{profile.bio || "No introduction added yet."}</p>
                    </div>
                    <div className="ac-admin-profile-tags">
                      {profile.specialties.map((specialty, index) => (
                        <span className="chip" key={`${specialty}-${index}`}>
                          {specialty}
                        </span>
                      ))}
                    </div>
                    <p className="ac-help">
                      Languages:{" "}
                      {profile.languages.join(", ") || "Not provided"}
                    </p>
                    {profile.achievements.length ? (
                      <div>
                        <span className="eyebrow">
                          Self-reported achievements
                        </span>
                        <ul>
                          {profile.achievements.map((achievement, index) => (
                            <li key={index}>{achievement}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {profile.portfolio.length ? (
                      <div>
                        <span className="eyebrow">Previous work</span>
                        <div className="ac-admin-portfolio">
                          {profile.portfolio.map((project, index) => (
                            <div key={index}>
                              {project.image_url ? (
                                <img
                                  src={project.image_url}
                                  alt={project.title}
                                />
                              ) : null}
                              <strong>{project.title}</strong>
                              <p>{project.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {decisionControls("profile", profile.id, "Approve profile")}
                </article>
              ))
            : null}
          {tab === "review"
            ? reviews.map((review) => (
                <article className="panel ac-admin-card" key={review.id}>
                  <div className="ac-admin-card-top">
                    <div>
                      <span className="eyebrow">
                        Completed connection review
                      </span>
                      <h2>{review.reviewer_name || "Network member"}</h2>
                      <p className="muted">
                        Submitted {formatDate(review.created_at)}
                      </p>
                    </div>
                    <span
                      className="ac-review-rating"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {"★".repeat(review.rating)}
                      <span aria-hidden="true">
                        {"☆".repeat(5 - review.rating)}
                      </span>
                    </span>
                  </div>
                  <div className="ac-admin-member-note">
                    <span className="eyebrow">Their experience</span>
                    <p>{review.body}</p>
                  </div>
                  <p className="ac-help ac-review-meta">
                    Recipient member ID: {review.recipient_id}
                    <br />
                    Connection ID: {review.connection_id}
                  </p>
                  {decisionControls("review", review.id, "Publish review")}
                </article>
              ))
            : null}
        </div>
      )}
    </div>
  );
}

export default Admin;
