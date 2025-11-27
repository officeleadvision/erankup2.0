"use server";

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { resolveRequester, extractAccountAlias } from "@/lib/requester";
import { sendPasswordResetEmail } from "@/lib/email";
import { ensureBlockedField } from "@/lib/userMaintenance";

const JWT_SECRET = process.env.JWT_SECRET;

type RouteParams = {
  id: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

const buildBaseUrl = (request: NextRequest) =>
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  request.nextUrl.origin;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!JWT_SECRET) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication misconfiguration: JWT secret missing.",
        },
        { status: 500 }
      );
    }

    await dbConnect();
    await ensureBlockedField();

    const params = await context.params;
    const targetUserId = params.id;
    if (!Types.ObjectId.isValid(targetUserId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user identifier." },
        { status: 400 }
      );
    }

    const requesterResult = await resolveRequester(request);
    if (!requesterResult.success) {
      return requesterResult.response;
    }
    const requester = requesterResult.requester;

    const isAdmin = Boolean(requester.admin);
    const isGodmode = Boolean(requester.godmode);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Administrator permissions required." },
        { status: 403 }
      );
    }

    const normalizedAccountAlias = extractAccountAlias(requester);

    const targetUser = await User.findById(targetUserId).lean();

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    if (!isGodmode) {
      const targetAlias = extractAccountAlias(targetUser);
      if (targetAlias !== normalizedAccountAlias) {
        return NextResponse.json(
          {
            success: false,
            message: "Можете да управлявате само потребители във вашия акаунт.",
          },
          { status: 403 }
        );
      }
    }

    if (targetUser.godmode && !isGodmode) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Само God Mode акаунт може да управлява God Mode потребители.",
        },
        { status: 403 }
      );
    }

    const resetToken = jwt.sign(
      { userId: targetUser._id.toString(), type: "password_reset" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const resetLink = `${buildBaseUrl(
      request
    )}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const emailSent = await sendPasswordResetEmail({
      to: targetUser.username,
      resetLink,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Изпратен е имейл с връзка за смяна на парола.",
        emailSent,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send reset link.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
