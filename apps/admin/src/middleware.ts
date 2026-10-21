import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "vomp_admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const isLogin = pathname === "/login";

  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: [
    "/((?!api|uploads|_next/static|_next/image|images|fonts|favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png|robots\\.txt|sitemap\\.xml).*)",
  ],
};
