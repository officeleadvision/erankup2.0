import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { getUnifiedVotes } from "@/lib/voteAggregation";

const buildTimePeriod = (
  date: Date,
  groupBy: "day" | "hour" | "month"
): Record<string, number> => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  if (groupBy === "hour") {
    return { year, month, day, hour };
  }

  if (groupBy === "month") {
    return { year, month };
  }

  return { year, month, day };
};

const compareTimePeriods = (
  a: Record<string, number>,
  b: Record<string, number>
) => {
  const order: Array<"year" | "month" | "day" | "hour"> = [
    "year",
    "month",
    "day",
    "hour",
  ];
  for (const field of order) {
    const aValue = a?.[field] ?? 0;
    const bValue = b?.[field] ?? 0;
    if (aValue !== bValue) return aValue - bValue;
  }
  return 0;
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
    const requestedGroupBy =
      (searchParams.get("groupBy") as "day" | "hour" | "month" | null) || "day";

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

    let effectiveGroupBy: "day" | "hour" | "month" = requestedGroupBy;
    if (!["day", "hour", "month"].includes(effectiveGroupBy)) {
      effectiveGroupBy = "day";
    }

    if (effectiveGroupBy === "hour") {
      const startReference = startDate ?? endDate;
      const endReference = endDate ?? startDate;

      if (
        !startReference ||
        !endReference ||
        startReference.toDateString() !== endReference.toDateString()
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Hourly groupBy is only supported for single-day date ranges. Please adjust your filters.",
          },
          { status: 400 }
        );
      }
    }

    const unifiedVotes = await getUnifiedVotes({
      username,
      startDate,
      endDate,
    });

    const timelineMap = new Map<
      string,
      { timePeriod: Record<string, number>; totalCount: number }
    >();

    unifiedVotes.forEach((entry) => {
      const voteDate = new Date(entry.date);
      const timePeriod = buildTimePeriod(voteDate, effectiveGroupBy);
      const key = JSON.stringify(timePeriod);

      const existing = timelineMap.get(key);
      if (existing) {
        existing.totalCount += 1;
      } else {
        timelineMap.set(key, { timePeriod, totalCount: 1 });
      }
    });

    const timeline = Array.from(timelineMap.values())
      .sort((a, b) => compareTimePeriods(a.timePeriod, b.timePeriod))
      .map(({ timePeriod, totalCount }) => ({ timePeriod, totalCount }));

    return NextResponse.json({ success: true, timeline });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error fetching vote timeline";
    console.error("/api/stats/votes/timeline", message, error);
    return NextResponse.json(
      { success: false, message: "Error fetching vote timeline" },
      { status: 500 }
    );
  }
}
