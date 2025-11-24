import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { allowedVotes, getUnifiedVotes } from "@/lib/voteAggregation";

const describeAverage = (avg: number | null) => {
  if (avg === null) return "N/A";
  if (avg >= 4.5) return "Много доволен";
  if (avg >= 3.5) return "Доволен";
  if (avg >= 2.5) return "Неутрален";
  if (avg >= 1.5) return "Недоволен";
  return "Много недоволен";
};

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

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateString && startDateString.trim() !== "") {
      const parsedStart = new Date(startDateString);
      if (isNaN(parsedStart.getTime())) {
        return NextResponse.json(
          { success: false, message: "Invalid startDate format." },
          { status: 400 }
        );
      }
      startDate = parsedStart;
    }

    if (endDateString && endDateString.trim() !== "") {
      const parsedEnd = new Date(endDateString);
      if (isNaN(parsedEnd.getTime())) {
        return NextResponse.json(
          { success: false, message: "Invalid endDate format." },
          { status: 400 }
        );
      }
      parsedEnd.setHours(23, 59, 59, 999);
      endDate = parsedEnd;
    }

    const unifiedVotes = await getUnifiedVotes({
      username,
      startDate,
      endDate,
    });

    const voteCountsMap = new Map<string, number>();
    allowedVotes.forEach((voteKey) => voteCountsMap.set(voteKey, 0));

    let cumulativeScore = 0;

    unifiedVotes.forEach(({ voteType, score }) => {
      if (!allowedVotes.includes(voteType)) {
        return;
      }
      const current = voteCountsMap.get(voteType) || 0;
      voteCountsMap.set(voteType, current + 1);
      cumulativeScore += score;
    });

    const votesByType = allowedVotes.map((voteKey) => ({
      _id: voteKey,
      count: voteCountsMap.get(voteKey) || 0,
    }));

    const totalVotes = unifiedVotes.length;
    const averageScore = totalVotes > 0 ? cumulativeScore / totalVotes : null;

    return NextResponse.json({
      success: true,
      totalVotes,
      votesByType,
      averageScore,
      averageLabel: describeAverage(averageScore),
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
