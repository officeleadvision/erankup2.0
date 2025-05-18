import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Question from "@/models/Question";
import Device from "@/models/Device";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    await dbConnect();
    const { token: deviceToken } = params;

    if (!deviceToken) {
      return NextResponse.json(
        { success: false, message: "Device token is required." },
        { status: 400 }
      );
    }

    const device = await Device.findOne({ token: deviceToken });

    if (!device) {
      return NextResponse.json(
        { success: false, message: "Device not found for the provided token." },
        { status: 404 }
      );
    }

    const question = await Question.findOne({
      devices: device._id,
      hidden: false,
      username: device.owner,
    })
      .sort({ date: -1 })
      .select("question");

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          message: "No active question found for this device.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, question: question.question },
      { status: 200 }
    );
  } catch (error) {
    let errorMessage = "Error fetching question by device token";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
