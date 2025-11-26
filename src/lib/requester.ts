import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import User, { type IUser } from "@/models/User";
import { Types } from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET;

type RequesterShape = Pick<IUser, "user" | "username" | "admin" | "godmode"> & {
  _id: Types.ObjectId;
};

type RequesterResult =
  | { success: true; requester: RequesterShape }
  | { success: false; response: NextResponse };

const missingTokenResponse = NextResponse.json(
  {
    success: false,
    message: "Authentication required: missing bearer token.",
  },
  { status: 401 }
);

const missingUserResponse = NextResponse.json(
  {
    success: false,
    message: "Authentication required: user not found.",
  },
  { status: 401 }
);

const misconfiguredServerResponse = NextResponse.json(
  {
    success: false,
    message: "Authentication misconfiguration: JWT secret missing.",
  },
  { status: 500 }
);

export async function resolveRequester(
  request: NextRequest
): Promise<RequesterResult> {
  let requesterId = request.headers.get("x-user-id");

  if (!requesterId) {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return { success: false, response: missingTokenResponse };
    }

    if (!JWT_SECRET) {
      return { success: false, response: misconfiguredServerResponse };
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId?: string };
      if (!payload?.userId) {
        return { success: false, response: missingUserResponse };
      }
      requesterId = payload.userId;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Invalid authentication token.";
      return {
        success: false,
        response: NextResponse.json(
          { success: false, message },
          { status: 401 }
        ),
      };
    }
  }

  if (!requesterId) {
    return { success: false, response: missingUserResponse };
  }

  const requester = (await User.findById(
    requesterId
  ).lean()) as RequesterShape | null;
  if (!requester) {
    return { success: false, response: missingUserResponse };
  }

  return { success: true, requester };
}

export const extractAccountAlias = (
  requester: Pick<IUser, "user" | "username">
) =>
  (requester.user || requester.username || "").toString().trim().toLowerCase();
