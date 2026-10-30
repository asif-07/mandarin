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
  Bookmark,
  Building2,
  BriefcaseBusiness,
  Languages,
  Award,
  Users,
} from "lucide-react";
import { Avatar, publicProfileText } from "./discover";
import type { PublicMember, Review } from "@/lib/types";
import { useMemberSession } from "./member-session";
import "./mobile-directory.css";
import "./social-profile.css";
export function MemberProfile({ id }: { id: string }) {
  const [member, setMember] = useState<PublicMember | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const {
    data: me,
    status: sessionStatus,
    refresh: refreshSession,
  } = useMemberSession();
  const membershipError =
    sessionStatus === "error"
      ? "Your account could not be checked. Try again to continue."
      : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [introduction, setIntroduction] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  useEffect(() => {
    setIntroduction("");
    setEmailConsent(false);
    setSent(false);
    setError("");
  }, [id, me?.user?.id]);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [activeSection, setActiveSection] = useState("profile-about");
  useEffect(() => {
    const updateSection = () => {
      const next = window.location.hash.slice(1);
      if (
        ["profile-about", "profile-experience", "profile-reviews"].includes(
          next,
        )
      )
        setActiveSection(next);
    };
    updateSection();
    window.addEventListener("hashchange", updateSection);
    return () => window.removeEventListener("hashchange", updateSection);
  }, [id]);
  const [saved, setSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  useEffect(() => {
    setSaveNotice("");
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("ambro-saved") || "[]",
      );
      setSaved(Array.isArray(stored) && stored.includes(id));
    } catch {
      setSaved(false);
    }
  }, [id]);
  function toggleSaved() {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("ambro-saved") || "[]",
      );
      const ids = Array.isArray(stored)
        ? stored.filter((value): value is string => typeof value === "string")
        : [];
      const next = ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id];
      localStorage.setItem("ambro-saved", JSON.stringify(next));
      setSaved(next.includes(id));
      setSaveNotice(
        next.includes(id)
          ? "Saved on this device."
          : "Removed from saved profiles.",
      );
    } catch {
      setSaveNotice(
        "Your browser couldn’t save this profile. Please try again.",
      );
    }
  }
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
    setError("");
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
      sessionStatus !== "authenticated" ||
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
      const expectedUserId = me.user?.id;
      const currentSession = await refreshSession();
      if (!expectedUserId || currentSession?.user?.id !== expectedUserId)
        throw new Error(
          "Your signed-in account changed. Check your account before sending.",
        );
      if (
        !currentSession.membership?.active ||
        currentSession.membership.member_type !== "global"
      )
        throw new Error(
          "An active Global membership is needed to send an introduction.",
        );
      const r = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: id,
          expected_user_id: expectedUserId,
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
    sessionStatus === "authenticated" &&
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
        label: "Demo profile",
        note: "Fictional example. This profile cannot receive requests.",
        disabled: true,
      }
    : sessionStatus === "loading"
      ? { href: "", label: "Checking account…", note: "", disabled: true }
      : ownProfile
        ? {
            href: "/account?edit=intro",
            label: "Edit profile",
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
                    label: "Connect",
                    note: "Start with your plans. Email is shared only after mutual consent.",
                    disabled: false,
                  }
                : {
                    href: me?.user
                      ? "/account?tab=membership"
                      : "/join?type=global",
                    label: me?.user
                      ? "View my membership"
                      : "Join Global to connect",
                    note: "An active Global membership lets you send introductions.",
                    disabled: false,
                  };
  return (
    <div className="mobile-member-page social-profile-page">
      <div className="container profile-back-row social-back-row">
        <Link className="text-link" href="/discover">
          <ArrowLeft size={18} /> Discover
        </Link>
        {member.is_demo ? (
          <span className="demo-label">Fictional demo profile</span>
        ) : (
          <span className="social-profile-caption">Member profile</span>
        )}
      </div>
      <div className="container profile-layout">
        <div className="social-profile-main">
          <section
            className="panel profile-hero social-identity-card"
            aria-label={`${name}’s profile`}
          >
            <div className="profile-cover">
              {member.cover_url ? (
                <img src={member.cover_url} alt="" />
              ) : (
                <div className="social-cover-pattern" aria-hidden="true" />
              )}
            </div>
            <div className="profile-overview">
              <div className="social-identity-top">
                <Avatar member={member} />
                <span
                  className={`member-network-badge member-network-${member.member_type}`}
                >
                  {isGlobal ? "Global connect" : "China connect"}
                </span>
              </div>
              <h1>{name}</h1>
              {member.company ? (
                <p className="social-headline">
                  <Building2 size={17} /> {publicProfileText(member.company)}
                </p>
              ) : null}
              <p className="member-meta">
                <MapPin size={16} />{" "}
                {publicProfileText(member.city) || "Location not shared"}
              </p>
              {member.specialties.length ? (
                <p className="social-specialty-line">
                  {member.specialties
                    .slice(0, 3)
                    .map(publicProfileText)
                    .join(" · ")}
                </p>
              ) : null}
              {!member.is_demo && member.verified ? (
                <p className="social-reviewed">
                  <ShieldCheck size={15} /> Profile reviewed by the team
                </p>
              ) : null}
              <div className="social-profile-actions">
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
                {!ownProfile ? (
                  <button
                    type="button"
                    className="btn btn-ghost social-save-profile"
                    aria-pressed={saved}
                    onClick={toggleSaved}
                    aria-label={saved ? `Unsave ${name}` : `Save ${name}`}
                  >
                    <Bookmark
                      size={18}
                      fill={saved ? "currentColor" : "none"}
                    />
                    <span>{saved ? "Saved" : "Save"}</span>
                  </button>
                ) : null}
              </div>
              <p className="social-action-context">{primaryAction.note}</p>
              <div
                className="social-save-notice"
                role="status"
                aria-live="polite"
              >
                {saveNotice}
              </div>
              {!member.is_demo ? (
                <div className="social-profile-metrics">
                  <a
                    href="#profile-reviews"
                    aria-current={
                      activeSection === "profile-reviews"
                        ? "location"
                        : undefined
                    }
                    onClick={() => setActiveSection("profile-reviews")}
                  >
                    <Star size={17} />
                    <span>
                      <strong>
                        {member.rating
                          ? `${member.rating} / 5`
                          : "No rating yet"}
                      </strong>
                      {member.review_count}{" "}
                      {member.review_count === 1 ? "review" : "reviews"}
                    </span>
                  </a>
                  <div>
                    <Users size={17} />
                    <span>
                      <strong>{member.completed_connections}</strong>Completed
                      connections
                    </span>
                  </div>
                </div>
              ) : null}
              <nav className="profile-section-nav" aria-label="On this profile">
                <a
                  href="#profile-about"
                  aria-current={
                    activeSection === "profile-about" ? "location" : undefined
                  }
                  onClick={() => setActiveSection("profile-about")}
                >
                  About
                </a>
                <a
                  href="#profile-experience"
                  aria-current={
                    activeSection === "profile-experience"
                      ? "location"
                      : undefined
                  }
                  onClick={() => setActiveSection("profile-experience")}
                >
                  Work
                </a>
                <a
                  href="#profile-reviews"
                  aria-current={
                    activeSection === "profile-reviews" ? "location" : undefined
                  }
                  onClick={() => setActiveSection("profile-reviews")}
                >
                  Reviews
                </a>
              </nav>
            </div>
          </section>
          <section
            className="panel social-content-card profile-scroll-target"
            id="profile-about"
            tabIndex={-1}
            aria-labelledby="profile-about-heading"
          >
            <h2 id="profile-about-heading">About</h2>
            <p className="social-bio">
              {publicProfileText(member.bio) ||
                "This member is still adding their story."}
            </p>
          </section>
          <section
            className="panel social-content-card"
            aria-labelledby="profile-expertise-heading"
          >
            <h2 id="profile-expertise-heading">
              <BriefcaseBusiness size={19} />{" "}
              {isGlobal ? "Interests & expertise" : "Expertise"}
            </h2>
            {member.specialties.length ? (
              <div className="member-tags">
                {member.specialties.map((item) => (
                  <span className="chip" key={item}>
                    {publicProfileText(item)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">Specialties haven’t been added yet.</p>
            )}
            {member.languages.length ? (
              <div className="social-languages">
                <h3>
                  <Languages size={17} /> Languages
                </h3>
                <p>{member.languages.map(publicProfileText).join(" · ")}</p>
              </div>
            ) : null}
          </section>
          <section
            className="panel profile-work social-content-card profile-scroll-target"
            id="profile-experience"
            tabIndex={-1}
            aria-labelledby="profile-experience-heading"
          >
            <div className="social-section-heading">
              <h2 id="profile-experience-heading">Work & experience</h2>
              <span>
                {member.portfolio.length}{" "}
                {member.portfolio.length === 1 ? "project" : "projects"}
              </span>
            </div>
            {member.is_demo ? (
              <p className="social-section-note">
                Fictional projects, shown as examples.
              </p>
            ) : (
              <p className="social-section-note">
                Projects shared by this member.
              </p>
            )}
            {member.portfolio.length ? (
              <div className="portfolio-grid">
                {member.portfolio.map((project, index) => (
                  <article
                    key={`${project.title}-${index}`}
                    className="portfolio-card"
                  >
                    {project.image_url ? (
                      <img
                        src={project.image_url}
                        alt={publicProfileText(project.title)}
                        loading="lazy"
                      />
                    ) : null}
                    <div>
                      <h3>{publicProfileText(project.title)}</h3>
                      <p>{publicProfileText(project.description)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="review-empty">
                No projects shared yet. You can ask about their experience when
                you connect.
              </p>
            )}
          </section>
          {member.achievements.length ? (
            <section
              className="panel social-content-card"
              aria-labelledby="profile-achievements-heading"
            >
              <h2 id="profile-achievements-heading">
                <Award size={19} /> Highlights
              </h2>
              <ul className="achievement-list">
                {member.achievements.map((achievement) => (
                  <li key={achievement}>
                    <Check size={16} />
                    {publicProfileText(achievement)}
                  </li>
                ))}
              </ul>
              <p className="social-section-note">
                {member.is_demo
                  ? "Illustrative demo content."
                  : "Achievements are shared by this member."}
              </p>
            </section>
          ) : null}
          <section
            className="panel profile-reviews social-content-card profile-scroll-target"
            id="profile-reviews"
            tabIndex={-1}
            aria-labelledby="profile-reviews-heading"
          >
            <div className="social-section-heading">
              <h2 id="profile-reviews-heading">Member reviews</h2>
              {visibleReviews.length ? (
                <span>
                  <Star size={15} /> {member.rating} / 5
                </span>
              ) : null}
            </div>
            {visibleReviews.length ? (
              visibleReviews.map((review) => (
                <article className="review" key={review.id}>
                  <div>
                    <strong>
                      {publicProfileText(
                        review.reviewer_name || "Global member",
                      )}
                    </strong>
                    <span
                      className="stars"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {Array.from({ length: review.rating }, (_, index) => (
                        <Star key={index} size={13} fill="currentColor" />
                      ))}
                    </span>
                  </div>
                  <p>{publicProfileText(review.body)}</p>
                  <small className="muted">
                    Completed connection ·{" "}
                    {new Date(review.created_at).toLocaleDateString("en", {
                      month: "short",
                      year: "numeric",
                    })}
                  </small>
                </article>
              ))
            ) : (
              <p className="review-empty">
                {member.is_demo
                  ? "Demo profiles have no real reviews. Real member reviews follow a completed connection and team moderation."
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
          <h2 id="profile-introduction-heading">
            {member.is_demo ? "About this demo" : "Connect with " + firstName}
          </h2>
          <p>
            {member.is_demo
              ? "See how a member can introduce their interests, experience and work to the network."
              : `Introduce yourself and share what you’d like to work on together.`}
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
          ) : sessionStatus === "loading" ? (
            <p className="profile-view-only" role="status">
              Checking your account…
            </p>
          ) : membershipError ? (
            <div className="profile-view-only" role="alert">
              <p>{membershipError}</p>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void refreshSession()}
              >
                Try again
              </button>
            </div>
          ) : ownProfile ? (
            <div className="profile-view-only">
              <p>
                This is your public profile. Manage the details you share from
                My space.
              </p>
              <Link className="btn btn-ghost" href="/account?edit=intro">
                Edit profile <ArrowUpRight size={16} />
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
                    value={introduction}
                    onChange={(event) => setIntroduction(event.target.value)}
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
                  <input
                    name="consent"
                    type="checkbox"
                    required
                    checked={emailConsent}
                    onChange={(event) => setEmailConsent(event.target.checked)}
                  />
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
                href={
                  me?.user ? "/account?tab=membership" : "/join?type=global"
                }
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
