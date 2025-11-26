import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import { ensureBlockedField } from "@/lib/userMaintenance";

export async function POST(request: Request) {
  try {
    await dbConnect();
    await ensureBlockedField();
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Потребителското име и паролата са задължителни",
        },
        { status: 400 }
      );
    }

    const normalizedIdentifier = username.trim().toLowerCase();

    const candidateUsers = await User.find({
      $or: [{ username: normalizedIdentifier }, { user: normalizedIdentifier }],
    }).select("+password");

    if (!candidateUsers || candidateUsers.length === 0) {
      return NextResponse.json(
        { success: false, message: "Невалидни данни за вход" },
        { status: 401 }
      );
    }

    const preferredUser = candidateUsers.find(
      (candidate) => candidate.username === normalizedIdentifier
    );

    let authenticatedUser = null;

    if (preferredUser) {
      const isPasswordValid = await preferredUser.authenticate(password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, message: "Невалидни данни за вход" },
          { status: 401 }
        );
      }
      authenticatedUser = preferredUser;
    } else {
      for (const candidate of candidateUsers) {
        const isPasswordValid = await candidate.authenticate(password);
        if (isPasswordValid) {
          authenticatedUser = candidate;
          break;
        }
      }

      if (!authenticatedUser) {
        return NextResponse.json(
          { success: false, message: "Невалидни данни за вход" },
          { status: 401 }
        );
      }
    }

    if (authenticatedUser.blocked) {
      return NextResponse.json(
        {
          success: false,
          message: "Акаунтът ви е блокиран. Свържете се с администратор.",
        },
        { status: 403 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        { success: false, message: "Грешка при конфигурацията на сървъра" },
        { status: 500 }
      );
    }

    const accountIdentifier =
      authenticatedUser.user || authenticatedUser.username;

    const token = jwt.sign(
      {
        userId: authenticatedUser._id,
        username: accountIdentifier,
        login: authenticatedUser.username,
        godmode: authenticatedUser.godmode ?? false,
        admin: authenticatedUser.admin ?? false,
      },
      jwtSecret,
      {
        expiresIn: "2h",
      }
    );

    return NextResponse.json({
      success: true,
      message: "Успешен вход",
      token,
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, message: "Вътрешна сървърна грешка" },
      { status: 500 }
    );
  }
}
