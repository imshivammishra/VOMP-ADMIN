"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/layout/Wordmark";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (reason) {
      const message =
        reason instanceof ApiError
          ? reason.message
          : "Could not reach the API service. Please try again in a moment.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.06fr_0.94fr]">
      <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-line bg-white px-10 py-9 lg:flex xl:px-14">
        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute -right-16 top-1/2 -translate-y-1/2 select-none text-[360px] leading-none font-semibold text-ink/[0.035] xl:text-[440px]"
        >
          V
        </span>

        <div className="relative flex items-center justify-between">
          <Wordmark tone="dark" subtitle="Operations console" size="md" href="/login" />
          <span className="text-[8.5px] font-semibold tracking-[0.18em] text-[#8a8a8a] uppercase">Private workspace</span>
        </div>

        <div className="relative max-w-[540px] border-l-2 border-ink py-10 pl-7">
          <p className="mb-5 flex items-center gap-3 text-[8px] font-bold tracking-[0.22em] text-[#737373] uppercase">
            <span className="h-px w-8 bg-ink/35" />
            Access · Team only
          </p>
          <h1 className="font-display text-[62px] leading-[0.84] font-semibold tracking-[-0.03em] text-ink xl:text-[76px]">
            Every detail,
            <br />
            <span className="font-medium italic">in hand.</span>
          </h1>
          <p className="mt-7 max-w-[420px] text-[12.5px] leading-[1.9] text-[#5f5f5f]">
            A quiet, private workspace for the people behind Venue On My Plate — enquiries, venues and the public site,
            held in one place.
          </p>
        </div>

        <div className="relative flex items-center justify-between border-t border-line pt-4 text-[7.5px] font-bold tracking-[0.2em] text-[#8a8a8a] uppercase">
          <span>Est. 2026</span>
          <span>Venueonmyplate.in</span>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col bg-white">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
          <Wordmark tone="dark" subtitle="Operations console" size="sm" href="/login" />
          <span className="hidden text-[8.5px] font-semibold tracking-[0.16em] text-[#8a8a8a] uppercase sm:block">
            Private workspace
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-[390px] border-t-2 border-ink pt-6">
            <p className="mb-3 flex items-center gap-2 text-[8px] font-bold tracking-[0.22em] text-muted uppercase">
              <span className="h-px w-5 bg-ink/45" />
              Sign in
            </p>
            <h2 className="font-display text-[46px] leading-[0.9] font-semibold tracking-[-0.025em] text-ink">
              Welcome back.
            </h2>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Use your work account to open the operations console.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 border border-ink bg-[#fafafa] px-3.5 py-3 text-[12px] leading-relaxed text-ink"
              >
                <TriangleAlert size={15} className="mt-0.5 shrink-0 text-muted" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} autoComplete="off" className="mt-7 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[9px] font-bold tracking-[0.14em] text-muted uppercase"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#a3a3a3]" />
                  <input
                    id="email"
                    name="vomp_work_email"
                    type="email"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@venueonmyplate.in"
                    className="h-12 w-full border border-line bg-white pr-3.5 pl-10 text-[13px] text-ink transition-colors duration-150 placeholder:text-[#a3a3a3] hover:border-line-strong focus:border-ink focus:ring-1 focus:ring-ink focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[9px] font-bold tracking-[0.14em] text-muted uppercase"
                >
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#a3a3a3]" />
                  <input
                    id="password"
                    name="vomp_work_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full border border-line bg-white pr-11 pl-10 text-[13px] text-ink transition-colors duration-150 placeholder:text-[#a3a3a3] hover:border-line-strong focus:border-ink focus:ring-1 focus:ring-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center text-[#a3a3a3] transition-colors hover:bg-[#f5f5f5] hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "mt-1 flex h-12 w-full items-center justify-center gap-2 bg-ink text-[12px] font-bold tracking-[0.06em] text-white uppercase transition-colors hover:bg-[#262626]",
                  busy && "cursor-not-allowed opacity-70"
                )}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                {busy ? "Signing in…" : "Sign in"}
                {!busy && <ArrowRight size={14} />}
              </button>
            </form>

            <p className="mt-7 border-t border-line pt-4 text-[10.5px] leading-relaxed text-[#8a8a8a]">
              Access is limited to authorised team members. Sign-in attempts are rate limited.
            </p>
          </div>
        </div>

        <footer className="px-5 pb-5 text-[8px] font-semibold tracking-[0.16em] text-[#a3a3a3] uppercase sm:px-8">
          Venue On My Plate · Operations console
        </footer>
      </main>
    </div>
  );
}
