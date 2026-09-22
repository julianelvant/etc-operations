"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";

export type ShellNavItem = {
  href: string;
  label: string;
  /** Exact match or prefix for active state */
  match?: "exact" | "prefix";
};

type AppShellProps = {
  product: "desk" | "admin";
  username: string;
  navItems: ShellNavItem[];
  /** Extra actions in the header (e.g. Admin link for desk admins) */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  /** Constrain main content width (admin) */
  contained?: boolean;
};

function navActive(pathname: string, item: ShellNavItem): boolean {
  const pathOnly = item.href.split("?")[0];
  if (
    item.match === "exact" ||
    pathOnly === "/desk" ||
    pathOnly === "/admin"
  ) {
    return pathname === pathOnly;
  }
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

export function AppShell({
  product,
  username,
  navItems,
  headerExtra,
  children,
  contained = false,
}: AppShellProps) {
  const pathname = usePathname();
  const title = product === "admin" ? "ETC · Admin" : "ETC · Desk";
  const homeHref = product === "admin" ? "/admin" : "/desk";

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 lg:px-6 ${
            contained ? "mx-auto max-w-7xl" : ""
          }`}
        >
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <Link
              href={homeHref}
              className="flex shrink-0 items-center gap-2.5 focus-ring rounded-lg"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
                E
              </span>
              <span className="font-display text-lg font-semibold text-ink">
                {title}
              </span>
            </Link>
            <nav
              className="hidden items-center gap-1 sm:flex"
              aria-label={product === "admin" ? "Admin" : "Desk"}
            >
              {navItems.map((item) => {
                const active = navActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus-ring ${
                      active
                        ? "bg-brand text-white"
                        : "text-muted hover:bg-slate-100 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {headerExtra}
            <span className="hidden text-sm text-muted md:inline">
              {username}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary min-h-9 px-3 py-1.5">
                Log out
              </button>
            </form>
          </div>
        </div>
        <nav
          className={`flex flex-wrap gap-1 border-t border-border px-4 py-2 sm:hidden ${
            contained ? "mx-auto max-w-7xl" : ""
          }`}
          aria-label={product === "admin" ? "Admin" : "Desk"}
        >
          {navItems.map((item) => {
            const active = navActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-medium focus-ring ${
                  active
                    ? "bg-brand text-white"
                    : "bg-slate-50 text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          contained ? "mx-auto w-full max-w-7xl px-4 py-8 lg:px-6" : ""
        }`}
      >
        {children}
      </div>
      <p className="border-t border-border bg-surface px-4 py-2.5 text-center text-xs text-faint lg:px-6">
        By Julian Ibrahim
      </p>
    </div>
  );
}
