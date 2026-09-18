import { createClient } from "@/lib/supabase/server";

type ConnectionStatus = "connected" | "degraded" | "offline";

async function getConnectionStatus(): Promise<{
  supabase: ConnectionStatus;
  healthUrl: string;
}> {
  const healthUrl = "/api/health";

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();

    return {
      supabase: error ? "degraded" : "connected",
      healthUrl,
    };
  } catch {
    return {
      supabase: "offline",
      healthUrl,
    };
  }
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const styles = {
    connected: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    degraded: "bg-amber-100 text-amber-800 ring-amber-200",
    offline: "bg-rose-100 text-rose-800 ring-rose-200",
  };

  const labels = {
    connected: "Connected",
    degraded: "Degraded",
    offline: "Offline",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default async function Home() {
  const { supabase, healthUrl } = await getConnectionStatus();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-slate-50 via-white to-emerald-50">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20">
        <div className="w-full rounded-3xl border border-slate-200 bg-white/80 p-10 shadow-xl shadow-emerald-100/50 backdrop-blur">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white">
              E
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
                ETC Operations
              </p>
              <p className="text-sm text-slate-500">Next.js + Vercel + Supabase</p>
            </div>
          </div>

          <h1 className="font-display text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Hello, World
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Your homepage is live with the same core stack as Gradeful: Next.js on
            Vercel, Tailwind styling, and Supabase for backend services.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Supabase</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    Database & Auth
                  </p>
                </div>
                <StatusBadge status={supabase} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Vercel</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    Hosting & Deployments
                  </p>
                </div>
                <StatusBadge status="connected" />
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href={healthUrl}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              View Health Check
            </a>
            <a
              href="https://vercel.com/elvants-projects"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Open Vercel Dashboard
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
