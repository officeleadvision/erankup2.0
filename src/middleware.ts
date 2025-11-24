import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET_STRING = process.env.JWT_SECRET;
let secretKeyUint8Array: Uint8Array | null = null;
if (JWT_SECRET_STRING) {
  secretKeyUint8Array = new TextEncoder().encode(JWT_SECRET_STRING);
}

// Paths that should be protected
const PROTECTED_PATHS = [
  "/api/user/change-password",
  "/api/devices",
  "/api/devices/:path*",
  "/api/questions",
  "/api/questions/:questionId",
  "/api/feedback",
  "/api/votes",
  "/api/stats/:path*",
  "/api/export/:path*",
];

// Paths that are public
const PUBLIC_PATHS = [
  "/api/authenticate",
  "/api/user",
  "/api/votes",
  "/api/feedback",
  "/api/questions/by-device-token/:path*",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (method === "GET" && pathname.startsWith("/api/questions/")) {
    if (!pathname.startsWith("/api/questions/by-device-token/")) {
      return NextResponse.next();
    }
  }

  const isDeviceRoute = pathname.startsWith("/api/devices");

  const isPublicPathMatch = PUBLIC_PATHS.some((rule) => {
    if (rule.includes(":path*")) {
      const basePath = rule.split("/:path*")[0];
      if (pathname.startsWith(basePath)) {
        return true;
      }
    } else if (rule === "/api/votes") {
      if (method === "POST" && pathname.startsWith(rule)) {
        return true;
      }
    } else if (rule === "/api/feedback") {
      if (method === "POST" && pathname.startsWith(rule)) {
        return true;
      }
    } else if (pathname.startsWith(rule)) {
      return true;
    }
    return false;
  });

  if (isPublicPathMatch) {
    return NextResponse.next();
  }

  let matchedProtectedPathRule: string | null = null;
  const isProtectedPath = PROTECTED_PATHS.some((pathRule) => {
    let ruleMatches = false;
    if (pathRule.includes(":path*")) {
      const basePath = pathRule.split("/:path*")[0];
      ruleMatches = pathname.startsWith(basePath);
    } else if (pathRule.includes(":questionId")) {
      const basePath = pathRule.split("/:questionId")[0];
      ruleMatches =
        pathname.startsWith(basePath) &&
        pathname.split("/").length === basePath.split("/").length + 1;
    } else if (pathRule === "/api/votes") {
      ruleMatches = method === "GET" && pathname.startsWith(pathRule);
    } else if (pathRule === "/api/feedback") {
      ruleMatches = method === "GET" && pathname.startsWith(pathRule);
    } else {
      ruleMatches = pathname.startsWith(pathRule);
    }

    if (ruleMatches) {
      matchedProtectedPathRule = pathRule;
    }
    return ruleMatches;
  });

  if (isProtectedPath) {
    if (!secretKeyUint8Array) {
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
      const { payload } = await jwtVerify(token, secretKeyUint8Array);

      const requestHeaders = new Headers(request.headers);
      if (payload && typeof payload === "object") {
        const payloadObject = payload as Record<string, unknown>;
        if (payload.userId) {
          requestHeaders.set("x-user-id", String(payload.userId));
        }
        if (payload.username) {
          requestHeaders.set("x-user-username", String(payload.username));
        }
        if (payloadObject.login) {
          requestHeaders.set("x-user-login", String(payloadObject.login));
        }
        if (typeof payloadObject.godmode !== "undefined") {
          const isGodmode =
            payloadObject.godmode === true || payloadObject.godmode === "true";
          requestHeaders.set("x-user-godmode", isGodmode ? "true" : "false");
        }
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch (error: any) {
      let message = "Invalid or expired token";
      if (error.code === "ERR_JWT_EXPIRED") message = "Token expired";
      else if (
        error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ||
        error.code === "ERR_JWS_INVALID"
      ) {
        message = "Token signature invalid";
      } else if (error.code === "ERR_JWS_ALG_NOT_SUPPORTED") {
        message = "Token algorithm not supported";
      }
      return NextResponse.json({ success: false, message }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
