import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, errors as joseErrors } from "jose";

/**
 * Request proxy (formerly `middleware.ts`). Verifies the dashboard JWT for the
 * protected API routes and forwards the identity to the route handlers via
 * x-user-* headers.
 *
 * Tablet endpoints stay public and unchanged on purpose:
 *   POST /api/vote, POST /api/feedback, GET /api/questions/:identifier,
 *   GET  /api/questions/by-device-token/:token
 */

const JWT_SECRET_STRING = process.env.JWT_SECRET;
const secretKey = JWT_SECRET_STRING
  ? new TextEncoder().encode(JWT_SECRET_STRING)
  : null;

type PathRule = {
  /** exact path or prefix (when `prefix` is true) */
  path: string;
  prefix?: boolean;
  methods?: string[];
};

// Paths that never require a dashboard token.
const PUBLIC_RULES: PathRule[] = [
  { path: "/api/authenticate" },
  { path: "/api/user" }, // registration (exact match: NOT /api/users)
  { path: "/api/user/reset-password" },
  { path: "/api/vote", methods: ["POST"] },
  { path: "/api/votes", methods: ["POST"] },
  { path: "/api/feedback", methods: ["POST"] },
  { path: "/api/questions/by-device-token", prefix: true },
];

// Paths that require a valid dashboard token.
const PROTECTED_RULES: PathRule[] = [
  { path: "/api/user/change-password" },
  { path: "/api/user/profile" },
  { path: "/api/change-password" },
  { path: "/api/devices", prefix: true },
  { path: "/api/questions" },
  { path: "/api/questions/reorder" },
  { path: "/api/questions", prefix: true, methods: ["PUT", "PATCH", "DELETE"] },
  { path: "/api/feedback", methods: ["GET"] },
  { path: "/api/vote", methods: ["GET"] },
  { path: "/api/votes", methods: ["GET"] },
  { path: "/api/stats", prefix: true },
  { path: "/api/export", prefix: true },
  { path: "/api/users", prefix: true },
  { path: "/api/send" },
];

const matches = (rule: PathRule, pathname: string, method: string) => {
  const pathMatches = rule.prefix
    ? pathname === rule.path || pathname.startsWith(`${rule.path}/`)
    : pathname === rule.path;
  if (!pathMatches) return false;
  return !rule.methods || rule.methods.includes(method);
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (PUBLIC_RULES.some((rule) => matches(rule, pathname, method))) {
    return NextResponse.next();
  }

  // GET /api/questions/:identifier is the tablet's question feed.
  if (
    method === "GET" &&
    pathname.startsWith("/api/questions/") &&
    pathname !== "/api/questions/reorder"
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_RULES.some((rule) =>
    matches(rule, pathname, method)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!secretKey) {
    return NextResponse.json(
      { success: false, message: "Server authentication misconfiguration" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication token missing" },
      { status: 401 }
    );
  }

  try {
    const { payload } = await jwtVerify(token, secretKey);

    const requestHeaders = new Headers(request.headers);
    // Never trust identity headers supplied by the client.
    for (const header of [
      "x-user-id",
      "x-user-username",
      "x-user-login",
      "x-user-moderator",
      "x-user-admin",
    ]) {
      requestHeaders.delete(header);
    }

    const asFlag = (value: unknown) =>
      value === true || value === "true" ? "true" : "false";

    if (payload.userId) {
      requestHeaders.set("x-user-id", String(payload.userId));
    }
    if (payload.username) {
      requestHeaders.set("x-user-username", String(payload.username));
    }
    if (payload.login) {
      requestHeaders.set("x-user-login", String(payload.login));
    }
    requestHeaders.set("x-user-moderator", asFlag(payload.moderator));
    requestHeaders.set("x-user-admin", asFlag(payload.admin));

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (error: unknown) {
    let message = "Invalid or expired token";
    if (error instanceof joseErrors.JWTExpired) {
      message = "Token expired";
    } else if (
      error instanceof joseErrors.JWSSignatureVerificationFailed ||
      error instanceof joseErrors.JWSInvalid
    ) {
      message = "Token signature invalid";
    } else if (error instanceof joseErrors.JOSEAlgNotAllowed) {
      message = "Token algorithm not supported";
    }
    return NextResponse.json({ success: false, message }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
