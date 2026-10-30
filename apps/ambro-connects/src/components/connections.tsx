"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Connection, ConnectionStatus, MeResponse } from "@/lib/types";
import "./member-tools.css";

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

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  pending: "Awaiting reply",
  accepted: "Connected",
  declined: "Declined",
  completed: "Completed",
};

export function Connections() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [tab, setTab] = useState<"incoming" | "outgoing">("outgoing");
  const [busy, setBusy] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [contactConsent, setContactConsent] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async (signal?: AbortSignal, initial = false) => {
    const result = await responseData<MeResponse>(
      await fetch("/api/me", { cache: "no-store", signal }),
    );
    if (!Array.isArray(result.connections) || !("user" in result))
      throw new Error("Your connections could not be loaded.");
    setData(result);
    if (initial && result.membership?.member_type === "china")
      setTab("incoming");
    setError("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal, true)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Your connections could not be loaded.",
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
          : "Your connections could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateConnection(
    id: string,
    status: "accepted" | "declined" | "completed",
  ) {
    if (status === "accepted" && !contactConsent[id]) return;
    setBusy(id);
    setNotice(null);
    try {
      await responseData(
        await fetch("/api/connections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            status,
            ...(status === "accepted" ? { consent: true } : {}),
          }),
        }),
      );
      await load();
      setNotice({
        type: "success",
        text:
          status === "accepted"
            ? "Connection accepted. You can now contact each other by email."
            : status === "completed"
              ? "Work marked as completed. Your connection can now share a review."
              : "The connection request has been declined.",
      });
    } catch (cause) {
      setNotice({
        type: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "The request could not be updated.",
      });
    } finally {
      setBusy("");
    }
  }

  async function submitReview(
    event: FormEvent<HTMLFormElement>,
    connection: Connection,
  ) {
    event.preventDefault();
    setBusy(connection.id);
    setNotice(null);
    try {
      await responseData(
        await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connection_id: connection.id,
            rating,
            body: reviewBody,
          }),
        }),
      );
      await load();
      setReviewId("");
      setReviewBody("");
      setRating(5);
      setNotice({
        type: "success",
        text: "Thank you. Your review has been submitted for moderation before it appears on the member’s profile.",
      });
    } catch (cause) {
      setNotice({
        type: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Your review could not be submitted.",
      });
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <div className="container ac-page">
        <div className="ac-loading" role="status">
          <span className="ac-spinner" />
          Loading your connections…
        </div>
      </div>
    );
  if (error)
    return (
      <div className="container ac-page">
        <div className="panel ac-state" role="alert">
          <span className="eyebrow">Your connections</span>
          <h1>Let’s try that again.</h1>
          <p className="muted">{error}</p>
          <button className="btn btn-dark" onClick={retry}>
            Reload connections
          </button>
        </div>
      </div>
    );
  if (!data?.user)
    return (
      <div className="container ac-page">
        <div className="panel ac-state">
          <span className="eyebrow">A little introduction goes a long way</span>
          <h1>Your people, in one place.</h1>
          <p className="muted">
            Sign in to see your business introductions and connection requests.
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

  const incoming = data.connections.filter(
    (connection) => connection.recipient_id === data.user?.id,
  );
  const outgoing = data.connections.filter(
    (connection) => connection.sender_id === data.user?.id,
  );
  const visible = tab === "incoming" ? incoming : outgoing;
  const pendingCount = data.connections.filter(
    (connection) => connection.status === "pending",
  ).length;
  const activeCount = data.connections.filter(
    (connection) => connection.status === "accepted",
  ).length;
  const completedCount = data.connections.filter(
    (connection) => connection.status === "completed",
  ).length;

  return (
    <div className="container ac-page">
      <div className="ac-page-heading">
        <div className="page-intro">
          <span className="eyebrow">From a hello to what’s next</span>
          <h1>
            Good connections.
            <br />
            Real possibilities.
          </h1>
          <p className="muted">
            Follow your introductions, agree next steps and build something
            together.
          </p>
        </div>
        <Link className="btn btn-dark" href="/discover">
          Explore the network <span aria-hidden="true">↗</span>
        </Link>
      </div>
      {notice ? (
        <div
          className={`ac-notice ac-notice-${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      ) : null}
      <div className="ac-connection-stats" aria-label="Connection overview">
        <div>
          <strong>{pendingCount.toString().padStart(2, "0")}</strong>
          <span>Awaiting a reply</span>
        </div>
        <div>
          <strong>{activeCount.toString().padStart(2, "0")}</strong>
          <span>Open connections</span>
        </div>
        <div>
          <strong>{completedCount.toString().padStart(2, "0")}</strong>
          <span>Completed together</span>
        </div>
      </div>
      <div className="ac-connections-toolbar">
        <div className="ac-tabs" aria-label="Connection direction">
          <button
            id="incoming-tab"
            aria-pressed={tab === "incoming"}
            aria-controls="connections-panel"
            onClick={() => setTab("incoming")}
          >
            Received <span>{incoming.length}</span>
          </button>
          <button
            id="outgoing-tab"
            aria-pressed={tab === "outgoing"}
            aria-controls="connections-panel"
            onClick={() => setTab("outgoing")}
          >
            Sent <span>{outgoing.length}</span>
          </button>
        </div>
        <p className="ac-help">Business starts with a conversation.</p>
      </div>
      <div id="connections-panel" aria-labelledby={`${tab}-tab`}>
        {visible.length === 0 ? (
          <div className="panel ac-connections-empty">
            <div className="ac-empty-symbol" aria-hidden="true">
              ↗
            </div>
            <span className="eyebrow">Room for new possibilities</span>
            <h2>
              {tab === "incoming"
                ? "Your next hello is on its way."
                : "Start with one good introduction."}
            </h2>
            <p className="muted">
              {tab === "incoming"
                ? "Connection requests from the network will appear here. A complete profile makes it easier for people to find the right fit."
                : "Find people in China whose experience matches your plans, then send a thoughtful request."}
            </p>
            <Link
              className="btn btn-dark"
              href={tab === "incoming" ? "/account" : "/discover"}
            >
              {tab === "incoming"
                ? "Complete your profile"
                : "Meet the China network"}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : (
          <div className="ac-connection-list">
            {visible.map((connection) => {
              const isRecipient = connection.recipient_id === data.user?.id;
              const person = isRecipient
                ? connection.sender
                : connection.recipient;
              const name = person?.full_name || "Network member";
              const isBusy = busy === connection.id;
              return (
                <article
                  className="panel ac-connection-card"
                  key={connection.id}
                >
                  <div className="ac-connection-card-heading">
                    <div className="ac-person">
                      <div className="ac-person-avatar">
                        {person?.avatar_url ? (
                          <img src={person.avatar_url} alt="" />
                        ) : (
                          <span>{initials(name)}</span>
                        )}
                      </div>
                      <div>
                        <h2>{name}</h2>
                        <p className="muted">
                          {[person?.company, person?.city]
                            .filter(Boolean)
                            .join(" · ") || "Ambro Connects member"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`ac-status ac-status-${connection.status}`}
                    >
                      {STATUS_LABELS[connection.status]}
                    </span>
                  </div>
                  <div className="ac-connection-message">
                    <span className="eyebrow">
                      {isRecipient ? "Their introduction" : "Your introduction"}
                    </span>
                    <p>{connection.message}</p>
                  </div>
                  <div className="ac-connection-date">
                    {isRecipient ? "Received" : "Sent"}{" "}
                    {formatDate(connection.created_at)}
                  </div>
                  {connection.contact_email ? (
                    <div className="ac-contact-row">
                      <div>
                        <span className="eyebrow">
                          Keep the conversation going
                        </span>
                        <p>Agree the details of your business directly.</p>
                      </div>
                      <a
                        className="btn btn-ghost"
                        href={`mailto:${connection.contact_email}`}
                      >
                        Email {name.split(" ")[0]}{" "}
                        <span aria-hidden="true">↗</span>
                      </a>
                      <span className="ac-contact-email">
                        {connection.contact_email}
                      </span>
                    </div>
                  ) : null}
                  {isRecipient && connection.status === "pending" ? (
                    <div className="ac-connection-actions">
                      <label className="ac-consent">
                        <input
                          type="checkbox"
                          checked={Boolean(contactConsent[connection.id])}
                          onChange={(event) =>
                            setContactConsent((current) => ({
                              ...current,
                              [connection.id]: event.target.checked,
                            }))
                          }
                        />
                        <span>
                          I agree to share my account email with this member
                          when I accept. Their email will also be shared with
                          me. These details are visible only to the two of us.
                        </span>
                      </label>
                      <div className="ac-actions">
                        <button
                          className="btn btn-primary"
                          disabled={
                            Boolean(busy) || !contactConsent[connection.id]
                          }
                          onClick={() =>
                            updateConnection(connection.id, "accepted")
                          }
                        >
                          {isBusy ? "Updating…" : "Accept and share email"}{" "}
                          <span aria-hidden="true">↗</span>
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            updateConnection(connection.id, "declined")
                          }
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {isRecipient && connection.status === "accepted" ? (
                    <div className="ac-connection-actions">
                      <p className="ac-help">
                        Finished working together? Mark this connection complete
                        so your business partner can share a review.
                      </p>
                      <button
                        className="btn btn-dark"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          updateConnection(connection.id, "completed")
                        }
                      >
                        {isBusy ? "Updating…" : "Mark work completed"}{" "}
                        <span aria-hidden="true">✓</span>
                      </button>
                    </div>
                  ) : null}
                  {!isRecipient && connection.status === "pending" ? (
                    <p className="ac-help ac-connection-waiting">
                      Your introduction is with {name.split(" ")[0]}. Their
                      response will appear here.
                    </p>
                  ) : null}
                  {!isRecipient &&
                  connection.status === "completed" &&
                  !connection.reviewed ? (
                    <div className="ac-connection-actions">
                      {reviewId === connection.id ? (
                        <form
                          className="ac-review-form"
                          onSubmit={(event) => submitReview(event, connection)}
                        >
                          <fieldset disabled={Boolean(busy)}>
                            <legend>
                              How was working with {name.split(" ")[0]}?
                            </legend>
                            <label className="field">
                              Your rating
                              <select
                                className="input ac-rating-select"
                                value={rating}
                                onChange={(event) =>
                                  setRating(Number(event.target.value))
                                }
                              >
                                <option value={5}>5 — Excellent</option>
                                <option value={4}>4 — Good</option>
                                <option value={3}>3 — Okay</option>
                                <option value={2}>
                                  2 — Below expectations
                                </option>
                                <option value={1}>1 — Poor</option>
                              </select>
                            </label>
                            <label className="field">
                              Share your experience
                              <textarea
                                className="input"
                                required
                                minLength={10}
                                maxLength={2000}
                                rows={4}
                                value={reviewBody}
                                onChange={(event) =>
                                  setReviewBody(event.target.value)
                                }
                                placeholder="What did you work on? What should someone know about working with this member?"
                              />
                            </label>
                            <p className="ac-help">
                              Reviews are checked by the team before appearing
                              publicly. Share an accurate account of your own
                              experience.
                            </p>
                            <div className="ac-actions">
                              <button className="btn btn-primary" type="submit">
                                {isBusy ? "Submitting…" : "Submit review"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => {
                                  setReviewId("");
                                  setReviewBody("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </fieldset>
                        </form>
                      ) : (
                        <>
                          <p className="ac-help">
                            Your experience can help the next person make a
                            thoughtful choice.
                          </p>
                          <button
                            className="btn btn-dark"
                            disabled={Boolean(busy)}
                            onClick={() => {
                              setReviewId(connection.id);
                              setRating(5);
                              setReviewBody("");
                            }}
                          >
                            Share a review <span aria-hidden="true">☆</span>
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                  {!isRecipient && connection.reviewed ? (
                    <div className="ac-review-sent">
                      <span aria-hidden="true">✓</span> Review submitted for
                      this connection
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Connections;
