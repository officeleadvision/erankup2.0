import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Vote from "@/models/Vote";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const username = request.headers.get("x-user-username");

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDateString = searchParams.get("startDate");
    const endDateString = searchParams.get("endDate");

    const matchStage: Record<string, any> = { username };

    if (startDateString && startDateString.trim() !== "") {
      const startDate = new Date(startDateString);
      if (!isNaN(startDate.getTime())) {
        matchStage.date = { ...(matchStage.date || {}), $gte: startDate };
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid startDate format." },
          { status: 400 }
        );
      }
    }

    if (endDateString && endDateString.trim() !== "") {
      const endDate = new Date(endDateString);
      if (!isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        matchStage.date = { ...(matchStage.date || {}), $lte: endDate };
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid endDate format." },
          { status: 400 }
        );
      }
    }

    const votesByType = await Vote.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$vote",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalVotes = votesByType.reduce((sum, item) => sum + item.count, 0);

    return NextResponse.json({
      success: true,
      totalVotes,
      votesByType: votesByType,
    });
  } catch (error) {
    let errorMessage = "Internal server error. Failed to fetch vote summary.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
