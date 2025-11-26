"use server";

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { resolveRequester } from "@/lib/requester";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const requesterResult = await resolveRequester(request);
    if (!requesterResult.success) {
      return requesterResult.response;
    }

    const requester = requesterResult.requester;

    return NextResponse.json(
      {
        success: true,
        user: {
          id: requester._id,
          username: requester.user || requester.username,
          login: requester.username,
          admin: Boolean(requester.admin),
          godmode: Boolean(requester.godmode),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load profile.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

