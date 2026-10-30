"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import {
  MapPin,
  ArrowUpRight,
  ShieldCheck,
  Star,
  Globe2,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Avatar, publicProfileText } from "./discover";
import type { PublicMember, Review, MeResponse } from "@/lib/types";
import "./mobile-directory.css";
export function MemberProfile({ id }: { id: string }) {
  const [member, setMember] = useState<PublicMember | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [membershipError, setMembershipError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const requestPending = useRef(false);
  const requestFeedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (busy || (!sent && !error) || !requestFeedback.current) return;
    requestFeedback.current.focus({ preventScroll: true });
    requestFeedback.current.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [busy, sent, error]);
  useEffect(() => {
    setLoading(true);
    setMember(null);
    setReviews([]);
    setMe(null);
    setError("");
    setMembershipError("");
    setSent(false);
    const c = new AbortController();
    Promise.all([
      fetch(`/api/members/${encodeURIComponent(id)}`, {
        signal: c.signal,
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error || "This profile is currently unavailable.");
        if (
          !d.member ||
          typeof d.member.full_name !== "string" ||
          !Array.isArray(d.reviews)
        )
          throw new Error(
            "This profile could not be loaded. Please try again.",
          );
        setMember(d.member);
        setReviews(d.reviews || []);
      }),
      fetch("/api/me", { signal: c.signal })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok)
            throw new Error(data.error || "Could not load your membership.");
          setMe(data);
        })
        .catch((e) => {
          if (e.name !== "AbortError")
            setMembershipError(
              "Your membership could not be loaded. Please refresh to try again.",
            );
        }),
    ])
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [id, loadAttempt]);
  async function connect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || requestPending.current) return;
    if (
      !member ||
      member.is_demo ||
      !me?.membership?.active ||
      me.membership.member_type !== "global" ||
      me.user?.id === member.id
    ) {
      setError(
        "An active Global membership is needed to introduce yourself to a real member.",
      );
      return;
    }
    const f = new FormData(e.currentTarget);
    requestPending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: id,
          message: f.get("message"),
          consent: f.get("consent") === "on",
        }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(d.error || "Could not send your introduction.");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="container loading-state" role="status">
        Getting to know your next connection…
      </div>
    );
  if (!member)
    return (
      <div className="container section">
        <div className="empty-state">
          <Globe2 size={35} />
          <h1 style={{ fontSize: 30 }}>This connection is taking a moment.</h1>
          <p>
            {error ||
              "The member may be updating their profile, or their membership may be inactive."}
          </p>
          <div className="profile-unavailable-actions">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Try again
            </button>
            <Link href="/discover" className="btn btn-dark">
              Explore the network <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </div>
    );
  const eligible =
    me?.membership?.active &&
    me.membership.member_type === "global" &&
    !member.is_demo &&
    me.user?.id !== member.id;
  const ownProfile = me?.user?.id === member.id;
  const existingConnection = me?.connections.find(
    (connection) =>
      (connection.status === "pending" || connection.status === "accepted") &&
      (connection.sender_id === member.id ||
        connection.recipient_id === member.id),
  );
  const name = publicProfileText(member.full_name);
  const firstName = name.split(" ")[0];
  const isGlobal = member.member_type === "global";
  const visibleReviews = member.is_demo ? [] : reviews;
  const primaryAction = member.is_demo
    ? {
        href: "",
        label: "Demo · introductions unavailable",
        note: "Fictional example. This profile cannot receive requests.",
        disabled: true,
      }
    : ownProfile
      ? {
          href: "/account",
          label: "Edit my profile",
          note: "Manage the details you share with the network.",
          disabled: false,
        }
      : sent || existingConnection
        ? {
            href: "/connections",
            label: "View this connection",
            note:
              existingConnection?.status === "accepted"
                ? "You’re connected. Continue the conversation privately."
                : "Follow your introduction and its response.",
            disabled: false,
          }
        : me?.membership?.member_type === "china"
          ? {
              href: "/connections",
              label: "View received requests",
              note: "You can explore profiles and receive Global introductions.",
              disabled: false,
            }
          : membershipError
            ? {
                href: "#profile-introduction",
                label: "Check my access",
                note: "Your membership could not be checked. Try again below.",
                disabled: false,
              }
            : eligible
              ? {
                  href: "#profile-introduction",
                  label: `Introduce yourself to ${firstName}`,
                  note: "Start with your plans. Email is shared only after mutual consent.",
                  disabled: false,
                }
              : {
                  href: me?.user ? "/account" : "/join?type=global",
                  label: me?.user
                    ? "View my membership"
                    : "Join Global to connect",
                  note: "An active Global membership lets you send introductions.",
                  disabled: false,
                };
  return (
    <div className="mobile-member-page">
      <div className="container profile-back-row">
        <Link className="text-link" href="/discover">
          <ArrowLeft size={16} /> Back to your network
        </Link>
        {member.is_demo ? (
          <div className="network-demo-notice profile-demo-notice">
            <span className="demo-label">Demo profile</span>
            <p>
              Fictional {isGlobal ? "Global" : "China"} profile. Images and
              experience are illustrative; introductions are disabled.
            </p>
          </div>
        ) : null}
      </div>
      <div className="container profile-layout">
        <div>
          <section className="panel profile-hero">
            <div className="profile-cover">
              {member.cover_url && <img src={member.cover_url} alt="" />}
            </div>
            <div className="profile-overview">
              <Avatar member={member} />
              <h1>{name}</h1>
              <p className="member-meta">
                <MapPin size={14} />
                {publicProfileText(member.city)}
                {member.company && <> · {publicProfileText(member.company)}</>}
              </p>
              <div className="profile-primary-action">
                {primaryAction.disabled ? (
                  <button type="button" className="btn btn-ghost" disabled>
                    {primaryAction.label}
                  </button>
                ) : (
                  <Link className="btn btn-primary" href={primaryAction.href}>
                    {primaryAction.label}
                    <ArrowUpRight size={17} />
                  </Link>
                )}
                <p>{primaryAction.note}</p>
              </div>
              <nav className="profile-section-nav" aria-label="On this profile">
                <a href="#profile-about">About</a>
                <a href="#profile-experience">Experience</a>
                <a href="#profile-reviews">Reviews</a>
                {eligible && !sent && !existingConnection ? (
                  <a href="#profile-introduction">
                    Introduce yourself <ArrowUpRight size={13} />
                  </a>
                ) : null}
              </nav>
              <div className="profile-badges" style={{ marginTop: 18 }}>
                <span
                  className={`member-network-badge member-network-${member.member_type}`}
                >
                  {isGlobal ? "Global connect" : "China connect"}
                </span>
                {member.is_demo ? (
                  <span className="demo-label">Demo profile</span>
                ) : member.verified ? (
                  <span className="chip">
                    <ShieldCheck size={13} /> Profile reviewed
                  </span>
                ) : null}
                {member.languages.map((l) => (
                  <span key={l} className="chip">
                    {publicProfileText(l)}
                  </span>
                ))}
              </div>
              {member.is_demo ? (
                <div className="profile-demo-stats">
                  Sample profile · no real reviews or completed connections
                </div>
              ) : (
                <div className="profile-stats">
                  <div>
                    <strong>
                      {member.rating ? `${member.rating} / 5` : "New here"}
                    </strong>
                    {member.review_count
                      ? `${member.review_count} member reviews`
                      : "No reviews yet"}
                  </div>
                  <div>
                    <strong>{member.completed_connections}</strong>Completed
                    connections
                  </div>
                </div>
              )}
              <div
                className="profile-about profile-scroll-target"
                id="profile-about"
                tabIndex={-1}
              >
                <h2>A little about me.</h2>
                <p>{publicProfileText(member.bio)}</p>
              </div>
              <div className="profile-about">
                <h2>
                  {isGlobal ? "Interests & experience." : "Where I can help."}
                </h2>
                <div className="member-tags">
                  {member.specialties.map((s) => (
                    <span className="chip" key={s}>
                      {publicProfileText(s)}
                    </span>
                  ))}
                </div>
              </div>
              {member.achievements.length > 0 && (
                <div className="profile-about">
                  <h2>Milestones & achievements.</h2>
                  <p
                    className="muted"
                    style={{ fontSize: 11, marginBottom: 13 }}
                  >
                    {member.is_demo
                      ? "Illustrative examples for this demo profile."
                      : "Shared by this member."}
                  </p>
                  <ul className="achievement-list">
                    {member.achievements.map((a) => (
                      <li key={a}>
                        <Check size={16} />
                        {publicProfileText(a)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
          <section
            className="panel profile-work profile-scroll-target"
            id="profile-experience"
            tabIndex={-1}
            aria-labelledby="profile-experience-heading"
          >
            <h2 id="profile-experience-heading">
              {isGlobal
                ? "Projects & previous experience."
                : "A glimpse of my work."}
            </h2>
            <p className="muted" style={{ fontSize: 11, marginBottom: 20 }}>
              {member.is_demo
                ? "These projects are fictional examples of how members can share their work."
                : "Portfolio and project details are provided by the member."}
            </p>
            {member.portfolio.length ? (
              <div className="portfolio-grid">
                {member.portfolio.map((p, i) => (
                  <article key={`${p.title}-${i}`} className="portfolio-card">
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={publicProfileText(p.title)}
                        loading="lazy"
                      />
                    )}
                    <div>
                      <h3>{publicProfileText(p.title)}</h3>
                      <p>{publicProfileText(p.description)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="review-empty">
                More of their story is on the way. Ask about their experience
                when you connect.
              </p>
            )}
          </section>
          <section
            className="panel profile-reviews profile-scroll-target"
            id="profile-reviews"
            tabIndex={-1}
            aria-labelledby="profile-reviews-heading"
          >
            <h2 id="profile-reviews-heading">
              {member.is_demo
                ? "How reviews will work."
                : "From real connections."}
            </h2>
            {visibleReviews.length ? (
              visibleReviews.map((r) => (
                <article className="review" key={r.id}>
                  <div>
                    <strong>
                      {publicProfileText(r.reviewer_name || "Global member")}
                    </strong>
                    <span
                      className="stars"
                      aria-label={`${r.rating} out of 5 stars`}
                    >
                      {Array.from({ length: r.rating }, (_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </span>
                  </div>
                  <p>{publicProfileText(r.body)}</p>
                  <small className="muted">
                    Completed connection ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en", {
                      month: "short",
                      year: "numeric",
                    })}
                  </small>
                </article>
              ))
            ) : (
              <p className="review-empty">
                {member.is_demo
                  ? "Demo profiles have no member reviews. On real profiles, reviews appear only after a completed connection and team moderation."
                  : "No reviews yet. Reviews appear after a completed connection and team review."}
              </p>
            )}
          </section>
        </div>
        <aside
          className="panel profile-sidebar profile-scroll-target"
          id="profile-introduction"
          tabIndex={-1}
          aria-labelledby="profile-introduction-heading"
        >
          <p className="eyebrow">
            {member.is_demo
              ? "EXPLORE THE POSSIBILITIES"
              : "START WITH A HELLO"}
          </p>
          <h2 id="profile-introduction-heading" style={{ marginTop: 12 }}>
            {member.is_demo
              ? "A preview of a connection."
              : isGlobal
                ? "A shared ambition?"
                : "Something in common?"}
          </h2>
          <p>
            {member.is_demo
              ? "See how a member can introduce their interests, experience and work to the network."
              : `Tell ${firstName} what you have in mind. A specific introduction goes a long way.`}
          </p>
          {member.is_demo ? (
            <div className="profile-demo-action">
              <button className="btn btn-ghost" type="button" disabled>
                Introductions unavailable
              </button>
              <p>
                This is a demo profile, not a real member. You can send
                introductions to eligible real members after activating a Global
                membership.
              </p>
              <Link className="text-link" href="/discover">
                Explore the network <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : ownProfile ? (
            <div className="profile-view-only">
              <p>
                This is your public profile. Manage the details you share from
                My space.
              </p>
              <Link className="btn btn-ghost" href="/account">
                Edit my profile <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : sent || existingConnection ? (
            <div
              ref={requestFeedback}
              tabIndex={-1}
              className="status success profile-request-feedback"
              role="status"
              style={{ marginTop: 20 }}
            >
              <strong>
                {sent
                  ? "Your introduction has been sent."
                  : existingConnection?.status === "pending"
                    ? "There’s already an introduction here."
                    : "You’ve already made a connection."}
              </strong>
              <p>
                Follow its status in Connections. Email details are shared only
                after both people agree.
              </p>
              <Link className="text-link" href="/connections">
                View my connections <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : me?.membership?.member_type === "china" ? (
            <div className="profile-view-only">
              <p>
                You can explore every profile. Global members start
                introductions; as a China member, you can receive and respond to
                their requests.
              </p>
              <Link className="btn btn-ghost" href="/connections">
                View received requests <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : membershipError ? (
            <div
              className="status error"
              role="alert"
              style={{ marginTop: 20 }}
            >
              {membershipError}
              <button
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                Try again
              </button>
            </div>
          ) : eligible ? (
            <form onSubmit={connect} aria-busy={busy}>
              <fieldset
                className="profile-introduction-fields"
                disabled={busy}
                aria-label="Your introduction"
              >
                <label className="field">
                  Your introduction
                  <textarea
                    name="message"
                    id="introduction-message"
                    aria-describedby="introduction-guidance"
                    required
                    minLength={10}
                    maxLength={2000}
                    placeholder="What are you planning, where and when? How could you work together?"
                  />
                </label>
                <p id="introduction-guidance" className="introduction-guidance">
                  Include your plans, timing and how you hope to work together.
                  At least 10 characters.
                </p>
                <label className="check-label">
                  <input name="consent" type="checkbox" required />
                  <span>
                    I agree to share my account email with this member if they
                    accept my request.
                  </span>
                </label>
                {error && (
                  <div
                    ref={requestFeedback}
                    tabIndex={-1}
                    className="status error profile-request-feedback"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "Sending…" : "Send an introduction"}
                  <ArrowUpRight size={16} />
                </button>
              </fieldset>
            </form>
          ) : (
            <>
              <Link
                href={me?.user ? "/account" : "/join?type=global"}
                className="btn btn-primary"
              >
                {me?.user ? "View my membership" : "Join Global to connect"}
                <ArrowUpRight size={16} />
              </Link>
              <p style={{ fontSize: 10, marginTop: 15 }}>
                An active Global membership is needed to send introductions to
                China or Global members.
              </p>
            </>
          )}
          <p className="profile-trust-note">
            <ShieldCheck size={16} />{" "}
            {member.is_demo
              ? "Demo content is illustrative and does not represent a verified member or business."
              : "Email details remain private until both people agree. Profile review is not a guarantee of business results."}
          </p>
        </aside>
      </div>
    </div>
  );
}
