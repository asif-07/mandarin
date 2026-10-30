"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Globe2,
  ImagePlus,
  LockKeyhole,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useMemberSession } from "@/components/member-session";
import {
  PLAN_DETAILS,
  type MeResponse,
  type Plan,
  type Profile,
} from "@/lib/types";
import "./member-tools.css";
import "./mobile-forms.css";
import "./profile-workspace.css";

type Notice = { type: "success" | "error"; text: string } | null;
type ProfileDraft = Pick<
  Profile,
  | "full_name"
  | "company"
  | "city"
  | "bio"
  | "avatar_url"
  | "cover_url"
  | "portfolio"
  | "network_visible"
> & { specialties: string; languages: string; achievements: string };

const PROFILE_DRAFT_PREFIX = "ambroconnects:profile-draft:v1:";
const PROFILE_DRAFT_MAX_BYTES = 100 * 1024;

function draftKey(userId: string) {
  return `${PROFILE_DRAFT_PREFIX}${userId}`;
}

function removeProfileDraft(userId: string) {
  try {
    window.sessionStorage.removeItem(draftKey(userId));
  } catch {
    /* Storage can be disabled by the browser. */
  }
}

function readProfileDraft(userId: string): ProfileDraft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(userId));
    if (!raw) return null;
    if (new TextEncoder().encode(raw).byteLength > PROFILE_DRAFT_MAX_BYTES)
      throw new Error("Draft is too large.");
    const cached: unknown = JSON.parse(raw);
    if (!cached || typeof cached !== "object" || Array.isArray(cached))
      throw new Error("Invalid draft.");
    const envelope = cached as Record<string, unknown>;
    if (
      envelope.version !== 1 ||
      envelope.userId !== userId ||
      !envelope.profile ||
      typeof envelope.profile !== "object" ||
      Array.isArray(envelope.profile)
    )
      throw new Error("Invalid draft owner or version.");
    const value = envelope.profile as Record<string, unknown>;
    const limits: Record<string, number> = {
      full_name: 100,
      company: 150,
      city: 100,
      bio: 2000,
      avatar_url: 1000,
      cover_url: 1000,
      specialties: 600,
      languages: 300,
      achievements: 4000,
    };
    if (
      Object.entries(limits).some(
        ([key, limit]) =>
          typeof value[key] !== "string" ||
          (value[key] as string).length > limit,
      ) ||
      typeof value.network_visible !== "boolean"
    )
      throw new Error("Invalid draft fields.");
    const validImage = (image: unknown) =>
      typeof image === "string" &&
      image.length <= 1000 &&
      (!image || /^https:\/\//.test(image));
    if (
      !validImage(value.avatar_url) ||
      !validImage(value.cover_url) ||
      !Array.isArray(value.portfolio) ||
      value.portfolio.length > 12
    )
      throw new Error("Invalid draft images or projects.");
    const portfolio = value.portfolio.map((project: unknown) => {
      if (!project || typeof project !== "object" || Array.isArray(project))
        throw new Error("Invalid draft project.");
      const item = project as Record<string, unknown>;
      if (
        typeof item.title !== "string" ||
        item.title.length > 150 ||
        typeof item.description !== "string" ||
        item.description.length > 1000 ||
        !validImage(item.image_url)
      )
        throw new Error("Invalid draft project fields.");
      return {
        title: item.title,
        description: item.description,
        image_url: item.image_url as string,
      };
    });
    return {
      full_name: value.full_name as string,
      company: value.company as string,
      city: value.city as string,
      bio: value.bio as string,
      avatar_url: value.avatar_url as string,
      cover_url: value.cover_url as string,
      portfolio,
      network_visible: value.network_visible,
      specialties: value.specialties as string,
      languages: value.languages as string,
      achievements: value.achievements as string,
    };
  } catch {
    removeProfileDraft(userId);
    return null;
  }
}

async function responseData<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "Something went wrong. Please try again.";
    throw new Error(error);
  }
  if (!body || typeof body !== "object")
    throw new Error(
      "The server returned an unexpected response. Please try again.",
    );
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

function profileSnapshot(
  profile: Profile,
  specialties: string,
  languages: string,
  achievements: string,
) {
  return JSON.stringify({
    full_name: profile.full_name,
    company: profile.company,
    city: profile.city,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    cover_url: profile.cover_url,
    portfolio: profile.portfolio,
    network_visible: profile.network_visible,
    specialties,
    languages,
    achievements,
  });
}

export function Account() {
  const session = useMemberSession();
  const identity = session.data?.user?.id;
  const verified = session.status === "authenticated" && Boolean(identity);
  return (
    <>
      {!verified ? (
        <div className="container ac-page">
          <div className="panel ac-state" role="status">
            {session.status === "loading" ? (
              <>
                <div className="ac-loading">
                  <span className="ac-spinner" />
                  Verifying your account…
                </div>
              </>
            ) : session.status === "error" ? (
              <>
                <h1>Let’s verify your account.</h1>
                <p className="muted">
                  We couldn’t verify your session. Retry before continuing.
                </p>
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={() => void session.refresh()}
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <h1>Your profile is waiting.</h1>
                <p className="muted">
                  Sign in to see your profile, membership and connections.
                </p>
                <Link className="btn btn-dark" href="/login">
                  Sign in <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
      {identity ? (
        <div hidden={!verified}>
          <AccountWorkspace key={identity} identity={identity} />
        </div>
      ) : null}
    </>
  );
}

function AccountWorkspace({ identity }: { identity: string }) {
  const {
    data: verifiedMe,
    status: verificationStatus,
    refresh: refreshSession,
    clear: clearSession,
  } = useMemberSession();
  const search = useSearchParams();
  const [view, setView] = useState<
    "profile" | "edit" | "membership" | "settings"
  >("profile");
  const [editSection, setEditSection] = useState<
    "intro" | "about" | "experience" | "work" | "visibility"
  >("intro");
  const editorTitleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (view === "edit") editorTitleRef.current?.focus({ preventScroll: true });
  }, [view, editSection]);
  function selectView(
    next: "profile" | "membership" | "settings",
    replace = false,
  ) {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "profile") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    url.searchParams.delete("edit");
    url.hash = "";
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  useEffect(() => {
    const tab = search.get("tab");
    const section = search.get("edit");
    if (
      section === "intro" ||
      section === "about" ||
      section === "work" ||
      section === "experience" ||
      section === "visibility"
    ) {
      setEditSection(
        section === "visibility" &&
          verifiedMe?.membership?.member_type === "china"
          ? "intro"
          : section,
      );
      setView("edit");
    } else
      setView(tab === "membership" || tab === "settings" ? tab : "profile");
  }, [search, verifiedMe?.membership?.member_type]);
  function selectEditor(section: typeof editSection, replace = false) {
    setEditSection(section);
    setView("edit");
    const url = new URL(window.location.href);
    url.searchParams.set("edit", section);
    url.hash = "";
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      `${url.pathname}${url.search}`,
    );
  }
  const [data, setData] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialties, setSpecialties] = useState("");
  const [languages, setLanguages] = useState("");
  const [achievements, setAchievements] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [plan, setPlan] = useState<Plan>("global_monthly");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [draftKept, setDraftKept] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const allowPageExit = useRef(false);
  const serverProfile = useRef<Profile | null>(null);
  const loadedUserId = useRef<string | null>(null);
  const mounted = useRef(true);
  const mutationRequests = useRef(new Set<AbortController>());
  const userId = data?.user?.id;
  const profileDirty = Boolean(
    profile &&
    savedSnapshot &&
    profileSnapshot(profile, specialties, languages, achievements) !==
      savedSnapshot,
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      mutationRequests.current.forEach((request) => request.abort());
      mutationRequests.current.clear();
    };
  }, []);

  async function authorizeMutation() {
    if (
      verificationStatus !== "authenticated" ||
      verifiedMe?.user?.id !== identity ||
      data?.user?.id !== identity ||
      profile?.id !== identity
    )
      throw new Error(
        "Your session changed. Reopen your own profile before continuing.",
      );
    const current = await refreshSession();
    if (!mounted.current || current?.user?.id !== identity)
      throw new Error("Your account could not be verified. Please try again.");
    const controller = new AbortController();
    mutationRequests.current.add(controller);
    return controller;
  }

  useEffect(() => {
    if (notice?.type === "error") noticeRef.current?.focus();
  }, [notice]);
  useEffect(() => {
    if (
      verificationStatus !== "authenticated" ||
      verifiedMe?.user?.id !== identity ||
      loading
    )
      return;
    setData(verifiedMe);
    if (verifiedMe.profile) serverProfile.current = verifiedMe.profile;
    if (!profileDirty && !saving && !uploading && verifiedMe.profile) {
      const fresh = verifiedMe.profile;
      const nextSpecialties = fresh.specialties.join(", ");
      const nextLanguages = fresh.languages.join(", ");
      const nextAchievements = fresh.achievements.join("\n");
      setProfile(fresh);
      setSpecialties(nextSpecialties);
      setLanguages(nextLanguages);
      setAchievements(nextAchievements);
      setSavedSnapshot(
        profileSnapshot(
          fresh,
          nextSpecialties,
          nextLanguages,
          nextAchievements,
        ),
      );
    }
  }, [
    verificationStatus,
    verifiedMe,
    identity,
    loading,
    profileDirty,
    saving,
    uploading,
  ]);

  useEffect(() => {
    if (!userId || !savedSnapshot || !profile || profile.id !== userId) return;
    if (!profileDirty) {
      removeProfileDraft(userId);
      setDraftKept(false);
      return;
    }
    try {
      const cached = JSON.stringify({
        version: 1,
        userId,
        profile: JSON.parse(
          profileSnapshot(profile, specialties, languages, achievements),
        ),
      });
      if (
        new TextEncoder().encode(cached).byteLength > PROFILE_DRAFT_MAX_BYTES
      ) {
        removeProfileDraft(userId);
        setDraftKept(false);
        return;
      }
      window.sessionStorage.setItem(draftKey(userId), cached);
      setDraftKept(true);
    } catch {
      removeProfileDraft(userId);
      setDraftKept(false);
    }
  }, [
    userId,
    profile,
    specialties,
    languages,
    achievements,
    profileDirty,
    savedSnapshot,
  ]);

  useEffect(() => {
    if (!profileDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (allowPageExit.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [profileDirty]);

  const load = useCallback(
    async (signal?: AbortSignal, resetProfile = true) => {
      const result = await refreshSession();
      if (signal?.aborted || !mounted.current) return;
      if (!result || result.user?.id !== identity)
        throw new Error(
          "Your account could not be verified. Please sign in again.",
        );
      if (!Array.isArray(result.connections) || !("user" in result))
        throw new Error("Your account could not be loaded. Please try again.");
      setData(result);
      const accountChanged = loadedUserId.current !== (result.user?.id ?? null);
      loadedUserId.current = result.user?.id ?? null;
      if (resetProfile || accountChanged) {
        serverProfile.current = result.profile;
        const draft =
          result.user && result.profile
            ? readProfileDraft(result.user.id)
            : null;
        setProfile(
          result.profile && draft
            ? {
                ...result.profile,
                full_name: draft.full_name,
                company: draft.company,
                city: draft.city,
                bio: draft.bio,
                avatar_url: draft.avatar_url,
                cover_url: draft.cover_url,
                portfolio: draft.portfolio,
                network_visible: draft.network_visible,
              }
            : result.profile,
        );
        setSpecialties(
          draft?.specialties ?? result.profile?.specialties.join(", ") ?? "",
        );
        setLanguages(
          draft?.languages ?? result.profile?.languages.join(", ") ?? "",
        );
        setAchievements(
          draft?.achievements ?? result.profile?.achievements.join("\n") ?? "",
        );
        setDraftKept(Boolean(draft));
        if (draft)
          setNotice({
            type: "success",
            text: "Your unsaved profile draft was restored from this browser tab. Save it when you’re ready.",
          });
        setSavedSnapshot(
          result.profile
            ? profileSnapshot(
                result.profile,
                result.profile.specialties.join(", "),
                result.profile.languages.join(", "),
                result.profile.achievements.join("\n"),
              )
            : "",
        );
        setPlan(
          result.membership?.member_type === "china"
            ? "china_yearly"
            : result.membership?.preferred_plan || "global_monthly",
        );
      }
      setLoadError("");
    },
    [refreshSession, identity],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Your account could not be loaded.",
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
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Your account could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  function edit<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }

  function discardProfileDraft() {
    const saved = serverProfile.current;
    if (!saved || !userId || saved.id !== userId || saving || uploading) return;
    setProfile(saved);
    setSpecialties(saved.specialties.join(", "));
    setLanguages(saved.languages.join(", "));
    setAchievements(saved.achievements.join("\n"));
    setSavedSnapshot(
      profileSnapshot(
        saved,
        saved.specialties.join(", "),
        saved.languages.join(", "),
        saved.achievements.join("\n"),
      ),
    );
    removeProfileDraft(userId);
    setDraftKept(false);
    setNotice({
      type: "success",
      text: "Unsaved changes discarded. Your saved profile is unchanged.",
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving || uploading) return;
    if (!profile.full_name.trim() || !profile.city.trim()) {
      selectEditor("intro", true);
      setNotice({
        type: "error",
        text: !profile.full_name.trim()
          ? "Add your name in Intro before saving."
          : "Add your city in Intro before saving.",
      });
      return;
    }
    const incompleteProject = profile.portfolio.findIndex(
      (project) => !project.title.trim(),
    );
    if (incompleteProject !== -1) {
      selectEditor("work", true);
      setNotice({
        type: "error",
        text: `Add a title for project ${incompleteProject + 1}, or remove the empty project before saving.`,
      });
      return;
    }
    setSaving(true);
    setNotice(null);
    let controller: AbortController | undefined;
    try {
      controller = await authorizeMutation();
      const split = (value: string, separator: string | RegExp) =>
        value
          .split(separator)
          .map((item) => item.trim())
          .filter(Boolean);
      const saved = await responseData<{ profile: Profile }>(
        await fetch("/api/profile", {
          method: "PUT",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...profile,
            specialties: split(specialties, ","),
            languages: split(languages, ","),
            achievements: split(achievements, /\r?\n/),
          }),
        }),
      );
      if (!mounted.current) return;
      const savedSpecialties = saved.profile.specialties.join(", ");
      const savedLanguages = saved.profile.languages.join(", ");
      const savedAchievements = saved.profile.achievements.join("\n");
      serverProfile.current = saved.profile;
      if (userId) removeProfileDraft(userId);
      setDraftKept(false);
      setProfile(saved.profile);
      setData((current) =>
        current ? { ...current, profile: saved.profile } : current,
      );
      setSpecialties(savedSpecialties);
      setLanguages(savedLanguages);
      setAchievements(savedAchievements);
      setSavedSnapshot(
        profileSnapshot(
          saved.profile,
          savedSpecialties,
          savedLanguages,
          savedAchievements,
        ),
      );
      try {
        await load(undefined, false);
        setNotice({ type: "success", text: "Your profile has been saved." });
      } catch {
        setNotice({
          type: "success",
          text: "Your profile has been saved. Refresh later to check its latest review status.",
        });
      }
      selectView("profile", true);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your profile could not be saved.",
      });
    } finally {
      if (controller) mutationRequests.current.delete(controller);
      setSaving(false);
    }
  }

  async function uploadPhoto(
    file: File | undefined,
    kind: "avatar" | "cover" | "portfolio",
    index?: number,
  ) {
    if (!file || uploading || saving) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice({ type: "error", text: "Choose a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setNotice({
        type: "error",
        text: "Please choose an image smaller than 4 MB.",
      });
      return;
    }
    setUploading(`${kind}${index ?? ""}`);
    setNotice(null);
    let controller: AbortController | undefined;
    try {
      controller = await authorizeMutation();
      const body = new FormData();
      body.set("file", file);
      body.set("kind", kind);
      body.set("expected_user_id", identity);
      const result = await responseData<{ url: string }>(
        await fetch("/api/upload", {
          method: "POST",
          body,
          signal: controller.signal,
        }),
      );
      if (!mounted.current) return;
      if (typeof result.url !== "string" || !result.url.startsWith("https://"))
        throw new Error("The image upload returned an invalid link.");
      setProfile((current) => {
        if (!current) return current;
        if (kind === "portfolio" && index !== undefined)
          return {
            ...current,
            portfolio: current.portfolio.map((item, itemIndex) =>
              itemIndex === index ? { ...item, image_url: result.url } : item,
            ),
          };
        return {
          ...current,
          [kind === "avatar" ? "avatar_url" : "cover_url"]: result.url,
        };
      });
      setNotice({
        type: "success",
        text: "Image uploaded. Save your profile to apply the change.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your image could not be uploaded.",
      });
    } finally {
      if (controller) mutationRequests.current.delete(controller);
      setUploading("");
    }
  }

  async function submitMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice(null);
    let controller: AbortController | undefined;
    try {
      controller = await authorizeMutation();
      await responseData(
        await fetch("/api/membership", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan,
            reference,
            note,
            expected_user_id: identity,
          }),
        }),
      );
      if (!mounted.current) return;
      setReference("");
      setNote("");
      try {
        await load(undefined, false);
        setNotice({
          type: "success",
          text: "Your details have been sent for review. Membership will activate after the Mandarin Roots team approves them.",
        });
      } catch {
        setNotice({
          type: "success",
          text: "Your details have been submitted. Refresh later to check their approval status.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your membership request could not be sent.",
      });
    } finally {
      if (controller) mutationRequests.current.delete(controller);
      setSubmitting(false);
    }
  }

  async function logout() {
    if (
      profileDirty &&
      !window.confirm(
        "You have unsaved profile changes. Sign out and discard them?",
      )
    )
      return;
    setLoggingOut(true);
    setNotice(null);
    let controller: AbortController | undefined;
    try {
      controller = await authorizeMutation();
      await responseData(
        await fetch("/api/auth", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        }),
      );
      if (!mounted.current) return;
      if (userId) removeProfileDraft(userId);
      clearSession();
      allowPageExit.current = true;
      window.location.assign("/");
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "You could not be signed out. Please try again.",
      });
      setLoggingOut(false);
    } finally {
      if (controller) mutationRequests.current.delete(controller);
    }
  }

  if (loading)
    return (
      <div className="container ac-page">
        <div className="ac-loading" role="status">
          <span className="ac-spinner" />
          Loading your account…
        </div>
      </div>
    );
  if (loadError)
    return (
      <div className="container ac-page">
        <div className="panel ac-state" role="alert">
          <span className="eyebrow">Account</span>
          <h1>We couldn’t load your account.</h1>
          <p className="muted">{loadError}</p>
          <button className="btn btn-dark" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  if (!data?.user)
    return (
      <div className="container ac-page">
        <div className="panel ac-state">
          <span className="eyebrow">Your next connection starts here</span>
          <h1>A place in Ambro’s network.</h1>
          <p className="muted">
            Sign in to manage your profile, membership and business connections.
          </p>
          <div className="ac-actions">
            <Link className="btn btn-primary" href="/login">
              Sign in <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="btn btn-ghost" href="/join">
              Join the network
            </Link>
          </div>
        </div>
      </div>
    );
  if (!profile || !data.membership)
    return (
      <div className="container ac-page">
        <div className="panel ac-state" role="alert">
          <h1>Your account is being prepared.</h1>
          <p className="muted">
            Your profile is not available yet. Please refresh in a moment.
          </p>
          <button className="btn btn-dark" onClick={retry}>
            Refresh account
          </button>
        </div>
      </div>
    );

  const membership = data.membership;
  const isChina = membership.member_type === "china";
  const pending = membership.requests.find(
    (request) => request.status === "pending",
  );
  const owner = data.profile || serverProfile.current || profile;
  const visible =
    membership.active &&
    membership.moderation_status === "approved" &&
    (isChina || owner.network_visible);
  const connected = data.connections.filter((connection) =>
    ["accepted", "completed"].includes(connection.status),
  ).length;
  const completed = data.connections.filter(
    (connection) => connection.status === "completed",
  ).length;
  const sectionTitles = {
    intro: "Edit your intro",
    about: "About & expertise",
    experience: "Your achievements",
    work: "Previous work",
    visibility: "Profile visibility",
  };
  const openEditor = (section: typeof editSection) => {
    selectEditor(section);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const changeView = (
    next: "profile" | "membership" | "settings",
    replace = false,
  ) => {
    selectView(next, replace);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const editButton = (section: typeof editSection, label: string) => (
    <button
      className="pw-icon-button"
      type="button"
      onClick={() => openEditor(section)}
      aria-label={label}
    >
      <Pencil size={17} aria-hidden="true" />
    </button>
  );

  return (
    <div
      className={`container ac-page ac-account-page pw-page ${view === "edit" ? "pw-is-editing" : ""}`}
    >
      <div className="pw-page-top">
        <span>
          {view === "edit"
            ? "Edit profile"
            : view === "membership"
              ? "Your membership"
              : view === "settings"
                ? "Account settings"
                : "My profile"}
        </span>
        <Link href="/how-to-use" className="pw-help-link">
          <CircleHelp size={17} aria-hidden="true" /> Help
        </Link>
      </div>
      {notice ? (
        <div
          ref={noticeRef}
          tabIndex={notice.type === "error" ? -1 : undefined}
          className={`ac-notice ac-notice-${notice.type} pw-feedback`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      ) : null}

      {view !== "edit" ? (
        <nav className="pw-view-nav" aria-label="Your account">
          <button
            type="button"
            aria-pressed={view === "profile"}
            onClick={() => changeView("profile")}
          >
            <UserRound size={17} aria-hidden="true" /> Profile
          </button>
          <button
            type="button"
            aria-pressed={view === "membership"}
            onClick={() => changeView("membership")}
          >
            <CreditCard size={17} aria-hidden="true" /> Membership
          </button>
          <button
            type="button"
            aria-pressed={view === "settings"}
            onClick={() => changeView("settings")}
          >
            <Settings2 size={17} aria-hidden="true" /> Settings
          </button>
        </nav>
      ) : (
        <button
          type="button"
          className="pw-back"
          onClick={() => changeView("profile", true)}
          disabled={saving}
        >
          <ArrowLeft size={18} aria-hidden="true" /> Back to profile
        </button>
      )}

      {profileDirty ? (
        <div className="pw-draft-note">
          <div>
            <strong>
              {draftKept
                ? "Your draft is kept in this tab."
                : "You have unsaved changes."}
            </strong>
            <p>
              {view === "edit"
                ? "Save when you’re ready. Your live profile stays as it is."
                : "Continue editing whenever you’re ready."}
            </p>
          </div>
          <div className="pw-draft-actions">
            {view !== "edit" ? (
              <button type="button" onClick={() => openEditor(editSection)}>
                Continue editing
              </button>
            ) : null}
            <button
              type="button"
              onClick={discardProfileDraft}
              disabled={saving || Boolean(uploading)}
            >
              Discard changes
            </button>
          </div>
        </div>
      ) : null}

      {view === "profile" ? (
        <div className="pw-profile-layout">
          <div className="pw-profile-main">
            <section className="pw-identity-card" aria-labelledby="owner-name">
              <div className="pw-cover">
                {owner.cover_url ? (
                  <img src={owner.cover_url} alt="Your profile cover" />
                ) : (
                  <div className="pw-cover-empty">
                    <Globe2 size={92} strokeWidth={0.6} aria-hidden="true" />
                    <span>Ambro Connects</span>
                  </div>
                )}
                <button
                  type="button"
                  className="pw-cover-edit"
                  onClick={() => openEditor("intro")}
                  aria-label="Edit profile photos"
                >
                  <Camera size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="pw-identity-body">
                <div className="pw-avatar-row">
                  <div className="pw-owner-avatar">
                    {owner.avatar_url ? (
                      <img src={owner.avatar_url} alt={owner.full_name} />
                    ) : (
                      <span>{initials(owner.full_name)}</span>
                    )}
                  </div>
                  <span className="pw-member-type">
                    {isChina ? "China member" : "Global member"}
                  </span>
                </div>
                <h1 id="owner-name">{owner.full_name}</h1>
                {owner.company ? (
                  <p className="pw-owner-headline">{owner.company}</p>
                ) : null}
                <div className="pw-owner-meta">
                  {owner.city ? (
                    <span>
                      <MapPin size={15} aria-hidden="true" />
                      {owner.city}
                    </span>
                  ) : (
                    <button type="button" onClick={() => openEditor("intro")}>
                      <MapPin size={15} aria-hidden="true" /> Add your city
                    </button>
                  )}
                  <span>
                    <Globe2 size={15} aria-hidden="true" />
                    {visible
                      ? "Visible in the network"
                      : membership.moderation_status === "pending"
                        ? "Profile in review"
                        : !isChina && !owner.network_visible
                          ? "Private profile"
                          : "Profile not yet discoverable"}
                  </span>
                </div>
                <div className="pw-identity-actions">
                  <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => openEditor("intro")}
                  >
                    <Pencil size={16} aria-hidden="true" /> Edit profile
                  </button>
                  <Link href="/connections" className="btn btn-ghost">
                    <Users size={17} aria-hidden="true" /> Connections
                  </Link>
                  {visible ? (
                    <Link
                      className="pw-preview-link"
                      href={`/members/${owner.id}`}
                    >
                      View public profile{" "}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="pw-profile-stats">
                <Link href="/connections">
                  <strong>{connected}</strong>
                  <span>Connections</span>
                </Link>
                <Link href="/connections">
                  <strong>{completed}</strong>
                  <span>Completed</span>
                </Link>
                <a href="#owner-work">
                  <strong>{owner.portfolio.length}</strong>
                  <span>Projects</span>
                </a>
              </div>
            </section>

            {data.user.is_admin ? (
              <Link href="/admin" className="pw-team-link">
                <span>
                  <ShieldCheck size={19} aria-hidden="true" />
                  <span>
                    <strong>Team approvals</strong>
                    <small>Profiles, memberships and reviews</small>
                  </span>
                </span>
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            ) : null}

            {membership.moderation_reason &&
            ["rejected", "suspended"].includes(membership.moderation_status) ? (
              <div className="pw-review-note">
                <ShieldCheck size={19} aria-hidden="true" />
                <div>
                  <strong>A note from the team</strong>
                  <p>{membership.moderation_reason}</p>
                  {membership.moderation_status === "rejected" ? (
                    <button type="button" onClick={() => openEditor("about")}>
                      Update your profile for another review{" "}
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <section className="pw-content-card">
              <div className="pw-card-heading">
                <h2>About</h2>
                {editButton("about", "Edit about")}
              </div>
              {owner.bio ? (
                <p className="pw-about-text">{owner.bio}</p>
              ) : (
                <div className="pw-empty-content">
                  <p>
                    A few lines about you help people start a better
                    conversation.
                  </p>
                  <button type="button" onClick={() => openEditor("about")}>
                    <Plus size={16} aria-hidden="true" /> Add an introduction
                  </button>
                </div>
              )}
            </section>

            <section className="pw-content-card">
              <div className="pw-card-heading">
                <h2>Expertise & languages</h2>
                {editButton("about", "Edit expertise and languages")}
              </div>
              {owner.specialties.length ? (
                <div className="pw-specialty-list">
                  {owner.specialties.map((specialty, index) => (
                    <span key={`${specialty}-${index}`}>{specialty}</span>
                  ))}
                </div>
              ) : (
                <div className="pw-empty-content">
                  <p>What do people come to you for?</p>
                  <button type="button" onClick={() => openEditor("about")}>
                    <Plus size={16} aria-hidden="true" /> Add your expertise
                  </button>
                </div>
              )}
              {owner.languages.length ? (
                <p className="pw-language-line">
                  <Globe2 size={17} aria-hidden="true" />
                  {owner.languages.join(" · ")}
                </p>
              ) : null}
            </section>

            <section className="pw-content-card" id="owner-work">
              <div className="pw-card-heading">
                <h2>Previous work</h2>
                {editButton("work", "Edit previous work")}
              </div>
              {owner.portfolio.length ? (
                <div className="pw-project-grid">
                  {owner.portfolio.map((project, index) => (
                    <article className="pw-project-card" key={index}>
                      {project.image_url ? (
                        <img src={project.image_url} alt={project.title} />
                      ) : (
                        <div className="pw-project-placeholder">
                          <BriefcaseBusiness
                            size={30}
                            strokeWidth={1.2}
                            aria-hidden="true"
                          />
                        </div>
                      )}
                      <div>
                        <h3>{project.title}</h3>
                        <p>{project.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="pw-empty-content">
                  <p>Let your work tell a little of your story.</p>
                  <button type="button" onClick={() => openEditor("work")}>
                    <Plus size={16} aria-hidden="true" /> Add a project
                  </button>
                </div>
              )}
            </section>

            <section className="pw-content-card">
              <div className="pw-card-heading">
                <h2>Achievements</h2>
                {editButton("experience", "Edit achievements")}
              </div>
              {owner.achievements.length ? (
                <ul className="pw-achievement-list">
                  {owner.achievements.map((achievement, index) => (
                    <li key={index}>
                      <Check size={17} aria-hidden="true" />
                      <span>{achievement}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="pw-empty-content">
                  <p>
                    A milestone, a qualification or something you’re proud of.
                  </p>
                  <button
                    type="button"
                    onClick={() => openEditor("experience")}
                  >
                    <Plus size={16} aria-hidden="true" /> Add an achievement
                  </button>
                </div>
              )}
              {owner.achievements.length ? (
                <p className="pw-private-note">
                  Achievements are shared as your own statements.
                </p>
              ) : null}
            </section>
          </div>
          <aside className="pw-profile-side">
            <section className="pw-side-card">
              <div className="pw-card-heading">
                <h2>Membership</h2>
                <CreditCard size={19} aria-hidden="true" />
              </div>
              <span
                className={`pw-membership-status ${membership.active ? "is-active" : ""}`}
              >
                <span />
                {membership.active
                  ? "Active"
                  : pending
                    ? "Awaiting approval"
                    : "Not active"}
              </span>
              <p>
                {membership.current
                  ? `${PLAN_DETAILS[membership.current.plan].label} · through ${formatDate(membership.current.expires_at)}`
                  : isChina
                    ? "China membership · 1,000 RMB / year"
                    : "Global membership · 100 RMB / month, or an eligible trip year included"}
              </p>
              <button
                type="button"
                className="pw-row-action"
                onClick={() => changeView("membership")}
              >
                {membership.active
                  ? "Manage membership"
                  : pending
                    ? "View your request"
                    : "Activate membership"}
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </section>
            <section className="pw-side-card pw-privacy-card">
              <LockKeyhole size={19} aria-hidden="true" />
              <h2>Your profile, your space.</h2>
              <p>
                {isChina
                  ? "Your China profile appears in the network after team approval and membership activation."
                  : owner.network_visible
                    ? "You’ve chosen to share your profile with the network, subject to approval and active membership."
                    : "Your profile stays out of discovery. You can still explore and send requests with an active membership."}
              </p>
              <button
                type="button"
                className="pw-row-action"
                onClick={() => changeView("settings")}
              >
                Privacy & account
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </section>
          </aside>
        </div>
      ) : null}

      {view === "edit" ? (
        <section className="pw-editor" aria-labelledby="profile-edit-title">
          <div className="pw-editor-heading">
            <h1 ref={editorTitleRef} tabIndex={-1} id="profile-edit-title">
              {sectionTitles[editSection]}
            </h1>
            <p>
              Make it feel like you. Everything is already filled in from your
              profile.
            </p>
          </div>
          <nav className="pw-editor-nav" aria-label="Edit profile section">
            {(
              [
                "intro",
                "about",
                "work",
                "experience",
                ...(!isChina ? ["visibility"] : []),
              ] as Array<typeof editSection>
            ).map((section) => (
              <button
                key={section}
                type="button"
                aria-pressed={editSection === section}
                disabled={saving}
                onClick={() => selectEditor(section, true)}
              >
                {section === "intro"
                  ? "Intro"
                  : section === "about"
                    ? "About"
                    : section === "work"
                      ? "Work"
                      : section === "experience"
                        ? "Achievements"
                        : "Visibility"}
              </button>
            ))}
          </nav>
          <form id="profile-form" onSubmit={saveProfile} aria-busy={saving}>
            <fieldset className="pw-edit-fields" disabled={saving}>
              {editSection === "intro" ? (
                <>
                  <div className="pw-edit-cover">
                    {profile.cover_url ? (
                      <img src={profile.cover_url} alt="Your cover photo" />
                    ) : (
                      <div>
                        <ImagePlus size={34} aria-hidden="true" />
                        <span>Add a cover photo</span>
                      </div>
                    )}
                    <label className="pw-photo-control ac-upload-label">
                      <Camera size={17} aria-hidden="true" />
                      {uploading === "cover" ? "Uploading…" : "Change cover"}
                      <input
                        aria-label="Upload cover photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={Boolean(uploading)}
                        onChange={(event) => {
                          void uploadPhoto(event.target.files?.[0], "cover");
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="pw-edit-avatar-row">
                    <div className="pw-owner-avatar">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Your profile photo"
                        />
                      ) : (
                        <span>{initials(profile.full_name)}</span>
                      )}
                    </div>
                    <div>
                      <label className="pw-photo-control ac-upload-label">
                        <Camera size={17} aria-hidden="true" />
                        {uploading === "avatar" ? "Uploading…" : "Change photo"}
                        <input
                          aria-label="Upload your profile photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={Boolean(uploading)}
                          onChange={(event) => {
                            void uploadPhoto(event.target.files?.[0], "avatar");
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <p className="pw-field-help">
                        JPG, PNG or WebP · up to 4 MB
                      </p>
                    </div>
                  </div>
                  <label className="field">
                    Name
                    <input
                      className="input"
                      autoComplete="name"
                      required
                      maxLength={100}
                      value={profile.full_name}
                      onChange={(event) =>
                        edit("full_name", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    Company or business
                    <input
                      className="input"
                      autoComplete="organization"
                      maxLength={150}
                      value={profile.company}
                      onChange={(event) => edit("company", event.target.value)}
                      placeholder="Where you work or what you run"
                    />
                  </label>
                  <label className="field">
                    City
                    <input
                      className="input"
                      autoComplete="address-level2"
                      required
                      maxLength={100}
                      value={profile.city}
                      onChange={(event) => edit("city", event.target.value)}
                      placeholder={
                        isChina ? "Guangzhou, China" : "Your city and country"
                      }
                    />
                  </label>
                </>
              ) : null}

              {editSection === "about" ? (
                <>
                  <label className="field">
                    About you
                    <textarea
                      className="input"
                      rows={6}
                      maxLength={2000}
                      value={profile.bio}
                      onChange={(event) => edit("bio", event.target.value)}
                      placeholder="What do you do, and what would you like to connect over?"
                    />
                    <span className="pw-field-help">
                      {profile.bio.length}/2,000 · Keep personal contact details
                      out of your public profile.
                    </span>
                  </label>
                  <label className="field">
                    Expertise
                    <input
                      className="input"
                      maxLength={600}
                      value={specialties}
                      onChange={(event) => setSpecialties(event.target.value)}
                      placeholder="Sourcing, Canton Fair, logistics"
                    />
                    <span className="pw-field-help">
                      Up to 12 specialties, separated by commas.
                    </span>
                  </label>
                  <label className="field">
                    Languages
                    <input
                      className="input"
                      maxLength={300}
                      value={languages}
                      onChange={(event) => setLanguages(event.target.value)}
                      placeholder="English, Mandarin, Malayalam"
                    />
                    <span className="pw-field-help">
                      Up to 12 languages, separated by commas.
                    </span>
                  </label>
                  <p className="pw-editor-note">
                    <LockKeyhole size={16} aria-hidden="true" />
                    Account emails are shared only after both members consent to
                    a connection.
                  </p>
                </>
              ) : null}

              {editSection === "experience" ? (
                <label className="field">
                  Achievements
                  <textarea
                    className="input"
                    rows={7}
                    maxLength={4000}
                    value={achievements}
                    onChange={(event) => setAchievements(event.target.value)}
                    placeholder="Share a milestone, qualification or achievement. Add one per line."
                  />
                  <span className="pw-field-help">
                    Up to 12 achievements, one per line, each under 500
                    characters. These are shared as your own statements.
                  </span>
                </label>
              ) : null}

              {editSection === "work" ? (
                <div className="pw-work-editor">
                  <div className="pw-work-editor-heading">
                    <p>Share projects you’ve worked on.</p>
                    <button
                      type="button"
                      className="pw-outline-button"
                      disabled={
                        Boolean(uploading) || profile.portfolio.length >= 12
                      }
                      onClick={() =>
                        edit("portfolio", [
                          ...profile.portfolio,
                          { title: "", description: "", image_url: "" },
                        ])
                      }
                    >
                      <Plus size={17} aria-hidden="true" /> Add project
                    </button>
                  </div>
                  {!profile.portfolio.length ? (
                    <div className="pw-editor-empty">
                      <BriefcaseBusiness size={32} aria-hidden="true" />
                      <p>
                        Your first project can start with a title and a few
                        useful details.
                      </p>
                    </div>
                  ) : null}
                  {profile.portfolio.map((project, index) => (
                    <div className="pw-project-editor" key={index}>
                      <div className="pw-project-editor-heading">
                        <strong>Project {index + 1}</strong>
                        <button
                          type="button"
                          className="pw-icon-button pw-remove-project"
                          aria-label={`Remove project ${index + 1}`}
                          disabled={Boolean(uploading)}
                          onClick={() =>
                            edit(
                              "portfolio",
                              profile.portfolio.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="pw-project-photo">
                        {project.image_url ? (
                          <img
                            src={project.image_url}
                            alt={project.title || `Project ${index + 1}`}
                          />
                        ) : (
                          <ImagePlus size={28} aria-hidden="true" />
                        )}
                        <label className="pw-photo-control ac-upload-label">
                          <Camera size={16} aria-hidden="true" />
                          {uploading === `portfolio${index}`
                            ? "Uploading…"
                            : project.image_url
                              ? "Change photo"
                              : "Add photo"}
                          <input
                            aria-label={`Upload photo for project ${index + 1}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={Boolean(uploading)}
                            onChange={(event) => {
                              void uploadPhoto(
                                event.target.files?.[0],
                                "portfolio",
                                index,
                              );
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <label className="field">
                        Project title
                        <input
                          className="input"
                          required
                          maxLength={150}
                          value={project.title}
                          onChange={(event) =>
                            edit(
                              "portfolio",
                              profile.portfolio.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, title: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="What did you work on?"
                        />
                      </label>
                      <label className="field">
                        Your work
                        <textarea
                          className="input"
                          rows={3}
                          maxLength={1000}
                          value={project.description}
                          onChange={(event) =>
                            edit(
                              "portfolio",
                              profile.portfolio.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, description: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Your role, the brief and the outcome"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              ) : null}

              {editSection === "visibility" && !isChina ? (
                <div className="pw-visibility-editor">
                  <Globe2 size={28} aria-hidden="true" />
                  <h2>Be part of the conversation.</h2>
                  <label className="pw-visibility-choice">
                    <input
                      type="checkbox"
                      checked={profile.network_visible === true}
                      onChange={(event) =>
                        edit("network_visible", event.target.checked)
                      }
                    />
                    <span>
                      <strong>
                        Show my Global profile in the public network
                      </strong>
                      <small>
                        After team approval and membership activation.
                      </small>
                    </span>
                  </label>
                  <p>
                    Your name, city, company, story, images, achievements and
                    previous work will be public. Global members can send you
                    requests; China members can view your profile.
                  </p>
                  <p>
                    Leave this off to stay out of the directory while you
                    discover and send requests. Publishing or editing a
                    published profile pauses connection access until the team
                    approves it, even if you hide it again while review is
                    pending.
                  </p>
                </div>
              ) : null}
            </fieldset>
            <div className="pw-editor-footer">
              <p>
                {saving
                  ? "Saving your changes…"
                  : uploading
                    ? "Image upload in progress…"
                    : profileDirty
                      ? draftKept
                        ? "Draft kept in this tab"
                        : "Unsaved changes"
                      : "You’re up to date"}
              </p>
              <button
                className="btn btn-dark"
                type="submit"
                disabled={saving || Boolean(uploading)}
              >
                {saving ? "Saving…" : "Save changes"}
                <Check size={17} aria-hidden="true" />
              </button>
            </div>
            <p className="pw-review-explanation">
              {isChina || profile.network_visible
                ? "Changes to a published profile return to team review. Your recorded membership period is unchanged."
                : "Your profile remains private unless you choose to share it with the network."}
            </p>
          </form>
        </section>
      ) : null}

      {view === "membership" ? (
        <section
          className="pw-membership-view"
          aria-labelledby="membership-view-heading"
        >
          <div className="pw-section-intro">
            <h1 id="membership-view-heading">Your membership</h1>
            <p>One place for your plan, renewal and team approval.</p>
          </div>
          <aside
            className="ac-membership-column pw-membership-layout"
            id="profile-membership"
            aria-label="Your membership"
          >
            <section className="ac-membership-card">
              <div className="ac-membership-top">
                <span className="eyebrow">Your membership</span>
                <span
                  className={`ac-status ${membership.active ? "ac-status-active" : ""}`}
                >
                  {membership.active
                    ? "Active"
                    : pending
                      ? "In review"
                      : "Not active"}
                </span>
              </div>
              <span className="ac-membership-symbol" aria-hidden="true">
                <Globe2 size={30} aria-hidden="true" />
              </span>
              <h2>
                Ambro Connect
                <br />
                <em>{isChina ? "China" : "Global"}</em>
              </h2>
              <p>
                {isChina
                  ? "Your local expertise. A world of new connections."
                  : "Good people. New perspectives. Real possibilities."}
              </p>
              <div className="ac-membership-facts">
                <div>
                  <span>Profile review</span>
                  <strong>
                    {membership.moderation_status === "approved"
                      ? "Approved"
                      : membership.moderation_status === "pending"
                        ? "Pending"
                        : membership.moderation_status === "suspended"
                          ? "Suspended"
                          : "Needs attention"}
                  </strong>
                </div>
                {membership.current ? (
                  <>
                    <div>
                      <span>Current plan</span>
                      <strong>
                        {membership.current.plan === "trip_year"
                          ? "Trip benefit · 1 year"
                          : `${PLAN_DETAILS[membership.current.plan].amount.toLocaleString()} RMB / ${PLAN_DETAILS[membership.current.plan].duration}`}
                      </strong>
                    </div>
                    <div>
                      <span>{"Membership through"}</span>
                      <strong>
                        {formatDate(membership.current.expires_at)}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div>
                    <span>Membership begins</span>
                    <strong>After team approval</strong>
                  </div>
                )}
              </div>
              {membership.moderation_reason &&
              ["rejected", "suspended"].includes(
                membership.moderation_status,
              ) ? (
                <p className="ac-moderation-reason">
                  <strong>A note from the team</strong>
                  {membership.moderation_reason}
                  {membership.moderation_status === "rejected" ? (
                    <span className="ac-resubmit-help">
                      Correct your profile and save it to submit it for another
                      review.
                    </span>
                  ) : null}
                </p>
              ) : null}
            </section>

            <section className="panel ac-membership-form">
              <span className="eyebrow">A few details, then you’re in</span>
              <h3>
                {pending
                  ? "Your request is with us."
                  : membership.active
                    ? "Extend your connections."
                    : "Activate your membership."}
              </h3>
              {pending ? (
                <div className="ac-pending-box">
                  <span className="ac-status">Awaiting approval</span>
                  <p>{PLAN_DETAILS[pending.plan].label}</p>
                  <dl>
                    <div>
                      <dt>Reference</dt>
                      <dd>{pending.reference}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{formatDate(pending.created_at)}</dd>
                    </div>
                  </dl>
                  <p className="ac-help">
                    The Mandarin Roots team will check your details. Submission
                    does not activate membership.
                  </p>
                </div>
              ) : (
                <form onSubmit={submitMembership} aria-busy={submitting}>
                  <fieldset
                    className="ac-membership-fields"
                    disabled={submitting}
                  >
                    {!isChina ? (
                      <fieldset className="ac-plan-options">
                        <legend>Membership option</legend>
                        <label
                          className={
                            plan === "global_monthly" ? "is-selected" : ""
                          }
                        >
                          <input
                            type="radio"
                            name="membership-plan"
                            value="global_monthly"
                            checked={plan === "global_monthly"}
                            onChange={() => setPlan("global_monthly")}
                          />
                          <span>
                            <strong>Monthly membership</strong>
                            <small>100 RMB / month</small>
                          </span>
                        </label>
                        <label
                          className={plan === "trip_year" ? "is-selected" : ""}
                        >
                          <input
                            type="radio"
                            name="membership-plan"
                            value="trip_year"
                            checked={plan === "trip_year"}
                            onChange={() => setPlan("trip_year")}
                          />
                          <span>
                            <strong>I’m joining an Ambro trip</strong>
                            <small>
                              First year included after booking verification
                            </small>
                          </span>
                        </label>
                      </fieldset>
                    ) : (
                      <div className="ac-price-line">
                        <strong>
                          1,000 <span>RMB</span>
                        </strong>
                        <span>for one year</span>
                      </div>
                    )}
                    <p className="muted ac-payment-explanation">
                      {plan === "trip_year"
                        ? "Add your Mandarin Roots trip booking reference. Your included year starts when the team approves your booking."
                        : "Arrange payment with the Mandarin Roots team, then submit your payment reference here for confirmation."}
                    </p>
                    <label className="field">
                      {plan === "trip_year"
                        ? "Trip booking reference"
                        : "Payment reference"}
                      <input
                        className="input"
                        required
                        minLength={3}
                        maxLength={200}
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder={
                          plan === "trip_year"
                            ? "Your booking or invoice number"
                            : "Transaction or payment reference"
                        }
                      />
                    </label>
                    <label className="field ac-field-space">
                      Note <span className="ac-optional">(optional)</span>
                      <textarea
                        className="input"
                        rows={3}
                        maxLength={1000}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={
                          plan === "trip_year"
                            ? "Trip date or anything we should know."
                            : "Payment date, sender name or useful details."
                        }
                      />
                    </label>
                    <button
                      className="btn btn-dark ac-full-button"
                      disabled={submitting}
                      type="submit"
                    >
                      {submitting
                        ? "Sending for review…"
                        : "Submit for approval"}{" "}
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                    <p className="ac-help ac-membership-disclaimer">
                      Manually reviewed by Mandarin Roots. Access starts after
                      approval.
                    </p>
                  </fieldset>
                </form>
              )}
            </section>

            {membership.requests.some(
              (request) => request.status !== "pending",
            ) ? (
              <section className="panel ac-request-history">
                <h3>Recent requests</h3>
                {membership.requests
                  .filter((request) => request.status !== "pending")
                  .slice(0, 3)
                  .map((request) => (
                    <div className="ac-history-item" key={request.id}>
                      <div>
                        <strong>
                          {request.plan === "trip_year"
                            ? "Trip benefit"
                            : "Membership payment"}
                        </strong>
                        <span
                          className={`ac-status ${request.status === "approved" ? "ac-status-active" : "ac-status-declined"}`}
                        >
                          {request.status}
                        </span>
                      </div>
                      <p className="ac-help">
                        {formatDate(request.created_at)} · {request.reference}
                      </p>
                      {request.rejection_reason ? (
                        <p className="ac-history-reason">
                          {request.rejection_reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </section>
            ) : null}
            {data.user.is_admin ? (
              <Link className="ac-admin-link" href="/admin">
                Open team dashboard{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            ) : null}
          </aside>
        </section>
      ) : null}

      {view === "settings" ? (
        <section
          className="pw-settings-view"
          aria-labelledby="settings-heading"
        >
          <div className="pw-section-intro">
            <h1 id="settings-heading">Account settings</h1>
            <p>The private side of your profile.</p>
          </div>
          <div className="pw-content-card">
            <div className="pw-card-heading">
              <h2>Account</h2>
              <LockKeyhole size={19} aria-hidden="true" />
            </div>
            <div className="pw-account-detail">
              <span>Sign-in email</span>
              <strong>{data.user.email}</strong>
              <small>
                Private. Your account email is shared with another member only
                after you both consent to a connection.
              </small>
            </div>
            <button
              className="pw-settings-row"
              type="button"
              onClick={logout}
              disabled={
                loggingOut || saving || submitting || Boolean(uploading)
              }
            >
              <span>
                <LogOut size={18} aria-hidden="true" />
                {loggingOut ? "Signing out…" : "Sign out"}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="pw-content-card">
            <div className="pw-card-heading">
              <h2>Profile visibility</h2>
              <Globe2 size={19} aria-hidden="true" />
            </div>
            <p className="pw-settings-copy">
              {isChina
                ? "Your China profile is discoverable when the team approves it and membership is active."
                : owner.network_visible
                  ? "You’ve chosen to appear in the public network, subject to team approval and active membership."
                  : "Your Global profile is private. You can choose to appear in the public network."}
            </p>
            {!isChina ? (
              <button
                className="pw-settings-row"
                type="button"
                onClick={() => openEditor("visibility")}
              >
                <span>
                  <Pencil size={18} aria-hidden="true" />
                  Manage profile visibility
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="pw-content-card pw-help-settings">
            <Link className="pw-settings-row" href="/how-to-use">
              <span>
                <CircleHelp size={18} aria-hidden="true" />
                How to use Ambro Connects
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <Link className="pw-settings-row" href="/privacy">
              <span>
                <LockKeyhole size={18} aria-hidden="true" />
                Privacy notice
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            {data.user.is_admin ? (
              <Link className="pw-settings-row" href="/admin">
                <span>
                  <ShieldCheck size={18} aria-hidden="true" />
                  Team approvals
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === "edit" ? (
        <div
          className="ac-mobile-save pw-mobile-save"
          aria-label="Save profile changes"
        >
          <span>
            <strong>
              {saving
                ? "Saving…"
                : uploading
                  ? "Uploading…"
                  : profileDirty
                    ? "Draft changes"
                    : "Your profile"}
            </strong>
            <small>
              {draftKept && profileDirty
                ? "Kept in this tab"
                : "Save when you’re ready"}
            </small>
          </span>
          <button
            className="btn btn-dark"
            type="submit"
            form="profile-form"
            disabled={saving || Boolean(uploading)}
          >
            {saving ? "Saving…" : "Save changes"}
            <Check size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default Account;
