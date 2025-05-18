import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    await dbConnect();
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

    const user = await User.findOne({
      username: username.toLowerCase(),
    }).select("+password");

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Невалидни данни за вход" },
        { status: 401 }
      );
    }

    const isPasswordValid = await user.authenticate(password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Невалидни данни за вход" },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        { success: false, message: "Грешка при конфигурацията на сървъра" },
        { status: 500 }
      );
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
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
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Вътрешна сървърна грешка" },
      { status: 500 }
    );
  }
}
