import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import jwt from "jsonwebtoken";

type UserLike = {
  _id: unknown;
  username: string;
  user?: string | null;
  godmode?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const toUserPayload = (doc: UserLike) => ({
  _id: doc._id,
  username: doc.username,
  user: doc.user ?? doc.username,
  godmode: Boolean(doc.godmode),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export async function POST(request: Request) {
  try {
    await dbConnect();
    const {
      username,
      password,
      user: accountAlias,
      godmode,
    } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.trim().toLowerCase();
    const aliasInput =
      typeof accountAlias === "string" ? accountAlias.trim() : "";
    const aliasProvided = aliasInput.length > 0;
    const normalizedAccountAlias = aliasProvided
      ? aliasInput.toLowerCase()
      : normalizedUsername;
    const isGodmode = Boolean(godmode);

    const existingUser = await User.findOne({
      username: normalizedUsername,
    }).select("+password");

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication misconfiguration: JWT secret missing",
        },
        { status: 500 }
      );
    }

    if (existingUser) {
      if (!aliasProvided) {
        return NextResponse.json(
          { success: false, message: "User already exists" },
          { status: 409 }
        );
      }

      const isPasswordValid = await existingUser.authenticate(password);

      if (!isPasswordValid) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid credentials for existing user",
          },
          { status: 401 }
        );
      }

      existingUser.user = normalizedAccountAlias;
      existingUser.godmode = isGodmode;

      await existingUser.save();

      const updatedUser = await User.findById(existingUser._id).lean();
      if (!updatedUser) {
        return NextResponse.json(
          {
            success: false,
            message: "Failed to load updated user data",
          },
          { status: 500 }
        );
      }

      const token = jwt.sign(
        {
          userId: existingUser._id,
          username: existingUser.user || existingUser.username,
          login: existingUser.username,
          godmode: existingUser.godmode ?? false,
        },
        jwtSecret,
        {
          expiresIn: "2h",
        }
      );

      return NextResponse.json(
        {
          success: true,
          message: "User alias updated successfully",
          user: toUserPayload(updatedUser as UserLike),
          token,
        },
        { status: 200 }
      );
    }

    const newUser = new User({
      username: normalizedUsername,
      user: normalizedAccountAlias,
      password: password,
      godmode: isGodmode,
    });

    await newUser.save();

    const persistedUser = await User.findById(newUser._id).lean();
    if (!persistedUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to load persisted user data",
        },
        { status: 500 }
      );
    }

    const token = jwt.sign(
      {
        userId: newUser._id,
        username: newUser.user || newUser.username,
        login: newUser.username,
        godmode: newUser.godmode ?? false,
      },
      jwtSecret,
      {
        expiresIn: "2h",
      }
    );

    return NextResponse.json(
      {
        success: true,
        message: "User registered successfully",
        user: toUserPayload(persistedUser as UserLike),
        token,
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
