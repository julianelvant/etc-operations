"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await loginAction(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">
          Username
        </span>
        <input
          name="username"
          autoComplete="username"
          required
          className="input-field"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input-field"
        />
      </label>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-[var(--status-late-bg)] px-4 py-3 text-sm text-[var(--status-late-ink)]"
        >
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-primary mt-2 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
