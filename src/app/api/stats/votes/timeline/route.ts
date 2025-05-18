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
    const endDateQuery = searchParams.get("endDate");
    const groupBy = searchParams.get("groupBy") || "day";

    const matchStage: any = { username };

    if (startDateString && startDateString.trim() !== "") {
      const startDateLocal = new Date(startDateString);
      if (!isNaN(startDateLocal.getTime())) {
        matchStage.date = { ...(matchStage.date || {}), $gte: startDateLocal };
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid startDate format." },
          { status: 400 }
        );
      }
    }

    if (endDateQuery && endDateQuery.trim() !== "") {
      const endDateLocal = new Date(endDateQuery);
      if (!isNaN(endDateLocal.getTime())) {
        endDateLocal.setHours(23, 59, 59, 999);
        matchStage.date = { ...(matchStage.date || {}), $lte: endDateLocal };
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid endDate format." },
          { status: 400 }
        );
      }
    }

    const groupFields: any = {
      year: { $year: "$date" },
      month: { $month: "$date" },
    };

    if (groupBy === "day") {
      groupFields.day = { $dayOfMonth: "$date" };
    } else if (groupBy === "hour") {
      let dateRangeIsSingleDay = false;
      if (startDateString && endDateQuery) {
        if (
          new Date(startDateString).toDateString() ===
          new Date(endDateQuery).toDateString()
        ) {
          dateRangeIsSingleDay = true;
        }
      } else if (startDateString && !endDateQuery) {
        dateRangeIsSingleDay = true;
      }

      if (dateRangeIsSingleDay) {
        groupFields.day = { $dayOfMonth: "$date" };
        groupFields.hour = { $hour: "$date" };
      } else {
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

    const groupStage = {
      _id: groupFields,
      count: { $sum: 1 },
    };

    const sortStage: any = {};
    if (groupFields.year) sortStage["_id.year"] = 1;
    if (groupFields.month) sortStage["_id.month"] = 1;
    if (groupFields.day) sortStage["_id.day"] = 1;
    if (groupFields.hour) sortStage["_id.hour"] = 1;

    const projectStage = {
      _id: 0,
      timePeriod: "$_id",
      totalCount: "$count",
    };

    const pipeline: any[] = [
      { $match: matchStage },
      { $group: groupStage },
      { $sort: sortStage },
      { $project: projectStage },
    ];

    const timeline = await Vote.aggregate(pipeline);

    return NextResponse.json({ success: true, timeline });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error fetching vote timeline" },
      { status: 500 }
    );
  }
}
