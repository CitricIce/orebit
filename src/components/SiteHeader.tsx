"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMounted } from "@/lib/client/useMounted";
import { setSoundEnabled, soundEnabled } from "@/lib/client/storage";
import s from "./SiteHeader.module.css";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/archive", label: "Archive" },
  { href: "/stats", label: "Stats" },
];

export function Logo() {
  return (
    <svg className={s.logo} viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="16" rx="14.5" ry="5.5" fill="none" stroke="#ffb547" strokeWidth="1.6" transform="rotate(-24 16 16)" />
      <path d="M16 6.5c4.6 0 8.6 3.4 8.6 8.9 0 5.3-3.7 9.6-8.8 9.6-5.2 0-8.7-3.9-8.7-9 0-5.2 3.9-9.5 8.9-9.5z" fill="#3b2f47" />
      <circle cx="13" cy="13" r="2" fill="#2a2033" />
      <circle cx="19" cy="19" r="1.4" fill="#2a2033" />
      <path d="M19.5 10.5l2 2-2 2-2-2z" fill="#6ff3e6" />
      <path
        d="M4.2 21.2C8 23.6 13 24.5 18 23.6"
        fill="none"
        stroke="#ffb547"
        strokeWidth="1.6"
        strokeLinecap="round"
        transform="rotate(0 16 16)"
      />
    </svg>
  );
}

export default function SiteHeader({ static: isStatic = false }: { static?: boolean }) {
  return isStatic ? <HeaderBody path="" /> : <LiveHeader />;
}

function LiveHeader() {
  return <HeaderBody path={usePathname()} />;
}

function HeaderBody({ path }: { path: string }) {
  const mounted = useMounted();
  const [override, setOverride] = useState<boolean | null>(null);
  const sound = override ?? (mounted ? soundEnabled() : true);

  const toggle = () => {
    setSoundEnabled(!sound);
    setOverride(!sound);
  };

  return (
    <header className={s.header}>
      <Link href="/" className={s.brand} aria-label="Orebit home">
        <Logo />
        <span className={s.word}>OREBIT</span>
      </Link>
      <nav className={s.nav} aria-label="Main">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={s.link} data-active={active}>
              {l.label}
            </Link>
          );
        })}
        <button
          className={s.sound}
          onClick={toggle}
          aria-pressed={sound}
          aria-label={sound ? "Mute sound" : "Turn sound on"}
          title={sound ? "Mute sound" : "Turn sound on"}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
            {sound ? (
              <path d="M13 7c1.2 1.6 1.2 4.4 0 6M15.5 5c2.3 2.8 2.3 7.2 0 10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M13 7.5l5 5M18 7.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>
    </header>
  );
}
