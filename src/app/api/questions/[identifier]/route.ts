import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Question, { IQuestion } from "@/models/Question";
import Device from "@/models/Device";
import mongoose from "mongoose";
import * as jwt from "jsonwebtoken";
import { logActivity } from "@/lib/activityLogger";

type LeanDevice = {
  label?: string | null;
  location?: string | null;
};

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
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { identifier: string } }
) {
  try {
    await dbConnect();
    const resolvedParams = await params;
    const { identifier: username } = resolvedParams;

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          message: "Username parameter (identifier) is required.",
        },
        { status: 400 }
      );
    }

    const questionsFromDB = await Question.find({
      username: username,
      hidden: false,
    })
      .populate({
        path: "devices",
        select: "label location",
        model: Device,
      })
      .sort({ order: 1 })
      .lean();

    const transformedQuestions = questionsFromDB.map((q) => {
      const devicesArray = Array.isArray(q.devices) ? q.devices : [];
      return {
        _id: String(q._id),
        question: q.question,
        order: q.order,
        devices: devicesArray.map((d: LeanDevice) => ({
          label: d.label,
          location: d.location,
        })),
      };
    });

    return NextResponse.json(
      { success: true, msg: transformedQuestions },
      { status: 200 }
    );
  } catch (error) {
    let errorMessage = "Error fetching questions";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { identifier: string } }
) {
  try {
    await dbConnect();

    const resolvedParams = await params;
    const { identifier: questionId } = resolvedParams;
    const username = await getUsernameFromToken(request);
    const login = request.headers.get("x-user-login") || username || "unknown";

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
        {
          success: false,
          message: "Invalid question ID format provided in identifier.",
        },
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
    }).populate({
      path: "devices",
      model: Device,
      select: "label location _id",
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { success: false, message: "Question not found or not owned by user." },
        { status: 404 }
      );
    }

    const updatePayload: Partial<IQuestion> = {};

    if (questionText) {
      updatePayload.question = questionText;
    }

    if (typeof hidden === "boolean") {
      updatePayload.hidden = hidden;
    }

    if (Array.isArray(deviceIds)) {
      if (deviceIds.length === 0) {
        updatePayload.devices = [];
      } else {
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
    ).populate({
      path: "devices",
      model: Device,
      select: "label location _id",
    });

    if (!updatedQuestion) {
      return NextResponse.json(
        {
          success: false,
          message: "Question not found after update attempt or update failed.",
        },
        { status: 404 }
      );
    }

    const changes: Array<{ field: string; from?: unknown; to?: unknown }> = [];
    if (
      typeof questionText === "string" &&
      questionText !== existingQuestion.question
    ) {
      changes.push({
        field: "question",
        from: existingQuestion.question,
        to: questionText,
      });
    }
    if (typeof hidden === "boolean" && hidden !== existingQuestion.hidden) {
      changes.push({
        field: "hidden",
        from: existingQuestion.hidden ?? false,
        to: hidden,
      });
    }
    if (Array.isArray(deviceIds)) {
      const extractDeviceIds = (
        devices: mongoose.Types.Array<mongoose.Types.ObjectId> | unknown[]
      ) =>
        (Array.isArray(devices) ? devices : []).map((device) => {
          if (
            device &&
            typeof device === "object" &&
            "_id" in device &&
            (device as { _id: mongoose.Types.ObjectId | string })._id
          ) {
            const raw = (device as { _id: mongoose.Types.ObjectId | string })
              ._id;
            return typeof raw === "string" ? raw : raw.toString();
          }
          return String(device);
        });

      const previousDevices = extractDeviceIds(existingQuestion.devices);
      const newDevices = extractDeviceIds(updatedQuestion.devices);
      if (previousDevices.join(",") !== newDevices.join(",")) {
        changes.push({
          field: "devices",
          from: previousDevices,
          to: newDevices,
        });
      }
    }

    await logActivity({
      account: username,
      performedBy: login,
      entityType: "question",
      action: "update",
      status: "success",
      message: "Question updated successfully",
      entityId: String(updatedQuestion._id),
      entityName: updatedQuestion.question,
      metadata: {
        updatedFields: Object.keys(updatePayload),
        changes,
        hidden:
          typeof updatedQuestion.hidden === "boolean"
            ? updatedQuestion.hidden
            : undefined,
        deviceCount: Array.isArray(updatedQuestion.devices)
          ? updatedQuestion.devices.length
          : 0,
      },
    });

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
  { params }: { params: { identifier: string } }
) {
  try {
    await dbConnect();
    const resolvedParams = await params;
    const { identifier: questionId } = resolvedParams;
    const username = await getUsernameFromToken(request);
    const login = request.headers.get("x-user-login") || username || "unknown";

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid question ID format provided in identifier.",
        },
        { status: 400 }
      );
    }

    const originalQuestion = await Question.findOne({
      _id: questionId,
      username,
    }).lean();

    if (!originalQuestion) {
      return NextResponse.json(
        {
          success: false,
          message: "Question not found or not owned by user.",
        },
        { status: 404 }
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

    const reorderSnapshotMap = new Map<
      string,
      { order?: number; question?: string }
    >();

    if (reorderInstructions.length > 0) {
      const reorderIds = reorderInstructions.map((item) => item.questionId);
      const existingReorderQuestions = await Question.find({
        _id: { $in: reorderIds },
        username,
      })
        .select("_id order question")
        .lean();
      existingReorderQuestions.forEach((doc) => {
        reorderSnapshotMap.set(doc._id.toString(), {
          order: typeof doc.order === "number" ? doc.order : undefined,
          question: doc.question,
        });
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (Object.keys(updatePayload).length > 0) {
        const updatedQuestionFromPatch = await Question.findOneAndUpdate(
          { _id: questionId, username },
          { $set: updatePayload },
          { new: true, session }
        );

        if (!updatedQuestionFromPatch) {
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
        .populate({
          path: "devices",
          model: Device,
          select: "label location _id",
        })
        .session(null);

      if (finalQuestion) {
        const action =
          reorderInstructions.length > 0
            ? "reorder"
            : typeof updatePayload.hidden === "boolean"
            ? "toggle"
            : "update";

        const reorderDetails =
          reorderInstructions.length > 0
            ? reorderInstructions.map(({ questionId, newOrder }) => {
                const snapshot = reorderSnapshotMap.get(questionId);
                return {
                  questionId,
                  question: snapshot?.question,
                  fromOrder:
                    typeof snapshot?.order === "number"
                      ? snapshot?.order
                      : undefined,
                  toOrder: newOrder,
                };
              })
            : [];

        const changes: Array<{
          field: string;
          from?: unknown;
          to?: unknown;
          description?: string;
          details?: Array<Record<string, unknown>>;
        }> = [];

        if (typeof updatePayload.hidden === "boolean") {
          changes.push({
            field: "hidden",
            from: originalQuestion.hidden ?? false,
            to: finalQuestion.hidden ?? false,
          });
        }

        if (typeof updatePayload.order === "number") {
          changes.push({
            field: "order",
            from: originalQuestion.order,
            to: finalQuestion.order,
          });
        }

        if (reorderInstructions.length > 0) {
          changes.push({
            field: "reorder",
            description: `Пренаредени ${reorderInstructions.length} въпроса`,
            details: reorderDetails,
          });
        }

        await logActivity({
          account: username,
          performedBy: login,
          entityType: "question",
          action,
          status: "success",
          message: "Question updated successfully.",
          entityId: String(finalQuestion._id),
          entityName: finalQuestion.question,
          metadata: {
            updatedFields: Object.keys(updatePayload),
            changes,
            hidden:
              typeof updatePayload.hidden === "boolean"
                ? finalQuestion.hidden
                : undefined,
            order:
              typeof updatePayload.order === "number"
                ? finalQuestion.order
                : undefined,
            reorderCount: reorderInstructions.length,
          },
        });
      }

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
