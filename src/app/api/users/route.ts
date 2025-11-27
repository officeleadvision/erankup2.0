"use server";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User, { type IUser } from "@/models/User";
import { resolveRequester, extractAccountAlias } from "@/lib/requester";
import { sendNewUserEmail } from "@/lib/email";
import { logActivity } from "@/lib/activityLogger";
import { ensureBlockedField, ensureModeratorField } from "@/lib/userMaintenance";

type ManagedUser = {
  id: string;
  username: string;
  account: string;
  admin: boolean;
  moderator: boolean;
  blocked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

const getBaseUrl = (request: NextRequest) =>
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  request.nextUrl.origin;

const generateTempPassword = () =>
  crypto
    .randomBytes(12)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 14) || crypto.randomBytes(8).toString("hex");

const toManagedUser = (user: IUser): ManagedUser => ({
  id: String(user._id),
  username: user.username,
  account: user.user || user.username,
  admin: Boolean(user.admin),
  moderator: Boolean(user.moderator),
  blocked: Boolean(user.blocked),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    await ensureBlockedField();
    await ensureModeratorField();

    const requesterResult = await resolveRequester(request);
    if (!requesterResult.success) {
      return requesterResult.response;
    }
    const requester = requesterResult.requester;

    const isAdmin = Boolean(requester.admin);
    const isModerator = Boolean(requester.moderator);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Administrator permissions required." },
        { status: 403 }
      );
    }

    const normalizedAccountAlias = extractAccountAlias(requester);

    const searchTerm = request.nextUrl.searchParams.get("search")?.trim();

    const query: Record<string, unknown> = {};

    if (!isModerator && normalizedAccountAlias) {
      query.user = normalizedAccountAlias;
    }

    if (searchTerm) {
      query.$or = [
        { username: { $regex: searchTerm, $options: "i" } },
        { user: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const users = await User.find(query).select("-password").sort({
      createdAt: -1,
    });

    return NextResponse.json(
      {
        success: true,
        users: users.map(toManagedUser),
        total: users.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load users.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    await ensureBlockedField();
    await ensureModeratorField();

    const requesterResult = await resolveRequester(request);
    if (!requesterResult.success) {
      return requesterResult.response;
    }
    const requester = requesterResult.requester;

    const isAdmin = Boolean(requester.admin);
    const isModerator = Boolean(requester.moderator);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Administrator permissions required." },
        { status: 403 }
      );
    }

    const normalizedRequesterAlias = extractAccountAlias(requester);
    const performedBy = requester.user || requester.username;

    const { username, accountAlias, admin, moderator } = await request.json();

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { success: false, message: "Username (email) is required." },
        { status: 400 }
      );
    }

    const normalizedUsername = username.trim().toLowerCase();
    let normalizedAlias =
      typeof accountAlias === "string" && accountAlias.trim().length > 0
        ? accountAlias.trim().toLowerCase()
        : normalizedUsername;

    if (!isModerator) {
      normalizedAlias = normalizedRequesterAlias;
    }

    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "Потребителят вече съществува." },
        { status: 409 }
      );
    }

    const tempPassword = generateTempPassword();

    const newUser = new User({
      username: normalizedUsername,
      user: normalizedAlias,
      password: tempPassword,
      admin: Boolean(admin),
      moderator: isModerator ? Boolean(moderator) : false,
      blocked: false,
    });

    await newUser.save();

    const loginUrl = `${getBaseUrl(request)}/login`;

    const emailSent = await sendNewUserEmail({
      to: normalizedUsername,
      accountName: normalizedAlias,
      password: tempPassword,
      loginUrl,
    });

    await logActivity({
      account: normalizedAlias,
      performedBy,
      entityType: "user",
      action: "create",
      status: "success",
      entityId: String(newUser._id),
      entityName: normalizedUsername,
      message: `Създаден нов потребител`,
      metadata: {
        admin: Boolean(admin),
        moderator: isModerator ? Boolean(moderator) : false,
        emailSent,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Потребителят е създаден успешно.",
        user: toManagedUser(newUser),
        emailSent,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create user.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
