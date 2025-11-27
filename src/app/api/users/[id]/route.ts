"use server";

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User, { type IUser } from "@/models/User";
import { Types } from "mongoose";
import { resolveRequester, extractAccountAlias } from "@/lib/requester";
import { logActivity } from "@/lib/activityLogger";
import { ensureBlockedField } from "@/lib/userMaintenance";

type RouteParams = {
  id: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

const toManagedUser = (user: IUser) => ({
  id: String(user._id),
  username: user.username,
  account: user.user || user.username,
  admin: Boolean(user.admin),
  godmode: Boolean(user.godmode),
  blocked: Boolean(user.blocked),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await dbConnect();
    await ensureBlockedField();

    const params = await context.params;
    const userId = params.id;

    if (!Types.ObjectId.isValid(userId)) {
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

    let payload: Partial<{
      admin: boolean;
      godmode: boolean;
      user: string;
      password: string;
      blocked: boolean;
    }>;

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    if (!payload || Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, message: "No updates provided." },
        { status: 400 }
      );
    }

    const targetUser = await User.findById(userId).select("+password");

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    if (!isGodmode && normalizedAccountAlias) {
      const targetAccount = (targetUser.user || targetUser.username || "")
        .toString()
        .toLowerCase();
      if (targetAccount !== normalizedAccountAlias) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only manage users within your account.",
          },
          { status: 403 }
        );
      }
    }

    if (targetUser.godmode && !isGodmode) {
      return NextResponse.json(
        {
          success: false,
          message: "Само God Mode акаунт може да управлява God Mode потребители.",
        },
        { status: 403 }
      );
    }

    const requesterId = requester._id.toString();
    const targetId = targetUser._id.toString();
    const isSelf = requesterId === targetId;
    const changeSet: Record<string, { from: unknown; to: unknown }> = {};
    let hasChanges = false;

    if (
      typeof payload.admin === "boolean" &&
      targetUser.admin !== payload.admin
    ) {
      changeSet.admin = { from: targetUser.admin, to: payload.admin };
      targetUser.admin = payload.admin;
      hasChanges = true;
    }

    if (
      typeof payload.godmode === "boolean" &&
      targetUser.godmode !== payload.godmode
    ) {
      if (!isGodmode) {
        return NextResponse.json(
          {
            success: false,
            message: "Само God Mode акаунт може да променя този флаг.",
          },
          { status: 403 }
        );
      }
      changeSet.godmode = { from: targetUser.godmode, to: payload.godmode };
      targetUser.godmode = payload.godmode;
      hasChanges = true;
    }

    if (typeof payload.user === "string") {
      const normalizedAlias = payload.user.trim().toLowerCase();
      if (normalizedAlias.length === 0) {
        return NextResponse.json(
          { success: false, message: "Account alias cannot be empty." },
          { status: 400 }
        );
      }
      if (targetUser.user !== normalizedAlias) {
        changeSet.account = { from: targetUser.user, to: normalizedAlias };
        targetUser.user = normalizedAlias;
        hasChanges = true;
      }
    }

    if (typeof payload.password === "string") {
      const newPassword = payload.password.trim();
      if (newPassword.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Паролата трябва да е поне 6 символа.",
          },
          { status: 400 }
        );
      }
      changeSet.password = { from: "***", to: "***" };
      targetUser.password = newPassword;
      hasChanges = true;
    }

    if (
      typeof payload.blocked === "boolean" &&
      targetUser.blocked !== payload.blocked
    ) {
      if (isSelf) {
        return NextResponse.json(
          {
            success: false,
            message: "Не можете да блокирате собствения си достъп.",
          },
          { status: 400 }
        );
      }
      changeSet.blocked = { from: targetUser.blocked, to: payload.blocked };
      targetUser.blocked = payload.blocked;
      hasChanges = true;
    }

    if (!hasChanges) {
      return NextResponse.json(
        { success: false, message: "No valid changes detected." },
        { status: 400 }
      );
    }

    await targetUser.save();

    if (Object.keys(changeSet).length > 0) {
      const actionType =
        Object.keys(changeSet).length === 1 && changeSet.blocked
          ? targetUser.blocked
            ? "block"
            : "unblock"
          : "update";
      await logActivity({
        account: extractAccountAlias(targetUser),
        performedBy: requester.user || requester.username,
        entityType: "user",
        action: actionType,
        status: "success",
        entityId: targetId,
        entityName: targetUser.username,
        message: `Актуализиран потребител ${targetUser.username}`,
        metadata: { changes: changeSet },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "User updated successfully.",
        user: toManagedUser(targetUser),
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update user.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await dbConnect();
    await ensureBlockedField();

    const params = await context.params;
    const userId = params.id;

    if (!Types.ObjectId.isValid(userId)) {
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

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    if (!isGodmode) {
      const targetAccount = extractAccountAlias(targetUser);
      if (targetAccount !== normalizedAccountAlias) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only manage users within your account.",
          },
          { status: 403 }
        );
      }
    }

    if (targetUser.godmode && !isGodmode) {
      return NextResponse.json(
        {
          success: false,
          message: "Само God Mode акаунт може да управлява God Mode потребители.",
        },
        { status: 403 }
      );
    }

    if (targetUser._id.toString() === requester._id.toString()) {
      return NextResponse.json(
        {
          success: false,
          message: "Не можете да изтриете собствения си акаунт.",
        },
        { status: 400 }
      );
    }

    await targetUser.deleteOne();

    await logActivity({
      account: extractAccountAlias(targetUser),
      performedBy: requester.user || requester.username,
      entityType: "user",
      action: "delete",
      status: "success",
      entityId: String(userId),
      entityName: targetUser.username,
      message: `Потребителят ${targetUser.username} беше изтрит`,
    });

    return NextResponse.json(
      { success: true, message: "Потребителят беше изтрит." },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete user.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

