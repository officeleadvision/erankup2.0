import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Vote from "@/models/Vote";

const allowedVotes = [
  "superlike",
  "like",
  "neutral",
  "dislike",
  "superdislike",
] as const;

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

    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;

    if (startDateString && startDateString.trim() !== "") {
      const parsed = new Date(startDateString);
      if (!isNaN(parsed.getTime())) {
        startDateObj = parsed;
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid startDate format." },
          { status: 400 }
        );
      }
    }

    if (endDateQuery && endDateQuery.trim() !== "") {
      const parsed = new Date(endDateQuery);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(23, 59, 59, 999);
        endDateObj = parsed;
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid endDate format." },
          { status: 400 }
        );
      }
    }

    const groupFields: any = {
      year: { $year: "$normalizedDate" },
      month: { $month: "$normalizedDate" },
    };

    if (groupBy === "day") {
      groupFields.day = { $dayOfMonth: "$normalizedDate" };
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
        groupFields.day = { $dayOfMonth: "$normalizedDate" };
        groupFields.hour = { $hour: "$normalizedDate" };
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

    const buildNormalizationStages = () => {
      const addFieldsStage = {
        $addFields: {
          normalizedDate: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: [
                      { $type: "$date" },
                      ["date", "timestamp"],
                    ],
                  },
                  then: "$date",
                },
                {
                  case: { $eq: [{ $type: "$date" }, "string"] },
                  then: {
                    $dateFromString: {
                      dateString: "$date",
                      onError: null,
                      onNull: null,
                    },
                  },
                },
              ],
              default: null,
            },
          },
        },
      };

      const filterValidDateStage = {
        $match: { normalizedDate: { $ne: null } },
      };

      const rangeMatchStage: any = { $match: {} };
      if (startDateObj) {
        rangeMatchStage.$match["normalizedDate"] = {
          ...(rangeMatchStage.$match["normalizedDate"] || {}),
          $gte: startDateObj,
        };
      }
      if (endDateObj) {
        rangeMatchStage.$match["normalizedDate"] = {
          ...(rangeMatchStage.$match["normalizedDate"] || {}),
          $lte: endDateObj,
        };
      }

      const stages = [addFieldsStage, filterValidDateStage];
      if (startDateObj || endDateObj) {
        stages.push(rangeMatchStage);
      }

      return stages;
    };

    const feedbackPipeline: any[] = [
      { $match: matchStage },
      ...buildNormalizationStages(),
      {
        $project: {
          normalizedDate: 1,
          votes: {
            $concatArrays: [
              {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$vote", null] },
                      { $ne: ["$vote", ""] },
                    ],
                  },
                  [{ $toLower: "$vote" }],
                  [],
                ],
              },
              {
                $map: {
                  input: {
                    $filter: {
                      input: { $ifNull: ["$questionsVote", []] },
                      as: "entry",
                      cond: {
                        $and: [
                          { $ne: ["$$entry.vote", null] },
                          { $ne: ["$$entry.vote", ""] },
                        ],
                      },
                    },
                  },
                  as: "mappedVote",
                  in: { $toLower: "$$mappedVote.vote" },
                },
              },
            ],
          },
        },
      },
      { $unwind: "$votes" },
      { $match: { votes: { $in: allowedVotes } } },
      {
        $group: {
          _id: groupFields,
          count: { $sum: 1 },
        },
      },
      { $sort: sortStage },
      { $project: projectStage },
    ];

    const votePipeline: any[] = [
      { $match: matchStage },
      ...buildNormalizationStages(),
      {
        $project: {
          normalizedDate: 1,
          vote: {
            $cond: [
              {
                $and: [
                  { $ne: ["$vote", null] },
                  { $ne: ["$vote", ""] },
                ],
              },
              { $toLower: "$vote" },
              null,
            ],
          },
        },
      },
      { $match: { vote: { $in: allowedVotes } } },
      {
        $group: {
          _id: groupFields,
          count: { $sum: 1 },
        },
      },
      { $sort: sortStage },
      { $project: projectStage },
    ];

    const [feedbackTimeline, standaloneVoteTimeline] = await Promise.all([
      Feedback.aggregate(feedbackPipeline),
      Vote.aggregate(votePipeline),
    ]);

    const combinedTimelineMap = new Map<
      string,
      { timePeriod: Record<string, number>; totalCount: number }
    >();

    const accumulateTimeline = (
      items: Array<{ timePeriod: Record<string, number>; totalCount: number }>
    ) => {
      items.forEach((item) => {
        const key = JSON.stringify(item.timePeriod);
        const existing = combinedTimelineMap.get(key);
        if (existing) {
          existing.totalCount += item.totalCount;
        } else {
          combinedTimelineMap.set(key, {
            timePeriod: item.timePeriod,
            totalCount: item.totalCount,
          });
        }
      });
    };

    accumulateTimeline(feedbackTimeline);
    accumulateTimeline(standaloneVoteTimeline);

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

    const timeline = Array.from(combinedTimelineMap.values())
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
