import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Question, { IQuestion } from "@/models/Question";
import Device from "@/models/Device";
import mongoose from "mongoose";
import * as jwt from "jsonwebtoken";

interface DecodedToken {
  userId: string;
  username: string;
}

async function getUsernameFromToken(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    return decoded.username;
  } catch (error) {
    return null;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  try {
    await dbConnect();

    const params_resolved = await params;
    const questionId = params_resolved.questionId;
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

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return NextResponse.json(
        { success: false, message: "Invalid question ID format." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const questionText = body.questionText || body.question;
    const { deviceIds, hidden } = body;

    if (
      typeof questionText === "undefined" &&
      typeof deviceIds === "undefined" &&
      typeof hidden === "undefined"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "At least one field (questionText, deviceIds, or hidden) must be provided for update.",
        },
        { status: 400 }
      );
    }

    const existingQuestion = await Question.findOne({
      _id: questionId,
      username,
    }).populate("devices");

    if (!existingQuestion) {
      return NextResponse.json(
        { success: false, message: "Question not found or not owned by user." },
        { status: 404 }
      );
    }

    const updatePayload: any = {};

    if (questionText) {
      updatePayload.question = questionText;
    }

    if (typeof hidden === "boolean") {
      updatePayload.hidden = hidden;
    }

    if (Array.isArray(deviceIds)) {
      if (deviceIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Device IDs array cannot be empty if provided. To remove all devices, use a specific action or ensure at least one device is present.",
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
              message: `Device not found or not owned by user: ${id}`,
            },
            { status: 404 }
          );
        }
        validDeviceObjectIds.push(new mongoose.Types.ObjectId(id));
      }

      updatePayload.devices = validDeviceObjectIds;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({
        success: true,
        message: "No changes detected to update.",
        question: existingQuestion,
      });
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).populate({ path: "devices", model: Device });

    if (!updatedQuestion) {
      return NextResponse.json(
        {
          success: false,
          message: "Question not found after update attempt or update failed.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Question updated successfully",
      question: updatedQuestion,
    });
  } catch (error) {
    let errorMessage = "Error updating question";
    let statusCode = 500;
    if (error instanceof mongoose.Error.ValidationError) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = "Invalid or expired token.";
      statusCode = 401;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  try {
    await dbConnect();
    const params_resolved = await params;
    const questionId = params_resolved.questionId;
    const username = await getUsernameFromToken(request);

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return NextResponse.json(
        { success: false, message: "Invalid question ID format." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const updatePayload: Partial<Pick<IQuestion, "hidden" | "order">> = {};
    let reorderInstructions: { questionId: string; newOrder: number }[] = [];

    if (typeof body.hidden === "boolean") {
      updatePayload.hidden = body.hidden;
    }

    if (typeof body.order === "number") {
      updatePayload.order = body.order;
    }

    if (body.reorder && Array.isArray(body.reorder)) {
      reorderInstructions = body.reorder;
    }

    if (
      Object.keys(updatePayload).length === 0 &&
      reorderInstructions.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "No update parameters (hidden, order, or reorder) provided.",
        },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (Object.keys(updatePayload).length > 0) {
        const updatedQuestion = await Question.findOneAndUpdate(
          { _id: questionId, username },
          { $set: updatePayload },
          { new: true, session }
        );

        if (!updatedQuestion) {
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            {
              success: false,
              message: "Question not found or not owned by user.",
            },
            { status: 404 }
          );
        }
      }

      if (reorderInstructions.length > 0) {
        for (const { questionId: qId, newOrder } of reorderInstructions) {
          if (!mongoose.Types.ObjectId.isValid(qId)) {
            throw new Error(`Invalid question ID in reorder list: ${qId}`);
          }
          await Question.updateOne(
            { _id: qId, username },
            { $set: { order: newOrder } },
            { session }
          );
        }
      }

      await session.commitTransaction();
      session.endSession();

      const finalQuestion = await Question.findOne({
        _id: questionId,
        username,
      })
        .populate({ path: "devices", model: Device })
        .session(null);

      return NextResponse.json({
        success: true,
        message: "Question updated successfully.",
        question: finalQuestion,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      let errorMessage = "Error in PATCH operation";
      let statusCode = 500;
      if (error instanceof mongoose.Error.ValidationError) {
        errorMessage = error.message;
        statusCode = 400;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error) {
    let errorMessage = "Error updating question (outer catch)";
    let statusCode = 500;
    if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = "Invalid or expired token.";
      statusCode = 401;
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

// Note: True DELETE for questions is not implemented as original functionality was soft delete (hidden=true).
// If hard delete is needed, a DELETE handler can be added here.
