import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE = "smriti_token";
const JWT_SECRET = process.env.JWT_SECRET ?? "smriti-local-development-secret-change-before-deployment";
const PRODUCT_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";

export async function proxy(request: NextRequest) {
  // Marketing sign-in hands off to the product dashboard before rendering, so
  // the redirect is a real server response rather than a client-side bounce.
  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup") {
    const product = new URL(PRODUCT_URL);
    const plan = request.nextUrl.searchParams.get("plan");
    if (request.nextUrl.pathname === "/signup" && plan) {
      product.searchParams.set("plan", plan);
    }
    return NextResponse.redirect(product);
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      return NextResponse.next();
    } catch {
      // invalid or expired token — fall through to the login redirect
    }
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
