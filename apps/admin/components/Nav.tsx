"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Funnel" },
  { href: "/outreach", label: "Outreach" },
  { href: "/leads", label: "Leads" },
  { href: "/review", label: "Review" },
  { href: "/deals", label: "Deals" },
  { href: "/jobs", label: "Jobs" },
  { href: "/mockups", label: "Mockups" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="app-nav">
      <div className="inner">
        <Link href="/" className="brand">
          Reviv<em>o</em>
        </Link>
        <div className="links">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={active ? "active" : ""}>
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
