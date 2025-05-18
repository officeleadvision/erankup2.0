import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getToken } from "next-auth/jwt";

export async function POST(request: Request) {
  try {
    await dbConnect();

    // Extract auth token from the request
    const req = request as NextRequest;
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    if (!token) {
      // Try to get token from cookies as fallback
      const tokenData = await getToken({
        req: req as any,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!tokenData || !tokenData.sub) {
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 }
        );
      }
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    // Get user from stored token in localStorage through cookies
    const storedToken = req.cookies.get("authToken")?.value;
    let userId = null;

    try {
      // Try to decode the token manually if it exists
      if (storedToken) {
        const base64Payload = storedToken.split(".")[1];
        const payload = JSON.parse(
          Buffer.from(base64Payload, "base64").toString()
        );
        userId = payload.userId;
      }
    } catch (e) {
      console.error("Error parsing token:", e);
    }

    if (!userId) {
      // If userId can't be extracted from the token, try to use auth header
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const authToken = authHeader.substring(7);
        try {
          const base64Payload = authToken.split(".")[1];
          const payload = JSON.parse(
            Buffer.from(base64Payload, "base64").toString()
          );
          userId = payload.userId;
        } catch (e) {
          console.error("Error parsing auth header token:", e);
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Could not identify user from session." },
        { status: 401 }
      );
    }

    // Find the user and validate current password
    const user = await User.findById(userId).select("+password");

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

    // Update the password
    user.password = newPassword; // The User model will hash this automatically
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
