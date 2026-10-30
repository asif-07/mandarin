"use client";
import { useState, useEffect, useRef } from "react";
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
  X,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import type { MemberType, PublicMember } from "@/lib/types";
import "./mobile-directory.css";
type NetworkFilter = "all" | MemberType;
type DirectoryFilters = {
  network: NetworkFilter;
  specialty: string;
  city: string;
  query: string;
  language: string;
  onlySaved: boolean;
};
const DIRECTORY_STATE_KEY = "ambro-directory-v1";

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
  const parameterKey = params.toString();
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
  const [restored, setRestored] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const writtenParameters = useRef<string | null>(null);
  useEffect(() => {
    // Ignore URL snapshots superseded by a newer keystroke, and avoid reading
    // our own history updates back over the current input state.
    if (new URLSearchParams(window.location.search).toString() !== parameterKey)
      return;
    if (writtenParameters.current === parameterKey) {
      writtenParameters.current = null;
      return;
    }
    let stored: Partial<DirectoryFilters> = {};
    try {
      const value: unknown = JSON.parse(
        sessionStorage.getItem(DIRECTORY_STATE_KEY) || "null",
      );
      if (value && typeof value === "object" && !Array.isArray(value))
        stored = value as Partial<DirectoryFilters>;
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
    const url = new URLSearchParams(parameterKey);
    const requestedNetwork = url.get("type") || url.get("network");
    const hasUrlState = [
      "type",
      "network",
      "specialty",
      "city",
      "q",
      "language",
      "saved",
    ].some((key) => url.has(key));
    setNetwork(
      requestedNetwork === "china" || requestedNetwork === "global"
        ? requestedNetwork
        : !hasUrlState &&
            (stored.network === "china" || stored.network === "global")
          ? stored.network
          : "all",
    );
    const requestedSpecialty = url.get("specialty");
    setSpecialty(
      requestedSpecialty && specialties.includes(requestedSpecialty)
        ? requestedSpecialty
        : !hasUrlState &&
            stored.specialty &&
            specialties.includes(stored.specialty)
          ? stored.specialty
          : "All connections",
    );
    setCity(
      hasUrlState
        ? (url.get("city") || "").slice(0, 100)
        : typeof stored.city === "string"
          ? stored.city.slice(0, 100)
          : "",
    );
    setQuery(
      hasUrlState
        ? (url.get("q") || "").slice(0, 200)
        : typeof stored.query === "string"
          ? stored.query.slice(0, 200)
          : "",
    );
    setLanguage(
      hasUrlState
        ? (url.get("language") || "").slice(0, 50)
        : typeof stored.language === "string"
          ? stored.language.slice(0, 50)
          : "",
    );
    setOnlySaved(
      hasUrlState ? url.get("saved") === "1" : stored.onlySaved === true,
    );
    setRestored(true);
  }, [parameterKey]);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(
        DIRECTORY_STATE_KEY,
        JSON.stringify({
          network,
          specialty,
          city,
          query,
          language,
          onlySaved,
        } satisfies DirectoryFilters),
      );
    } catch {
      /* Session storage is optional. */
    }
    const next = new URLSearchParams(window.location.search);
    ["type", "network", "specialty", "city", "q", "language", "saved"].forEach(
      (key) => next.delete(key),
    );
    if (network !== "all") next.set("type", network);
    if (specialty !== "All connections") next.set("specialty", specialty);
    if (city) next.set("city", city);
    if (query) next.set("q", query);
    if (language) next.set("language", language);
    if (onlySaved) next.set("saved", "1");
    const search = next.toString();
    if (search !== window.location.search.slice(1)) {
      writtenParameters.current = search;
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
      );
    }
  }, [restored, network, specialty, city, query, language, onlySaved]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/members", { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn’t load the network.");
        if (!Array.isArray(d.members))
          throw new Error(
            "The network returned an unexpected response. Please try again.",
          );
        if (!d.configured)
          throw new Error(
            "The network is being prepared. Please check back shortly.",
          );
        setMembers(d.members);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setMembers([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    try {
      const s = JSON.parse(localStorage.getItem("ambro-saved") || "[]");
      if (Array.isArray(s)) setSaved(s.filter((v) => typeof v === "string"));
    } catch {}
    return () => controller.abort();
  }, [loadAttempt]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  function save(id: string) {
    const next = saved.includes(id)
      ? saved.filter((s) => s !== id)
      : [...saved, id];
    try {
      localStorage.setItem("ambro-saved", JSON.stringify(next));
      setSaved(next);
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
  const searchTerm = query.trim().toLowerCase();
  const filtered = networkMembers.filter(
    (m) =>
      (!onlySaved || saved.includes(m.id)) &&
      (!city || m.city === city) &&
      (!language || m.languages.includes(language)) &&
      (specialty === "All connections" ||
        m.specialties.some((s) =>
          s.toLowerCase().includes(specialty.toLowerCase()),
        )) &&
      (!searchTerm ||
        `${m.full_name} ${m.city} ${m.bio} ${m.company} ${m.specialties.join(" ")}`
          .toLowerCase()
          .includes(searchTerm)),
  );
  const demoCount = filtered.filter((member) => member.is_demo).length;
  const advancedCount = Number(Boolean(city)) + Number(Boolean(language));
  const filterCount =
    advancedCount +
    Number(Boolean(query.trim())) +
    Number(onlySaved) +
    Number(specialty !== "All connections");
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
  function closeFilters() {
    setFiltersOpen(false);
    filtersButton.current?.focus();
  }
  return (
    <div className="directory-page">
      <div className="container page-intro directory-intro">
        <p className="eyebrow">YOUR WORLD OF CONNECTIONS</p>
        <h1>People worth knowing.</h1>
        <p>Local expertise in China. Shared ambition around the world.</p>
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
          <div className="directory-search-row">
            <form
              className="search-bar"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                searchInput.current?.blur();
              }}
            >
              <Search size={19} aria-hidden="true" />
              <input
                ref={searchInput}
                type="search"
                aria-label="Search members"
                placeholder="Name, city or specialty"
                maxLength={200}
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  className="directory-clear-search"
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    searchInput.current?.focus();
                  }}
                >
                  <X size={17} />
                </button>
              ) : null}
            </form>
            <button
              ref={filtersButton}
              className={`directory-filter-toggle ${advancedCount ? "has-filters" : ""}`}
              type="button"
              aria-label={
                advancedCount ? `Filters, ${advancedCount} active` : "Filters"
              }
              aria-expanded={filtersOpen}
              aria-controls="directory-mobile-filters"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={17} />
              <span>Filters</span>
              {advancedCount ? (
                <span className="directory-filter-count" aria-hidden="true">
                  {advancedCount}
                </span>
              ) : (
                <ChevronDown
                  size={13}
                  className={filtersOpen ? "is-open" : ""}
                />
              )}
            </button>
          </div>
          <div
            className="mobile-categories"
            role="group"
            aria-label="Filter by specialty or saved profiles"
          >
            <button
              type="button"
              aria-pressed={onlySaved}
              className={onlySaved ? "selected" : ""}
              onClick={() => setOnlySaved(!onlySaved)}
            >
              <Bookmark size={13} />
              Saved
            </button>
            {specialties.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={specialty === s}
                className={specialty === s ? "selected" : ""}
                onClick={() => setSpecialty(s)}
              >
                {s === "All connections" ? "All specialties" : s}
              </button>
            ))}
          </div>
          <section
            id="directory-mobile-filters"
            className="directory-mobile-filters"
            hidden={!filtersOpen}
            aria-label="More directory filters"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeFilters();
              }
            }}
          >
            <div className="directory-filter-heading">
              <div>
                <h2>Find your people.</h2>
                <p>Refine by location and language.</p>
              </div>
              <button
                type="button"
                className="directory-panel-close"
                aria-label="Close filters"
                onClick={closeFilters}
              >
                <X size={19} />
              </button>
            </div>
            <div className="directory-filter-fields">
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
            <div className="directory-filter-footer">
              <button
                type="button"
                className="directory-reset-advanced"
                disabled={!advancedCount}
                onClick={() => {
                  setCity("");
                  setLanguage("");
                }}
              >
                Reset filters
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={closeFilters}
              >
                Show{" "}
                {loading
                  ? "profiles"
                  : `${filtered.length} ${filtered.length === 1 ? "profile" : "profiles"}`}{" "}
                <ArrowUpRight size={15} />
              </button>
            </div>
          </section>
          {advancedCount ? (
            <div
              className="directory-active-filters"
              aria-label="Active location and language filters"
            >
              {city ? (
                <button
                  type="button"
                  aria-label={`Remove city filter ${publicProfileText(city)}`}
                  onClick={() => setCity("")}
                >
                  {publicProfileText(city)}
                  <X size={12} />
                </button>
              ) : null}
              {language ? (
                <button
                  type="button"
                  aria-label={`Remove language filter ${publicProfileText(language)}`}
                  onClick={() => setLanguage("")}
                >
                  {publicProfileText(language)}
                  <X size={12} />
                </button>
              ) : null}
            </div>
          ) : null}
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
                Fictional examples, marked “Demo profile”. Introductions are
                disabled for them.
              </p>
            </div>
          ) : null}
          <div className="result-bar" id="directory-results">
            <span role="status" aria-live="polite" aria-atomic="true">
              {loading || !restored
                ? "Finding your people…"
                : error
                  ? "Network unavailable"
                  : `${filtered.length} ${filtered.length === 1 ? "profile" : "profiles"}${city ? ` in ${publicProfileText(city)}` : " to explore"}${demoCount ? ` · ${demoCount} demo` : ""}`}
            </span>
            {filterCount ? (
              <button className="clear-filter" onClick={resetFilters}>
                Clear filters{" "}
                <span className="directory-filter-count">{filterCount}</span>
              </button>
            ) : null}
          </div>
          {loading || !restored ? (
            <div
              className="member-grid directory-loading"
              role="status"
              aria-label="Loading member profiles"
            >
              <div className="skeleton" aria-hidden="true" />
              <div className="skeleton" aria-hidden="true" />
            </div>
          ) : error ? (
            <div className="empty-state directory-load-error" role="alert">
              <Globe2 size={32} strokeWidth={1.4} />
              <h2>The network is taking a moment.</h2>
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                <RefreshCw size={16} />
                Try again
              </button>
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
                {onlySaved && !saved.length
                  ? "Keep a good connection close."
                  : members.length
                    ? "A different search. A new possibility."
                    : "A new circle is taking shape."}
              </h2>
              <p>
                {onlySaved && !saved.length
                  ? "Tap the bookmark on any profile to save it on this device. Your shortlist will appear here."
                  : members.length
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
    </div>
  );
}
