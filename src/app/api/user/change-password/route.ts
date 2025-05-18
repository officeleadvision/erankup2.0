import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();

    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required: User ID not found in token.",
        },
        { status: 401 }
      );
    }

    const { oldPassword, newPassword, newPasswordAgain } = await request.json();

    if (!oldPassword || !newPassword || !newPasswordAgain) {
      return NextResponse.json(
        {
          success: false,
          message: "Old password, new password, and confirmation are required",
        },
        { status: 400 }
      );
    }

    if (newPassword !== newPasswordAgain) {
      return NextResponse.json(
        { success: false, message: "New passwords do not match" },
        { status: 400 }
      );
    }

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const isOldPasswordValid = await user.authenticate(oldPassword);
    if (!isOldPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Invalid old password" },
        { status: 401 }
      );
    }

    user.password = newPassword;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    let errorMessage = "Error changing password";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
