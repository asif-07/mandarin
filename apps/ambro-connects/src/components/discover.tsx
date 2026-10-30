"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ArrowUpRight,
  MapPin,
  Bookmark,
  Globe2,
  ShieldCheck,
  Users,
  Star,
} from "lucide-react";
import type { MemberType, PublicMember } from "@/lib/types";
type NetworkFilter = "all" | MemberType;

// Public profiles never expose contact details. Private, accepted connections
// use the separate contact_email response in Connections.
export function publicProfileText(value: string) {
  return value
    .replace(/\bwhatsapp:(?:\/\/)?[^\s]*/gi, "[contact details private]")
    .replace(
      /\b(?:https?:\/\/)?(?:wa\.me|(?:(?:api|chat|web)\.)?whatsapp\.com)\/[^\s]*/gi,
      "[contact details private]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email private]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, (candidate) => {
      const digits = candidate.replace(/\D/g, "");
      const isDate =
        /^\d{4}-\d{2}-\d{2}$/.test(candidate.trim()) ||
        /^\d{4}\s*[-–]\s*\d{4}$/.test(candidate.trim());
      return digits.length >= 9 && !isDate
        ? "[contact details private]"
        : candidate;
    });
}
const specialties = [
  "All connections",
  "Sourcing",
  "Logistics",
  "Translation",
  "Business services",
  "Travel",
];
export function Avatar({
  member,
  className = "",
}: {
  member: { full_name: string; avatar_url: string };
  className?: string;
}) {
  return member.avatar_url ? (
    <img
      className={`avatar ${className}`}
      src={member.avatar_url}
      alt={publicProfileText(member.full_name)}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span className={`avatar ${className}`}>
      {publicProfileText(member.full_name)
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Discover() {
  const params = useSearchParams();
  const networkParam = params.get("type") || params.get("network");
  const initialNetwork: NetworkFilter =
    networkParam === "china" || networkParam === "global"
      ? networkParam
      : "all";
  const [network, setNetwork] = useState<NetworkFilter>(initialNetwork);
  const [specialty, setSpecialty] = useState(
    params.get("specialty") || "All connections",
  );
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  useEffect(() => {
    setNetwork(initialNetwork);
    setCity("");
    setLanguage("");
  }, [initialNetwork]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/members", { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn’t load the network.");
        if (!Array.isArray(d.members))
          throw new Error(
            "The network returned an unexpected response. Please try again.",
          );
        setMembers(d.members);
        if (!d.configured)
          setError("The network is being prepared. Please check back shortly.");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    try {
      const s = JSON.parse(localStorage.getItem("ambro-saved") || "[]");
      if (Array.isArray(s)) setSaved(s.filter((v) => typeof v === "string"));
    } catch {}
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  function save(id: string) {
    const next = saved.includes(id)
      ? saved.filter((s) => s !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("ambro-saved", JSON.stringify(next));
      setToast(
        next.includes(id)
          ? "Saved on this device."
          : "Removed from saved profiles.",
      );
    } catch {
      setToast("Your browser couldn’t save this profile.");
    }
  }
  const networkMembers = members.filter(
    (member) => network === "all" || member.member_type === network,
  );
  const cities = Array.from(
    new Set(networkMembers.map((m) => m.city).filter(Boolean)),
  ).sort();
  const languages = Array.from(
    new Set(networkMembers.flatMap((m) => m.languages)),
  ).sort();
  const filtered = networkMembers.filter(
    (m) =>
      (!onlySaved || saved.includes(m.id)) &&
      (!city || m.city === city) &&
      (!language || m.languages.includes(language)) &&
      (specialty === "All connections" ||
        m.specialties.some((s) =>
          s.toLowerCase().includes(specialty.toLowerCase()),
        )) &&
      (!query ||
        `${m.full_name} ${m.city} ${m.bio} ${m.company} ${m.specialties.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const demoCount = filtered.filter((member) => member.is_demo).length;
  function chooseNetwork(next: NetworkFilter) {
    setNetwork(next);
    setCity("");
    setLanguage("");
  }
  function resetFilters() {
    setSpecialty("All connections");
    setQuery("");
    setCity("");
    setLanguage("");
    setOnlySaved(false);
  }
  return (
    <>
      <div className="container page-intro">
        <p className="eyebrow">YOUR WORLD OF CONNECTIONS, STARTS HERE</p>
        <h1>People worth knowing.</h1>
        <p>
          Meet local expertise in China and shared ambition around the world.
          Find the people who could be part of your next chapter.
        </p>
      </div>
      <div className="container discover-layout">
        <aside className="filter-rail" aria-label="Filter members">
          <h3>Your network</h3>
          <button
            className={!onlySaved ? "selected" : ""}
            onClick={() => setOnlySaved(false)}
          >
            Discover connections <Globe2 size={15} />
          </button>
          <button
            className={onlySaved ? "selected" : ""}
            onClick={() => setOnlySaved(true)}
          >
            Saved on this device <Bookmark size={15} />
          </button>
          <h3>What are you looking for?</h3>
          {specialties.map((s) => (
            <button
              key={s}
              className={specialty === s ? "selected" : ""}
              onClick={() => setSpecialty(s)}
            >
              {s}
              {specialty === s && <ArrowUpRight size={14} />}
            </button>
          ))}
          <h3>Closer to your plans</h3>
          <label className="field filter-select">
            City
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {publicProfileText(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="field filter-select">
            Language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {publicProfileText(l)}
                </option>
              ))}
            </select>
          </label>
          <p className="network-intro-link muted">
            Based in China?
            <br />
            <Link className="text-link" href="/join?type=china">
              Share what you do <ArrowUpRight size={15} />
            </Link>
          </p>
        </aside>
        <section aria-label="Member directory">
          <div
            className="network-switcher"
            role="group"
            aria-label="Choose a member network"
          >
            {(
              [
                { value: "all", label: "All", Icon: Users },
                { value: "china", label: "China", Icon: MapPin },
                { value: "global", label: "Global", Icon: Globe2 },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={network === value}
                onClick={() => chooseNetwork(value)}
              >
                <Icon size={15} />
                <span>{label}</span>
                <small>
                  {loading
                    ? "—"
                    : members.filter(
                        (member) =>
                          value === "all" || member.member_type === value,
                      ).length}
                </small>
              </button>
            ))}
          </div>
          <p className="network-context">
            {network === "china"
              ? "People based in China, with local knowledge and business experience."
              : network === "global"
                ? "Travellers, founders and business people who have chosen to share their profiles."
                : "One circle, across borders. Explore both China and Global members."}
          </p>
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label="Search members"
              placeholder="Try a name, city or specialty…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mobile-categories">
            {specialties.map((s) => (
              <button
                key={s}
                className={specialty === s ? "selected" : ""}
                onClick={() => setSpecialty(s)}
              >
                {s}
              </button>
            ))}
            <button
              className={onlySaved ? "selected" : ""}
              onClick={() => setOnlySaved(!onlySaved)}
            >
              Saved
            </button>
          </div>
          <div className="mobile-filter-row">
            <label className="field">
              City
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {publicProfileText(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="">All languages</option>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {publicProfileText(l)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="discovery-banner">
            <div>
              <p className="eyebrow" style={{ color: "#dfe4b6", marginTop: 0 }}>
                {network === "global"
                  ? "SHARED AMBITION. NEW PERSPECTIVES."
                  : "LOCAL KNOWLEDGE. SHARED POSSIBILITIES."}
              </p>
              <h2 style={{ marginTop: 10 }}>
                Some connections change the journey.
              </h2>
              <p>
                Explore people, not just services. Read their story and see what
                you could create together.
              </p>
            </div>
            <Globe2 size={55} strokeWidth={1} />
          </div>
          {!loading && demoCount > 0 ? (
            <div className="network-demo-notice">
              <span className="demo-label">Demo profiles</span>
              <p>
                Profiles marked “Demo profile” are fictional examples of the
                network. Explore their stories; introductions are disabled for
                these profiles.
              </p>
            </div>
          ) : null}
          <div className="result-bar">
            <span>
              {loading
                ? "Finding your people…"
                : `${filtered.length} ${filtered.length === 1 ? "profile" : "profiles"}${city ? ` in ${publicProfileText(city)}` : " to explore"}${demoCount ? ` · ${demoCount} demo` : ""}`}
            </span>
            <button className="clear-filter" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
          {error && (
            <div className="status error" role="alert">
              {error}
            </div>
          )}
          {loading ? (
            <div className="member-grid">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : filtered.length ? (
            <div className="member-grid">
              {filtered.map((m) => (
                <article className="member-card" key={m.id}>
                  <div className="member-cover">
                    {m.cover_url && (
                      <img src={m.cover_url} alt="" loading="lazy" />
                    )}
                    {m.is_demo ? (
                      <span className="demo-label member-demo-label">
                        Demo profile
                      </span>
                    ) : null}
                  </div>
                  <button
                    aria-label={
                      saved.includes(m.id)
                        ? `Unsave ${publicProfileText(m.full_name)}`
                        : `Save ${publicProfileText(m.full_name)}`
                    }
                    aria-pressed={saved.includes(m.id)}
                    className={`save-button ${saved.includes(m.id) ? "saved" : ""}`}
                    onClick={() => save(m.id)}
                  >
                    <Bookmark
                      size={18}
                      fill={saved.includes(m.id) ? "currentColor" : "none"}
                    />
                  </button>
                  <div className="member-content">
                    <Avatar member={m} />
                    <h3>
                      <Link href={`/members/${m.id}`}>
                        {publicProfileText(m.full_name)}
                      </Link>
                    </h3>
                    <div className="member-network-row">
                      <span
                        className={`member-network-badge member-network-${m.member_type}`}
                      >
                        {m.member_type === "china"
                          ? "China connect"
                          : "Global connect"}
                      </span>
                    </div>
                    <p className="member-meta">
                      <MapPin size={12} />
                      {publicProfileText(m.city)}
                      {m.company && <> · {publicProfileText(m.company)}</>}
                    </p>
                    <p className="member-bio">{publicProfileText(m.bio)}</p>
                    <div className="member-tags">
                      {m.specialties.slice(0, 3).map((s) => (
                        <span className="chip" key={s}>
                          {publicProfileText(s)}
                        </span>
                      ))}
                    </div>
                    <div className="member-actions">
                      <span>
                        {m.is_demo ? (
                          "Illustrative profile"
                        ) : m.rating ? (
                          <span className="stars">
                            <Star size={13} fill="currentColor" />
                            {m.rating} · {m.review_count} reviews
                          </span>
                        ) : (
                          "No reviews yet"
                        )}
                      </span>
                      <Link href={`/members/${m.id}`}>
                        {m.is_demo
                          ? "Explore profile"
                          : `Meet ${publicProfileText(m.full_name).split(" ")[0]}`}{" "}
                        <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Users size={38} strokeWidth={1.3} />
              <h2>
                {members.length
                  ? "A different search. A new possibility."
                  : "A new circle is taking shape."}
              </h2>
              <p>
                {members.length
                  ? "Try another city or specialty, or clear your filters to see the whole network."
                  : "We’re welcoming people in China and around the world. Real profiles appear after membership activation and team review. Global members choose whether to share theirs."}
              </p>
              {members.length ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    resetFilters();
                    chooseNetwork("all");
                  }}
                >
                  Explore all connections
                </button>
              ) : (
                <Link className="btn btn-dark" href="/join">
                  Join the circle <ArrowUpRight size={17} />
                </Link>
              )}
            </div>
          )}
          <p className="directory-note">
            <ShieldCheck size={15} /> Real member experience is self-reported.
            Demo profiles are illustrative. Always discuss the details before
            doing business.
          </p>
        </section>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
