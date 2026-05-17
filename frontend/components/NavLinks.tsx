"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"

const links = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/kanban",    label: "カンバン" },
  { href: "/companies", label: "企業一覧" },
  { href: "/settings",  label: "設定" },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-slate-700 hover:text-white"
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
