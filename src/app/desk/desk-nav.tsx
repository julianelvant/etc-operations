"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/desk", label: "Desk", prefix: "/desk" },
  { href: "/desk/export", label: "Export", prefix: "/desk/export" },
  { href: "/desk/settings", label: "Settings", prefix: "/desk/settings" },
];

function isActive(pathname: string, item: (typeof items)[number]) {
  if (item.href === "/desk") {
    return pathname === "/desk";
  }
  return pathname.startsWith(item.prefix);
}

export function DeskNav({ today }: { today: string }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden items-center gap-1 sm:flex">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const href =
            item.href === "/desk" ? `/desk?date=${today}` : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <nav className="flex gap-1 border-t border-slate-100 px-4 py-2 sm:hidden">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const href =
            item.href === "/desk" ? `/desk?date=${today}` : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex-1 rounded-lg py-2 text-center text-sm font-medium ${
                active
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-50 text-slate-700"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
