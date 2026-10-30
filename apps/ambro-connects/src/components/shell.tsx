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
} from "lucide-react";
import { useState } from "react";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol" aria-hidden="true">
        a<span>↗</span>
      </span>
      <span>
        ambro
        <span className="brand-second">
          connects<span className="brand-dot">.</span>
        </span>
      </span>
    </span>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/connections", label: "Connections", icon: Users },
    { href: "/account", label: "My space", icon: UserRound },
  ];
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
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#memberships">Memberships</Link>
            <Link href="/connections">Connections</Link>
          </nav>
          <div className="header-actions">
            <Link href="/account" className="sign-in">
              My space
            </Link>
            <Link href="/join" className="btn btn-dark small">
              Join the circle <ArrowUpRight size={16} />
            </Link>
          </div>
          <button
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
      <main id="main">{children}</main>
      <footer className="site-footer">
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
      <nav className="bottom-nav" aria-label="Member navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={path.startsWith(href) ? "active" : ""}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
        <Link href="/join" className={path === "/join" ? "active" : ""}>
          <Globe2 size={21} />
          <span>Join</span>
        </Link>
      </nav>
    </>
  );
}
