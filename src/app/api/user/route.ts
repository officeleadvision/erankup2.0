import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User already exists" },
        { status: 409 }
      );
    }

    const newUser = new User({
      username: username.toLowerCase(),
      password: password,
    });

    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;

    return NextResponse.json(
      {
        success: true,
        message: "User registered successfully",
        user: userResponse,
      },
      { status: 201 }
    );
  } catch (error) {
    let errorMessage = "Internal Server Error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        message: "Error registering user",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
