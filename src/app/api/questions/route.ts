import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Question from "@/models/Question";
import Device from "@/models/Device";
import mongoose from "mongoose";

async function getUsernameFromToken(
  request: NextRequest
): Promise<string | null> {
  const username = request.headers.get("x-user-username");
  return username;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const username = await getUsernameFromToken(request);

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          message: "Невалиден или липсващ токен за вход.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { questionText, deviceIds } = body;

    const question = questionText || body.question;

    if (!question || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Текстът на въпроса и поне един ID на устройство са задължителни.",
        },
        { status: 400 }
      );
    }

    const validDeviceObjectIds: mongoose.Types.ObjectId[] = [];
    for (const id of deviceIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { success: false, message: `Invalid device ID format: ${id}` },
          { status: 400 }
        );
      }
      const device = await Device.findOne({ _id: id, owner: username });
      if (!device) {
        return NextResponse.json(
          {
            success: false,
            message: `Устройството не е намерно или не принадлежи на вас: ${id}. Проверете дали устройството съществува и дали сте собственик на него.`,
          },
          { status: 404 }
        );
      }
      validDeviceObjectIds.push(new mongoose.Types.ObjectId(id));
    }

    const lastQuestion = await Question.findOne({ username }).sort({
      order: -1,
    });
    const newOrder = lastQuestion ? lastQuestion.order + 1 : 0;

    const newQuestion = new Question({
      username,
      question: question,
      devices: validDeviceObjectIds,
      order: newOrder,
      hidden: false,
      date: new Date(),
    });

    try {
      await newQuestion.save();

      await newQuestion.populate({
        path: "devices",
        model: Device,
      });

      return NextResponse.json(
        {
          success: true,
          message: "Question created successfully",
          question: newQuestion,
        },
        { status: 201 }
      );
    } catch (saveError) {
      if (saveError instanceof mongoose.Error.ValidationError) {
        const errorMessages = Object.keys(saveError.errors).map(
          (field) => `${field}: ${saveError.errors[field].message}`
        );

        return NextResponse.json(
          {
            success: false,
            message: "Validation error",
            errors: errorMessages,
          },
          { status: 400 }
        );
      }

      throw saveError;
    }
  } catch (error) {
    let errorMessage = "Error creating question";
    let statusCode = 500;

    if (error instanceof mongoose.Error.ValidationError) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error instanceof SyntaxError && error.message.includes("JSON")) {
      errorMessage = "Invalid JSON payload provided.";
      statusCode = 400;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: statusCode }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const username = await getUsernameFromToken(request);

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Invalid or missing token.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hiddenParam = searchParams.get("hidden");

    const query: { username: string; hidden?: boolean } = { username };

    if (hiddenParam !== null) {
      query.hidden = hiddenParam === "true";
    }

    const questions = await Question.find(query)
      .populate({ path: "devices", select: "label location token" })
      .sort({ order: 1, date: -1 });

    return NextResponse.json({ success: true, questions }, { status: 200 });
  } catch (error) {
    let errorMessage = "Error fetching questions";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: statusCode }
    );
  }
}
