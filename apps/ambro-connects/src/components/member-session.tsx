"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MeResponse } from "@/lib/types";

export type MemberSessionStatus =
  | "loading"
  | "authenticated"
  | "anonymous"
  | "error";
export type MemberSession = {
  data: MeResponse | null;
  status: MemberSessionStatus;
  /**
   * Verifies /api/me. Concurrent callers share one pending request. Resolves
   * only with that request's fresh response, or null on failure/cancellation.
   * A null preflight must stop a mutation; never substitute cached identity.
   */
  refresh: () => Promise<MeResponse | null>;
  /** Applies a fresh /api/me response and invalidates any pending read. */
  update: (serverMe: MeResponse) => void;
  /** Clears identity after confirmed logout and invalidates pending reads. */
  clear: () => void;
};
const MemberSessionContext = createContext<MemberSession | null>(null);

function isMeResponse(value: unknown): value is MeResponse {
  if (
    !value ||
    typeof value !== "object" ||
    !("configured" in value) ||
    typeof value.configured !== "boolean" ||
    !("connections" in value) ||
    !Array.isArray(value.connections) ||
    !("user" in value)
  )
    return false;
  if (value.user === null) return true;
  return Boolean(
    value.user &&
      typeof value.user === "object" &&
      "id" in value.user &&
      typeof value.user.id === "string" &&
      "email" in value.user &&
      typeof value.user.email === "string" &&
      "is_admin" in value.user &&
      typeof value.user.is_admin === "boolean",
  );
}

export function MemberSessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<MemberSessionStatus>("loading");
  const revision = useRef(0);
  const request = useRef<AbortController | null>(null);
  const pending = useRef<Promise<MeResponse | null> | null>(null);

  // Call only with a fresh /api/me response, never browser-stored identity hints.
  const update = useCallback((serverMe: MeResponse) => {
    if (!isMeResponse(serverMe)) return;
    revision.current += 1;
    request.current?.abort();
    request.current = null;
    pending.current = null;
    setData(serverMe);
    setStatus(
      !serverMe.configured
        ? "error"
        : serverMe.user
          ? "authenticated"
          : "anonymous",
    );
  }, []);

  // The caller clears this only after the logout endpoint confirms success.
  const clear = useCallback(() => {
    revision.current += 1;
    request.current?.abort();
    request.current = null;
    pending.current = null;
    setData(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback((): Promise<MeResponse | null> => {
    if (pending.current) return pending.current;
    const version = ++revision.current;
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    // Start in a microtask so the shared promise is installed before even a
    // synchronously failing fetch can complete its cleanup.
    const operation = Promise.resolve().then(async () => {
      try {
        if (controller.signal.aborted || version !== revision.current)
          return null;
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!response.ok || !isMeResponse(result) || !result.configured)
          throw new Error("Your account could not be verified.");
        if (controller.signal.aborted || version !== revision.current)
          return null;
        setData(result);
        setStatus(result.user ? "authenticated" : "anonymous");
        return result;
      } catch {
        if (controller.signal.aborted || version !== revision.current)
          return null;
        setData(null);
        setStatus("error");
        return null;
      } finally {
        if (version === revision.current) {
          request.current = null;
          pending.current = null;
        }
      }
    });
    pending.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    void refresh();
    const verifyOnFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", verifyOnFocus);
    document.addEventListener("visibilitychange", verifyOnFocus);
    return () => {
      revision.current += 1;
      request.current?.abort();
      request.current = null;
      pending.current = null;
      window.removeEventListener("focus", verifyOnFocus);
      document.removeEventListener("visibilitychange", verifyOnFocus);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ data, status, refresh, update, clear }),
    [data, status, refresh, update, clear],
  );
  return (
    <MemberSessionContext.Provider value={value}>
      {children}
    </MemberSessionContext.Provider>
  );
}

export function useMemberSession() {
  const session = useContext(MemberSessionContext);
  if (!session)
    throw new Error(
      "useMemberSession must be used inside MemberSessionProvider.",
    );
  return session;
}
