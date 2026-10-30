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
import { Avatar, publicProfileText } from "./discover";
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
  return (
    <>
      <div className="container" style={{ paddingTop: 24 }}>
        <Link className="text-link" href="/discover">
          <ArrowLeft size={16} /> Back to your network
        </Link>
        {member.is_demo ? (
          <div className="network-demo-notice profile-demo-notice">
            <span className="demo-label">Demo profile</span>
            <p>
              This is a fictional example of an{" "}
              {isGlobal ? "Ambro Connect Global" : "Ambro Connect China"}{" "}
              profile. Images, projects and experience are illustrative. This
              profile cannot receive introductions.
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
              <div className="profile-about">
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
          <section className="panel profile-work">
            <h2>
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
          <section className="panel profile-reviews">
            <h2>
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
        <aside className="panel profile-sidebar">
          <p className="eyebrow">
            {member.is_demo
              ? "EXPLORE THE POSSIBILITIES"
              : "START WITH A HELLO"}
          </p>
          <h2 style={{ marginTop: 12 }}>
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
              className="status success"
              role="status"
              style={{ marginTop: 20 }}
            >
              <strong>
                {sent || existingConnection?.status === "pending"
                  ? "There’s already an introduction here."
                  : existingConnection?.status === "declined"
                    ? "Your earlier introduction was declined."
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
    </>
  );
}
