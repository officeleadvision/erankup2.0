import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { resolveRequester } from "@/lib/requester";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Verifies the bearer JWT (signature + expiry) and loads the user.
    const requesterResult = await resolveRequester(request);
    if (!requesterResult.success) {
      const body = await requesterResult.response.json();
      return NextResponse.json(
        { error: body?.message || "Authentication required." },
        { status: requesterResult.response.status }
      );
    }

    let payload: { currentPassword?: unknown; newPassword?: unknown };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Невалидно тяло на заявката." },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = payload;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Новата парола трябва да бъде поне 6 символа." },
        { status: 400 }
      );
    }

    const user = await User.findById(requesterResult.requester._id).select(
      "+password"
    );

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const isCurrentPasswordValid = await user.authenticate(currentPassword);

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: "Текущата парола е невалидна." },
        { status: 401 }
      );
    }

    user.password = newPassword; // hashed by the pre-save hook
    await user.save();

    return NextResponse.json({ message: "Паролата е променена успешно!" });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Възникна неочаквана грешка. Моля, опитайте отново." },
      { status: 500 }
    );
  }
}
