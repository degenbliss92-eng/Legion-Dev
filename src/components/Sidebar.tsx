"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Rocket, Mail, Github, Twitter } from "lucide-react";
import SolPriceTicker from "./SolPriceTicker";
import styles from "./Sidebar.module.css";
import { useSwarm } from "@/context/SwarmProvider";

const nav = [
  { href: "/", icon: Home, label: "BrainHouse" },
  { href: "/principals", icon: BookOpen, label: "Principals" },
  { href: "/top-spawns", icon: Rocket, label: "Top Spawns" },
  { href: "/commune", icon: Mail, label: "Commune" },
  { href: "https://x.com/yourhandle", icon: Twitter, label: "Twitter X", external: true },
  { href: "https://github.com/yourrepo", icon: Github, label: "GitHub", external: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { unreadCommuneCount } = useSwarm();

  return (
    <aside className={styles.sidebar} aria-label="Main">
      <div className={styles.logo}>
        <Link href="/" aria-label="Legion Network">
          <img src="/logo.png" alt="Legion Logo" className={styles.logoImg} />
        </Link>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.list}>
          {nav.map(({ href, icon: Icon, label, external }) => {
            const active = pathname === href;
            const showBadge = href === "/commune" && unreadCommuneCount > 0;

            return (
              <li key={href} className={styles.item} id={href === "/commune" ? "nav-commune" : undefined}>
                {external ? (
                  <a
                    href={href}
                    aria-label={label}
                    title={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.link}`}
                  >
                    <Icon className={styles.icon} aria-hidden="true" />
                  </a>
                ) : (
                  <Link
                    href={href}
                    aria-label={label}
                    title={label}
                    className={`${styles.link} ${active ? styles.active : ""}`}
                  >
                    <Icon className={styles.icon} aria-hidden="true" />
                    {showBadge && (
                      <span className={styles.badge}>
                        {unreadCommuneCount > 99 ? "99+" : unreadCommuneCount}
                      </span>
                    )}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.ticker}>
        <SolPriceTicker />
      </div>
    </aside>
  );
}
