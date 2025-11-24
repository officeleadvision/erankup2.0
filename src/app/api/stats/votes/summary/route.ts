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

const voteScoreMap: Record<string, number> = {
  superdislike: 1,
  dislike: 2,
  neutral: 3,
  like: 4,
  superlike: 5,
};

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

    const voteMatchStage: Record<string, any> = {
      ...matchStage,
      $or: [{ feedbackId: { $exists: false } }, { feedbackId: null }],
    };

    const [feedbackAggregation, standaloneVoteAggregation] = await Promise.all([
      Feedback.aggregate([
        { $match: matchStage },
        {
          $project: {
            votes: {
              $concatArrays: [
                {
                  $cond: [
                    {
                      $and: [{ $ne: ["$vote", null] }, { $ne: ["$vote", ""] }],
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
            _id: "$votes",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Vote.aggregate([
        { $match: voteMatchStage },
        {
          $project: {
            vote: {
              $cond: [
                {
                  $and: [{ $ne: ["$vote", null] }, { $ne: ["$vote", ""] }],
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
            _id: "$vote",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const voteCountsMap = new Map<string, number>();
    allowedVotes.forEach((voteKey) => voteCountsMap.set(voteKey, 0));

    const accumulateCounts = (items: Array<{ _id: any; count: number }>) => {
      items.forEach((item) => {
        if (item && typeof item._id === "string") {
          const current = voteCountsMap.get(item._id) || 0;
          voteCountsMap.set(item._id, current + (item.count || 0));
        }
      });
    };

    accumulateCounts(feedbackAggregation);
    accumulateCounts(standaloneVoteAggregation);

    const votesByType = allowedVotes.map((voteKey) => ({
      _id: voteKey,
      count: voteCountsMap.get(voteKey) || 0,
    }));

    const totalVotes = votesByType.reduce((sum, item) => sum + item.count, 0);
    const weightedScore = votesByType.reduce(
      (sum, item) => sum + (voteScoreMap[item._id] || 0) * item.count,
      0
    );
    const averageScore = totalVotes > 0 ? weightedScore / totalVotes : null;

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
