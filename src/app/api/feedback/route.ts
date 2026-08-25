import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";
import User from "@/models/User";
import Vote, { VoteType } from "@/models/Vote";
import mongoose from "mongoose";
import { encrypt } from "@/lib/cryptoUtils";
import {
  parseDateStartOfDay,
  parseDateEndOfDay,
  resolveTimezone,
} from "@/lib/timezoneUtils";
import {
  buildFeedbackMatchQuery,
  CASE_INSENSITIVE_COLLATION,
} from "@/lib/voteAggregation";

export const dynamic = "force-dynamic";

interface QuestionVoteItem {
  question: string;
  vote: VoteType;
}

interface CreateFeedbackRequestBody {
  username: string;
  devices: string;
  name?: string;
  phone?: string;
  email?: string;
  comment?: string;
  question?: string;
  vote?: VoteType;
  votesList?: QuestionVoteItem[];
  voteId?: string;
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCaseInsensitiveExactMatch = (value: string) =>
  new RegExp(`^${escapeRegex(value)}$`, "i");

/**
 * Public endpoint used by the tablets. Intentionally unauthenticated.
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    let feedbackObj: CreateFeedbackRequestBody;
    try {
      feedbackObj = await request.json();
    } catch {
      return new Response("Error: Invalid JSON body", { status: 400 });
    }

    const trimmedUsername = feedbackObj.username?.trim();
    const trimmedDeviceToken = feedbackObj.devices?.trim();

    if (!trimmedUsername || !trimmedDeviceToken) {
      return new Response("Error: Username and device token are required", {
        status: 400,
      });
    }

    const userIdentifierRegex = buildCaseInsensitiveExactMatch(trimmedUsername);

    const user = await User.findOne({
      $or: [{ username: userIdentifierRegex }, { user: userIdentifierRegex }],
    }).select("username user");

    if (!user) {
      return new Response("Error: User not found", { status: 404 });
    }

    const device = await Device.findOne({ token: trimmedDeviceToken });

    if (!device) {
      return new Response("Error: Device not found", { status: 404 });
    }

    // The account alias (`user`) is what devices, questions and exports are
    // keyed on; always store it lowercased so the dashboard filters match.
    const usernameForStorage = (
      user.user?.trim() ||
      user.username?.trim() ||
      trimmedUsername
    ).toLowerCase();

    // Votes are written with `username: device.owner` (see /api/vote), so link
    // against the same value.
    const usernameForLinking = (device.owner || usernameForStorage)
      .toString()
      .toLowerCase();

    const effectiveQuestion =
      feedbackObj.question || "Доволни ли сте от обслужването?";
    let linkedVoteObjectId: mongoose.Types.ObjectId | null = null;

    if (
      feedbackObj.voteId &&
      mongoose.Types.ObjectId.isValid(feedbackObj.voteId)
    ) {
      try {
        const existingVote = await Vote.findById(feedbackObj.voteId).select(
          "_id username device feedbackId question vote"
        );

        const voteDeviceToken =
          existingVote &&
          existingVote.device &&
          typeof existingVote.device === "object"
            ? (existingVote.device as { token?: string }).token
            : undefined;

        if (
          existingVote &&
          !existingVote.feedbackId &&
          existingVote.username === usernameForLinking &&
          voteDeviceToken === device.token &&
          (!feedbackObj.vote || existingVote.vote === feedbackObj.vote) &&
          (!feedbackObj.question ||
            existingVote.question === feedbackObj.question)
        ) {
          linkedVoteObjectId = existingVote._id as mongoose.Types.ObjectId;
        }
      } catch {
        /* Ignore invalid vote linkage */
      }
    }

    if (!linkedVoteObjectId && feedbackObj.vote) {
      const recentWindowStart = new Date(Date.now() - 5 * 60 * 1000);
      const recentVote = await Vote.findOne({
        username: usernameForLinking,
        vote: feedbackObj.vote,
        question: effectiveQuestion,
        "device.token": device.token,
        $or: [{ feedbackId: { $exists: false } }, { feedbackId: null }],
        date: { $gte: recentWindowStart },
      })
        .sort({ date: -1 })
        .select("_id");

      if (recentVote?._id) {
        linkedVoteObjectId = recentVote._id as mongoose.Types.ObjectId;
      }
    }

    const now = new Date();

    // Written through the raw collection on purpose: the schema setters would
    // encrypt the already-encrypted PII a second time.
    const newFeedbackDoc: Record<string, unknown> = {
      question: effectiveQuestion,
      username: usernameForStorage,
      devices: [device.toObject()],
      name: feedbackObj.name ? encrypt(feedbackObj.name) : null,
      phone: feedbackObj.phone ? encrypt(feedbackObj.phone) : null,
      email: feedbackObj.email ? encrypt(feedbackObj.email) : null,
      comment: feedbackObj.comment ? encrypt(feedbackObj.comment) : null,
      vote: feedbackObj.vote,
      questionsVote: Array.isArray(feedbackObj.votesList)
        ? feedbackObj.votesList
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              _id: new mongoose.Types.ObjectId(),
              question: item.question,
              vote: item.vote,
            }))
        : [],
      linkedVoteId: linkedVoteObjectId,
      date: now,
      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await mongoose.connection
      .collection("feedbacks")
      .insertOne(newFeedbackDoc);

    if (linkedVoteObjectId) {
      await Vote.updateOne(
        { _id: linkedVoteObjectId },
        { $set: { feedbackId: insertResult.insertedId } }
      );
    }

    return new Response("Feedback created!", { status: 201 });
  } catch (error) {
    console.error("POST /api/feedback failed", error);
    return new Response("Error", { status: 500 });
  }
}

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
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(searchParams.get("limit") || "10", 10);
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = Math.min(
      Math.max(Number.isNaN(limitParam) ? 10 : limitParam, 1),
      100
    );
    const startDateString = searchParams.get("startDate");
    const endDateString = searchParams.get("endDate");
    const timezone = resolveTimezone(searchParams.get("timezone"));

    const startDate = parseDateStartOfDay(startDateString, timezone);
    const endDate = parseDateEndOfDay(endDateString, timezone);

    if (startDateString && !startDate) {
      return NextResponse.json(
        { success: false, message: "Invalid startDate format." },
        { status: 400 }
      );
    }
    if (endDateString && !endDate) {
      return NextResponse.json(
        { success: false, message: "Invalid endDate format." },
        { status: 400 }
      );
    }

    const matchQuery = buildFeedbackMatchQuery({
      username,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });

    const totalFeedback = await Feedback.countDocuments(matchQuery, {
      collation: CASE_INSENSITIVE_COLLATION,
    });
    const totalPages = Math.ceil(totalFeedback / limit);

    const feedbackItems = await Feedback.find(matchQuery)
      .collation(CASE_INSENSITIVE_COLLATION)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json(
      {
        success: true,
        feedback: feedbackItems,
        totalPages,
        currentPage: page,
        totalFeedback,
        timezone,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/feedback failed", error);
    return NextResponse.json(
      { success: false, message: "Error fetching feedback" },
      { status: 500 }
    );
  }
}
