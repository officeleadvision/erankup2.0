import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import Question from "@/models/Question";
import dbConnect from "@/lib/mongodb";
import { logActivity } from "@/lib/activityLogger";

interface ReorderPayloadItem {
  questionId: string;
  newOrder: number;
}

interface ReorderRequestBody {
  reorder: ReorderPayloadItem[];
}

/**
 * Authentication is enforced by the proxy (JWT verified, identity forwarded in
 * the x-user-* headers). Every update is scoped to the caller's account.
 */
export async function PUT(request: NextRequest) {
  const username = request.headers.get("x-user-username");
  const login = request.headers.get("x-user-login") || username || "unknown";

  if (!username) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    const body: ReorderRequestBody = await request.json();
    const { reorder } = body;

    if (!reorder || !Array.isArray(reorder) || reorder.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid reorder payload." },
        { status: 400 }
      );
    }

    const validItems = reorder.filter(
      (item) =>
        item &&
        typeof item.questionId === "string" &&
        mongoose.Types.ObjectId.isValid(item.questionId) &&
        typeof item.newOrder === "number" &&
        Number.isFinite(item.newOrder)
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid reorder payload." },
        { status: 400 }
      );
    }

    await dbConnect();

    const result = await Question.bulkWrite(
      validItems.map((item) => ({
        updateOne: {
          filter: { _id: item.questionId, username },
          update: { $set: { order: item.newOrder } },
        },
      }))
    );

    await logActivity({
      account: username,
      performedBy: login,
      entityType: "question",
      action: "reorder",
      status: "success",
      message: "Questions reordered successfully.",
      metadata: {
        reorderCount: validItems.length,
        modifiedCount: result.modifiedCount,
        sample: validItems.slice(0, 5),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Questions reordered successfully.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    let message = "Internal Server Error";
    if (error instanceof SyntaxError) {
      message = "Invalid JSON payload.";
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
