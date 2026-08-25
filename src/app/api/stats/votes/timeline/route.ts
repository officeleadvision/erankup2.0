import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { allowedVotes, getUnifiedVotes } from "@/lib/voteAggregation";
import type { VoteType } from "@/models/Vote";
import {
  getZonedParts,
  parseDateStartOfDay,
  parseDateEndOfDay,
  resolveTimezone,
  toDateKey,
} from "@/lib/timezoneUtils";

export const dynamic = "force-dynamic";

type GroupBy = "day" | "hour" | "month";

/**
 * Bucket an instant by wall-clock components in the requested timezone, so a
 * vote cast at 00:30 Sofia time on the 11th lands on the 11th (not the 10th
 * UTC), and the hourly chart for "today" shows local hours.
 */
const buildTimePeriod = (
  date: Date,
  groupBy: GroupBy,
  timezone: string
): Record<string, number> => {
  const { year, month, day, hour } = getZonedParts(date, timezone);

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
    const requestedGroupBy = searchParams.get("groupBy") || "day";
    const timezone = resolveTimezone(searchParams.get("timezone"));

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateString && startDateString.trim() !== "") {
      const parsedStart = parseDateStartOfDay(startDateString, timezone);
      if (!parsedStart) {
        return NextResponse.json(
          { success: false, message: "Invalid startDate format." },
          { status: 400 }
        );
      }
      startDate = parsedStart;
    }

    if (endDateString && endDateString.trim() !== "") {
      const parsedEnd = parseDateEndOfDay(endDateString, timezone);
      if (!parsedEnd) {
        return NextResponse.json(
          { success: false, message: "Invalid endDate format." },
          { status: 400 }
        );
      }
      endDate = parsedEnd;
    }

    const effectiveGroupBy: GroupBy = (
      ["day", "hour", "month"] as const
    ).includes(requestedGroupBy as GroupBy)
      ? (requestedGroupBy as GroupBy)
      : "day";

    if (effectiveGroupBy === "hour") {
      const startReference = startDate ?? endDate;
      const endReference = endDate ?? startDate;

      if (
        !startReference ||
        !endReference ||
        toDateKey(startReference, timezone) !== toDateKey(endReference, timezone)
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

    const emptyByType = () =>
      Object.fromEntries(allowedVotes.map((v) => [v, 0])) as Record<
        VoteType,
        number
      >;

    const timelineMap = new Map<
      string,
      {
        timePeriod: Record<string, number>;
        totalCount: number;
        byType: Record<VoteType, number>;
      }
    >();

    unifiedVotes.forEach((entry) => {
      const timePeriod = buildTimePeriod(
        new Date(entry.date),
        effectiveGroupBy,
        timezone
      );
      const key = JSON.stringify(timePeriod);

      let bucket = timelineMap.get(key);
      if (!bucket) {
        bucket = { timePeriod, totalCount: 0, byType: emptyByType() };
        timelineMap.set(key, bucket);
      }
      bucket.totalCount += 1;
      bucket.byType[entry.voteType] += 1;
    });

    const timeline = Array.from(timelineMap.values()).sort((a, b) =>
      compareTimePeriods(a.timePeriod, b.timePeriod)
    );

    return NextResponse.json({
      success: true,
      timezone,
      groupBy: effectiveGroupBy,
      timeline,
    });
  } catch (error) {
    console.error("/api/stats/votes/timeline", error);
    return NextResponse.json(
      { success: false, message: "Error fetching vote timeline" },
      { status: 500 }
    );
  }
}
