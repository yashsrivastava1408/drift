import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const isDev = process.env.NODE_ENV !== "production";

/** Builds the Content Security Policy. Scripts need this request's one-time nonce, so injected scripts cannot run. */
function buildCsp(nonce: string): string {
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : "*.supabase.co";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}${isDev ? " ws://localhost:*" : ""}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Every response gets the policy, and nothing signed-in is ever stored by the browser or a shared cache.
  const finish = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    res.headers.set("Cache-Control", "no-store, max-age=0");
    res.headers.set("Pragma", "no-cache");
    return res;
  };
  const pass = () => finish(NextResponse.next({ request: { headers: requestHeaders } }));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  // Without Supabase keys nothing can be protected, so send everything to the setup message on /login.
  if (!url || !key) {
    return pathname === "/login" ? pass() : finish(NextResponse.redirect(new URL("/login", request.url)));
  }

  let response = pass();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = pass();
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() checks the token with Supabase, so a forged cookie does not pass.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!user && !isPublic) {
    // API routes answer with 401 instead of a redirect.
    if (pathname.startsWith("/api/")) {
      return finish(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
    }
    return finish(NextResponse.redirect(new URL("/login", request.url)));
  }
  if (user && isPublic) {
    return finish(NextResponse.redirect(new URL("/", request.url)));
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
