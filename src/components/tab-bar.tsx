"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { esActiva } from "./main-nav";

/** Barra inferior de móvil (< 640px). Cinco destinos, los del diseño. */
const TABS = [
  { href: "/", label: "Inicio" },
  { href: "/rutinas", label: "Rutinas" },
  { href: "/entrenar", label: "Entrenar" },
  { href: "/progreso", label: "Progreso" },
  { href: "/coach", label: "Coach" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Navegación principal">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={esActiva(pathname, t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
