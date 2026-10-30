"use client";
import { useState, useEffect, type FormEvent } from "react";
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
import { Avatar } from "./discover";
import type { PublicMember, Review, MeResponse } from "@/lib/types";
export function MemberProfile({ id }: { id: string }) {
  const [member, setMember] = useState<PublicMember | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [membershipError, setMembershipError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    Promise.all([
      fetch(`/api/members/${encodeURIComponent(id)}`, {
        signal: c.signal,
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error || "This profile is currently unavailable.");
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
  }, [id]);
  async function connect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
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
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="container loading-state">
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
          <Link href="/discover" className="btn btn-dark">
            Explore the network <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    );
  const eligible =
    me?.membership?.active && me.membership.member_type === "global";
  return (
    <>
      <div className="container" style={{ paddingTop: 24 }}>
        <Link className="text-link" href="/discover">
          <ArrowLeft size={16} /> Back to your network
        </Link>
      </div>
      <div className="container profile-layout">
        <div>
          <section className="panel profile-hero">
            <div className="profile-cover">
              {member.cover_url && <img src={member.cover_url} alt="" />}
            </div>
            <div className="profile-overview">
              <Avatar member={member} />
              <h1>{member.full_name}</h1>
              <p className="member-meta">
                <MapPin size={14} />
                {member.city}
                {member.company && <> · {member.company}</>}
              </p>
              <div className="profile-badges" style={{ marginTop: 18 }}>
                <span className="chip">
                  <ShieldCheck size={13} /> Profile reviewed
                </span>
                {member.languages.map((l) => (
                  <span key={l} className="chip">
                    {l}
                  </span>
                ))}
              </div>
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
              <div className="profile-about">
                <h2>A little about me.</h2>
                <p>{member.bio}</p>
              </div>
              <div className="profile-about">
                <h2>Where I can help.</h2>
                <div className="member-tags">
                  {member.specialties.map((s) => (
                    <span className="chip" key={s}>
                      {s}
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
                    Shared by this member.
                  </p>
                  <ul className="achievement-list">
                    {member.achievements.map((a) => (
                      <li key={a}>
                        <Check size={16} />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
          <section className="panel profile-work">
            <h2>A glimpse of my work.</h2>
            <p className="muted" style={{ fontSize: 11, marginBottom: 20 }}>
              Portfolio and project details are provided by the member.
            </p>
            {member.portfolio.length ? (
              <div className="portfolio-grid">
                {member.portfolio.map((p, i) => (
                  <article key={`${p.title}-${i}`} className="portfolio-card">
                    {p.image_url && (
                      <img src={p.image_url} alt={p.title} loading="lazy" />
                    )}
                    <div>
                      <h3>{p.title}</h3>
                      <p>{p.description}</p>
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
          <section className="panel profile-reviews">
            <h2>From real connections.</h2>
            {reviews.length ? (
              reviews.map((r) => (
                <article className="review" key={r.id}>
                  <div>
                    <strong>{r.reviewer_name || "Global member"}</strong>
                    <span
                      className="stars"
                      aria-label={`${r.rating} out of 5 stars`}
                    >
                      {Array.from({ length: r.rating }, (_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </span>
                  </div>
                  <p>{r.body}</p>
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
                No reviews yet. Reviews appear after a completed connection and
                team review.
              </p>
            )}
          </section>
        </div>
        <aside className="panel profile-sidebar">
          <p className="eyebrow">START WITH A HELLO</p>
          <h2 style={{ marginTop: 12 }}>Something in common?</h2>
          <p>
            Tell {member.full_name.split(" ")[0]} what you have in mind. A
            specific introduction goes a long way.
          </p>
          {sent ? (
            <div
              className="status success"
              role="status"
              style={{ marginTop: 20 }}
            >
              <strong>Your introduction is on its way.</strong>
              <p>
                Follow its status in Connections. Email details are shared if it
                is accepted.
              </p>
              <Link className="text-link" href="/connections">
                View my connections <ArrowUpRight size={16} />
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
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : eligible ? (
            <form onSubmit={connect}>
              <label className="field">
                Your introduction
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="What are you planning, where and when? How could you work together?"
                />
              </label>
              <label className="check-label">
                <input name="consent" type="checkbox" required />
                <span>
                  I agree to share my account email with this member if they
                  accept my request.
                </span>
              </label>
              {error && (
                <div className="status error" role="alert">
                  {error}
                </div>
              )}
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Sending…" : "Send an introduction"}
                <ArrowUpRight size={16} />
              </button>
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
                {me?.membership?.member_type === "china"
                  ? "China members receive introductions from Global members."
                  : "An active Global membership is needed to send connection requests."}
              </p>
            </>
          )}
          <p className="profile-trust-note">
            <ShieldCheck size={16} /> Email details remain private until both
            people agree. Profile review is not a guarantee of business results.
          </p>
        </aside>
      </div>
    </>
  );
}
