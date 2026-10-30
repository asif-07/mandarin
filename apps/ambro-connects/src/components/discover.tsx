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
import type { PublicMember } from "@/lib/types";
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
      alt={member.full_name}
    />
  ) : (
    <span className={`avatar ${className}`}>
      {member.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Discover() {
  const params = useSearchParams();
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
    const controller = new AbortController();
    fetch("/api/members", { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn’t load the network.");
        setMembers(d.members || []);
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
  const cities = Array.from(
    new Set(members.map((m) => m.city).filter(Boolean)),
  ).sort();
  const languages = Array.from(
    new Set(members.flatMap((m) => m.languages)),
  ).sort();
  const filtered = members.filter(
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
  return (
    <>
      <div className="container page-intro">
        <p className="eyebrow">YOUR CHINA CIRCLE, STARTS HERE</p>
        <h1>People worth knowing.</h1>
        <p>
          Find a local perspective, a shared ambition, or the person who helps
          make it happen.
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
                <option key={c}>{c}</option>
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
                <option key={l}>{l}</option>
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
                  <option key={c}>{c}</option>
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
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="discovery-banner">
            <div>
              <p className="eyebrow" style={{ color: "#dfe4b6", marginTop: 0 }}>
                LOCAL KNOWLEDGE. SHARED POSSIBILITIES.
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
          <div className="result-bar">
            <span>
              {loading
                ? "Finding your people…"
                : `${filtered.length} ${filtered.length === 1 ? "connection" : "connections"}${city ? ` in ${city}` : " to explore"}`}
            </span>
            <button
              className="clear-filter"
              onClick={() => {
                setSpecialty("All connections");
                setQuery("");
                setCity("");
                setLanguage("");
                setOnlySaved(false);
              }}
            >
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
                  </div>
                  <button
                    aria-label={
                      saved.includes(m.id)
                        ? `Unsave ${m.full_name}`
                        : `Save ${m.full_name}`
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
                      <Link href={`/members/${m.id}`}>{m.full_name}</Link>
                    </h3>
                    <p className="member-meta">
                      <MapPin size={12} />
                      {m.city}
                      {m.company && <> · {m.company}</>}
                    </p>
                    <p className="member-bio">{m.bio}</p>
                    <div className="member-tags">
                      {m.specialties.slice(0, 3).map((s) => (
                        <span className="chip" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="member-actions">
                      <span>
                        {m.rating ? (
                          <span className="stars">
                            <Star size={13} fill="currentColor" />
                            {m.rating} · {m.review_count} reviews
                          </span>
                        ) : (
                          "No reviews yet"
                        )}
                      </span>
                      <Link href={`/members/${m.id}`}>
                        Meet {m.full_name.split(" ")[0]}{" "}
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
                  : "We’re welcoming our first China-based professionals. Profiles appear here after team review and membership activation."}
              </p>
              {members.length ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setSpecialty("All connections");
                    setQuery("");
                    setCity("");
                    setLanguage("");
                    setOnlySaved(false);
                  }}
                >
                  Explore all connections
                </button>
              ) : (
                <Link className="btn btn-dark" href="/join?type=china">
                  Become a founding China connect <ArrowUpRight size={17} />
                </Link>
              )}
            </div>
          )}
          <p className="directory-note">
            <ShieldCheck size={15} /> Reviewed profiles, member-provided
            experience. Always discuss the details before doing business.
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
