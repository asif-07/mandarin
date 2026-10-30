"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { ArrowRightLeft, ArrowUpRight } from "lucide-react";
import type { Membership, Plan } from "@/lib/types";
import "./membership-card.css";

export type MembershipCardProps = {
  memberName: string;
  memberId: string;
  joinedAt: string;
  membership: Membership;
};

function dateValue(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function cardDate(value: string | undefined, joined = false) {
  const date = dateValue(value);
  return date
    ? new Intl.DateTimeFormat("en", {
        ...(joined ? {} : { day: "2-digit" as const }),
        month: "short",
        year: "numeric",
      }).format(date)
    : null;
}

function membershipCardStatus(membership: Membership, now: number) {
  const current = membership.current;
  const start = dateValue(current?.starts_at)?.getTime();
  const end = dateValue(current?.expires_at)?.getTime();
  const validPeriod =
    start !== undefined && end !== undefined && start <= now && end > now;
  if (
    membership.active &&
    membership.moderation_status === "approved" &&
    validPeriod
  )
    return { label: "Active", tone: "active" };
  if (membership.moderation_status === "suspended")
    return { label: "Access suspended", tone: "suspended" };
  if (current && membership.moderation_status === "pending")
    return { label: "Profile in review", tone: "pending" };
  if (current && membership.moderation_status === "rejected")
    return { label: "Profile update needed", tone: "pending" };
  if (
    !current &&
    membership.requests.some((request) => request.status === "pending")
  )
    return { label: "Verification pending", tone: "pending" };
  if (current && validPeriod)
    return { label: "Access pending", tone: "pending" };
  return { label: "No active membership", tone: "inactive" };
}

function planLabel(plan: Plan) {
  return plan === "china_yearly"
    ? "China · annual"
    : plan === "trip_year"
      ? "Trip benefit · 1 year"
      : "Global · monthly";
}

function Engraving() {
  return (
    <svg
      className="membership-card-engraving"
      viewBox="0 0 320 320"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <circle cx="160" cy="160" r="143" />
      <circle cx="160" cy="160" r="137" />
      <circle cx="160" cy="160" r="131" />
      {Array.from({ length: 28 }, (_, index) => (
        <ellipse
          key={index}
          cx="160"
          cy="160"
          rx="122"
          ry="43"
          transform={`rotate(${index * (180 / 28)} 160 160)`}
        />
      ))}
      <circle cx="160" cy="160" r="34" />
      <circle cx="160" cy="160" r="29" />
    </svg>
  );
}

export function MembershipCard({
  memberName,
  memberId,
  joinedAt,
  membership,
}: MembershipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const canTilt = useRef(false);
  const uniqueId = useId();
  const facesId = `${uniqueId}-membership-faces`;
  const captionId = `${uniqueId}-membership-caption`;
  const isChina = membership.member_type === "china";
  const name =
    memberName.trim().replace(/\s+/g, " ") || "Ambro Connects member";
  const suffix = memberId
    .replace(/[^a-z0-9]/gi, "")
    .slice(-12)
    .toUpperCase();
  const reference = suffix
    ? `AC-${isChina ? "C" : "G"}-${suffix}`
    : "Not available";
  const status = membershipCardStatus(membership, Date.now());
  const expiry = cardDate(membership.current?.expires_at);
  const starts = cardDate(membership.current?.starts_at);
  const joined = cardDate(joinedAt, true);
  const selectedPlan =
    membership.current?.plan ||
    membership.requests.find((request) => request.status === "pending")?.plan ||
    membership.preferred_plan;
  const review =
    membership.moderation_status === "approved"
      ? "Approved"
      : membership.moderation_status === "pending"
        ? "Awaiting review"
        : membership.moderation_status === "rejected"
          ? "Update needed"
          : "Suspended";

  function resetTilt() {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    scene.current?.style.setProperty("--card-tilt-x", "0deg");
    scene.current?.style.setProperty("--card-tilt-y", "0deg");
    scene.current?.style.setProperty("--card-light-x", "50%");
    scene.current?.style.setProperty("--card-light-y", "40%");
  }

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      canTilt.current = finePointer.matches && !reducedMotion.matches;
      if (!canTilt.current) resetTilt();
    };
    update();
    finePointer.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame.current);
      finePointer.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  function tiltCard(event: PointerEvent<HTMLDivElement>) {
    if (!canTilt.current || event.pointerType !== "mouse") return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const element = scene.current;
      if (!element || !canTilt.current) return;
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = Math.max(
        -0.5,
        Math.min(0.5, (pointer.current.x - bounds.left) / bounds.width - 0.5),
      );
      const y = Math.max(
        -0.5,
        Math.min(0.5, (pointer.current.y - bounds.top) / bounds.height - 0.5),
      );
      element.style.setProperty("--card-tilt-x", `${(-y * 9).toFixed(2)}deg`);
      element.style.setProperty("--card-tilt-y", `${(x * 11).toFixed(2)}deg`);
      element.style.setProperty(
        "--card-light-x",
        `${((x + 0.5) * 100).toFixed(1)}%`,
      );
      element.style.setProperty(
        "--card-light-y",
        `${((y + 0.5) * 100).toFixed(1)}%`,
      );
    });
  }

  const flip = () => setFlipped((current) => !current);

  return (
    <section
      className={`membership-wallet-stage membership-wallet-${isChina ? "china" : "global"}`}
      aria-label={`Your Ambro Connect ${isChina ? "China" : "Global"} member card`}
    >
      <div
        className="membership-card-scene"
        ref={scene}
        onPointerMove={tiltCard}
        onPointerLeave={resetTilt}
        onPointerCancel={resetTilt}
      >
        <div className="membership-card-reveal">
          <div className="membership-card-tilt">
            <div
              className={`membership-card-turn ${flipped ? "is-flipped" : ""}`}
              id={facesId}
            >
              <div
                className="membership-card-face membership-card-front"
                aria-hidden={flipped}
                inert={flipped || undefined}
              >
                <Engraving />
                <span
                  className="membership-card-etched-border"
                  aria-hidden="true"
                />
                <span className="membership-card-glint" aria-hidden="true" />
                <div className="membership-card-topline">
                  <div className="membership-card-brand">
                    <img
                      src="/brand/ambro-connects-symbol.png"
                      alt=""
                      width={44}
                      height={44}
                    />
                    <span>
                      <strong>ambro</strong>
                      <span>connects.</span>
                    </span>
                  </div>
                  <div className="membership-card-network">
                    <span>{isChina ? "CHINA" : "GLOBAL"}</span>
                    <span
                      className={`membership-card-status is-${status.tone}`}
                    >
                      <i aria-hidden="true" />
                      {status.label}
                    </span>
                  </div>
                </div>
                <p className="membership-card-invitation">
                  Your place,
                  <br />
                  <em>in the circle.</em>
                </p>
                <div className="membership-card-owner">
                  <p
                    className={`membership-card-name ${name.length > 28 ? "is-long" : ""}`}
                    title={name}
                  >
                    {name}
                  </p>
                  <div className="membership-card-front-meta">
                    <div>
                      <span>Member reference</span>
                      <strong>{reference}</strong>
                    </div>
                    <div>
                      <span>Membership through</span>
                      <strong>{expiry || "No active period"}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="membership-card-face membership-card-back"
                aria-hidden={!flipped}
                inert={!flipped || undefined}
              >
                <span
                  className="membership-card-etched-border"
                  aria-hidden="true"
                />
                <Engraving />
                <div className="membership-card-back-heading">
                  <span>Inside your circle.</span>
                  <img
                    src="/brand/ambro-connects-symbol.png"
                    alt=""
                    width={32}
                    height={32}
                  />
                </div>
                <dl className="membership-card-details">
                  <div>
                    <dt>
                      {membership.current ? "Recorded plan" : "Selected plan"}
                    </dt>
                    <dd>{planLabel(selectedPlan)}</dd>
                  </div>
                  <div>
                    <dt>Profile review</dt>
                    <dd>{review}</dd>
                  </div>
                  <div>
                    <dt>Joined</dt>
                    <dd>{joined || "Not available"}</dd>
                  </div>
                  <div>
                    <dt>
                      {starts ? "Current period begins" : "Membership through"}
                    </dt>
                    <dd>{starts || expiry || "No active period"}</dd>
                  </div>
                </dl>
                <p className="membership-card-benefit">
                  {isChina
                    ? "Receive Global connection requests."
                    : "Connect with China & Global members."}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </p>
              </div>
            </div>
          </div>
        </div>
        <button
          className="membership-card-tap"
          type="button"
          onClick={flip}
          aria-pressed={flipped}
          aria-controls={facesId}
          aria-describedby={captionId}
          aria-label={`${flipped ? "Show member card front" : "Show membership details"}. ${status.label}.`}
        />
      </div>
      <button
        className="membership-card-flip-control"
        type="button"
        onClick={flip}
        aria-pressed={flipped}
        aria-controls={facesId}
      >
        <ArrowRightLeft size={16} aria-hidden="true" />
        {flipped ? "Show card front" : "View membership details"}
      </button>
      <p id={captionId} className="membership-card-caption">
        Tap your card to turn it over.
      </p>
    </section>
  );
}

export default MembershipCard;
