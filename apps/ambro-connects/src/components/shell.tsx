"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Compass,
  Globe2,
  Users,
  UserRound,
  Menu,
  X,
  ArrowRight,
  Home,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Brand() {
  return (
    <span className="brand">
      <img
        className="brand-image"
        src="/brand/ambro-connects-logo-web.png"
        alt="Ambro Connects"
        width={640}
        height={158}
      />
    </span>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    const media = window.matchMedia("(max-width: 1000px)");
    const closeOnDesktop = () => {
      if (!media.matches) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    media.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", closeOnEscape);
      media.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);
  useEffect(() => {
    const viewport = window.visualViewport;
    let baseline = window.innerHeight;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = document.activeElement;
        const editing =
          element instanceof HTMLTextAreaElement ||
          (element instanceof HTMLInputElement &&
            !["checkbox", "radio", "button", "submit", "file"].includes(
              element.type,
            ));
        if (!editing) baseline = window.innerHeight;
        const height = viewport?.height ?? window.innerHeight;
        const keyboard =
          window.innerWidth <= 760 &&
          editing &&
          (window.innerHeight - height > 140 || baseline - height > 180);
        document.documentElement.dataset.keyboardOpen = keyboard
          ? "true"
          : "false";
      });
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      delete document.documentElement.dataset.keyboardOpen;
    };
  }, []);
  const links = [
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/connections", label: "Connections", icon: Users },
    { href: "/account", label: "My space", icon: UserRound },
  ];
  const activeTab = (href: string) =>
    href === "/"
      ? path === "/"
      : href === "/discover"
        ? path === "/discover" || path.startsWith("/members/")
        : href === "/account"
          ? ["/account", "/admin", "/login", "/join", "/auth/"].some((route) =>
              path.startsWith(route),
            )
          : path.startsWith(href);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" aria-label="Ambro Connects home">
            <Brand />
          </Link>
          <nav aria-label="Main navigation" className="desktop-nav">
            <Link
              className={path === "/discover" ? "active" : ""}
              href="/discover"
            >
              Discover the network
            </Link>
            <Link
              className={path === "/how-to-use" ? "active" : ""}
              href="/how-to-use"
            >
              How to use
            </Link>
            <Link href="/#memberships">Memberships</Link>
            <Link href="/connections">Connections</Link>
          </nav>
          <div className="header-actions">
            <Link href="/account" className="sign-in">
              My space
            </Link>
            <Link
              href="/join"
              className="btn btn-dark small header-join"
              aria-label="Join the circle"
            >
              <span className="header-join-label">Join the circle</span>
              <span className="header-join-short" aria-hidden="true">
                Join
              </span>{" "}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <button
            ref={menuButton}
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav
            id="mobile-menu"
            className="mobile-menu"
            aria-label="Mobile navigation"
          >
            {[
              ...links,
              { href: "/#memberships", label: "Memberships", icon: Globe2 },
              { href: "/how-to-use", label: "How to use", icon: Compass },
              { href: "/admin", label: "Team approvals", icon: Users },
              { href: "/login", label: "Sign in", icon: UserRound },
            ].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
                <ArrowRight size={18} />
              </Link>
            ))}
          </nav>
        )}
      </header>
      {open ? (
        <button
          className="mobile-menu-scrim"
          tabIndex={-1}
          aria-label="Dismiss navigation"
          onClick={() => {
            setOpen(false);
            menuButton.current?.focus();
          }}
        />
      ) : null}
      <main id="main" inert={open || undefined}>
        {children}
      </main>
      <footer className="site-footer" inert={open || undefined}>
        <div className="container footer-top">
          <Link href="/">
            <Brand />
          </Link>
          <p>
            A world of possibilities.
            <br />A connection away.
          </p>
          <div>
            <Link href="/discover">
              Find your people <ArrowUpRight size={16} />
            </Link>
            <Link href="/join?type=china">
              Become a China connect <ArrowUpRight size={16} />
            </Link>
            <Link href="/how-to-use">
              How to use <ArrowUpRight size={16} />
            </Link>
            <Link href="/admin">
              Team approvals <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>By Ambro & Mandarin Roots · {new Date().getFullYear()}</span>
          <div>
            <Link href="/community">Community guidelines</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Membership terms</Link>
          </div>
          <span className="footer-location">
            <span /> Connected across borders
          </span>
        </div>
      </footer>
      <nav
        className="bottom-nav"
        aria-label="Member navigation"
        inert={open || undefined}
      >
        {[{ href: "/", label: "Home", icon: Home }, ...links].map(
          ({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={activeTab(href) ? "active" : ""}
              aria-current={activeTab(href) ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{label}</span>
            </Link>
          ),
        )}
      </nav>
    </>
  );
}
