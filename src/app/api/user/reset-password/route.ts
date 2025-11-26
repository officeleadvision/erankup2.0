"use server";

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: Request) {
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

    const { token, newPassword, newPasswordAgain } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, message: "Липсва валиден токен." },
        { status: 400 }
      );
    }

    if (!newPassword || !newPasswordAgain) {
      return NextResponse.json(
        {
          success: false,
          message: "Попълнете нова парола и потвърждение.",
        },
        { status: 400 }
      );
    }

    if (newPassword !== newPasswordAgain) {
      return NextResponse.json(
        { success: false, message: "Паролите не съвпадат." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Паролата трябва да съдържа поне 6 символа.",
        },
        { status: 400 }
      );
    }

    let payload: { userId?: string; type?: string };
    try {
      payload = jwt.verify(token, JWT_SECRET) as { userId?: string; type?: string };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Невалиден или изтекъл токен.";
      return NextResponse.json({ success: false, message }, { status: 401 });
    }

    if (payload.type !== "password_reset" || !payload.userId) {
      return NextResponse.json(
        { success: false, message: "Невалиден токен за смяна на парола." },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findById(payload.userId).select("+password");
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Потребителят не е намерен." },
        { status: 404 }
      );
    }

    user.password = newPassword;
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: "Паролата беше променена успешно. Можете да влезете с нея.",
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Грешка при смяна на паролата.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

