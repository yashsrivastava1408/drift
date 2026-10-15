"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LineChart } from "lucide-react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // After repeated wrong passwords the form waits, and the wait doubles each time.
  const fails = useRef(0);
  const lockedUntil = useRef(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const wait = Math.ceil((lockedUntil.current - Date.now()) / 1000);
    if (wait > 0) {
      setError(`Too many tries. Wait ${wait} seconds.`);
      return;
    }
    if (mode === "up" && password.length < 10) {
      setError("Use at least 10 characters for the password.");
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        fails.current += 1;
        if (fails.current >= 4) lockedUntil.current = Date.now() + Math.min(2 ** (fails.current - 3) * 15, 600) * 1000;
        setError("Email or password is wrong.");
      } else {
        fails.current = 0;
        router.replace("/");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) setError(error.message);
      else if (!data.session) setNotice("Account created. Open the confirmation email, then sign in.");
      else {
        router.replace("/");
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-ink">
          <LineChart size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Expense Tracker</h1>
          <p className="text-sm text-muted">Private. Only you can see your data.</p>
        </div>
      </div>

      {!supabaseConfigured ? (
        <div className="card p-5 text-sm leading-relaxed">
          <p className="font-medium">Setup needed</p>
          <p className="mt-2 text-muted">
            Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase URL and anon key, then restart
            the app. The README has the steps.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" type="password" required minLength={mode === "up" ? 10 : 1}
              autoComplete={mode === "in" ? "current-password" : "new-password"} className="input" value={password}
              onChange={(e) => setPassword(e.target.value)} />
            {mode === "up" && <p className="mt-1.5 text-xs text-muted">At least 10 characters.</p>}
          </div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          {notice && <p role="status" className="text-sm text-good">{notice}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Please wait..." : mode === "in" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="w-full text-center text-sm text-muted hover:text-ink"
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setNotice(null); }}>
            {mode === "in" ? "No account yet? Create one" : "Have an account? Sign in"}
          </button>
        </form>
      )}
    </main>
  );
}
