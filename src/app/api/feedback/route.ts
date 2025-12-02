import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";
import User from "@/models/User";
import Vote, { VoteType } from "@/models/Vote";
import mongoose from "mongoose";
import { encrypt } from "@/lib/cryptoUtils";

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

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const feedbackObj: CreateFeedbackRequestBody = await request.json();

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

    const canonicalUsername = user.username || user.user || trimmedUsername;
    const normalizedUsername = canonicalUsername.toLowerCase();

    const device = await Device.findOne({ token: trimmedDeviceToken });

    if (!device) {
      return new Response("Error: Device not found", { status: 404 });
    }

    const db = mongoose.connection;
    const feedbacksCollection = db.collection("feedbacks");

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
            ? (existingVote.device as any).token
            : undefined;

        if (
          existingVote &&
          (!existingVote.feedbackId || existingVote.feedbackId === null) &&
          existingVote.username === normalizedUsername &&
          voteDeviceToken === device.token &&
          (!feedbackObj.vote || existingVote.vote === feedbackObj.vote) &&
          (!feedbackObj.question ||
            existingVote.question === feedbackObj.question)
        ) {
          linkedVoteObjectId = existingVote._id as mongoose.Types.ObjectId;
        }
      } catch (err) {
        /* Ignore invalid vote linkage */
      }
    }

    if (!linkedVoteObjectId && feedbackObj.vote) {
      const recentWindowStart = new Date(Date.now() - 5 * 60 * 1000);
      const recentVote = await Vote.findOne({
        username: normalizedUsername,
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

    const newFeedbackDoc: any = {
      question: effectiveQuestion,
      username: canonicalUsername,
      devices: [device.toObject()],
      name: feedbackObj.name ? encrypt(feedbackObj.name) : null,
      phone: feedbackObj.phone ? encrypt(feedbackObj.phone) : null,
      email: feedbackObj.email ? encrypt(feedbackObj.email) : null,
      comment: feedbackObj.comment ? encrypt(feedbackObj.comment) : null,
      vote: feedbackObj.vote,
      questionsVote: feedbackObj.votesList
        ? feedbackObj.votesList.map((item) => ({
            question: item.question,
            vote: item.vote,
          }))
        : [],
      date: new Date(),
    };

    if (linkedVoteObjectId) {
      newFeedbackDoc.linkedVoteId = linkedVoteObjectId;
    }

    const insertResult = await feedbacksCollection.insertOne(newFeedbackDoc);

    if (linkedVoteObjectId) {
      await Vote.updateOne(
        { _id: linkedVoteObjectId },
        { $set: { feedbackId: insertResult.insertedId } }
      );
    }

    return new Response("Feedback created!", { status: 201 });
  } catch (error) {
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
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const startDateString = searchParams.get("startDate");
    const endDateString = searchParams.get("endDate");

    const matchQuery: any = { username };

    let startDate = null;
    if (startDateString) {
      try {
        startDate = new Date(startDateString);
        if (isNaN(startDate.getTime())) {
          startDate = null;
        }
      } catch (err) {
        startDate = null;
      }
    }

    let endDate = null;
    if (endDateString) {
      try {
        endDate = new Date(endDateString);
        if (isNaN(endDate.getTime())) {
          endDate = null;
        }
      } catch (err) {
        endDate = null;
      }
    }

    if (startDate) {
      matchQuery.date = { ...matchQuery.date, $gte: startDate };
    }

    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
      matchQuery.date = { ...matchQuery.date, $lte: endDate };
    }

    const totalFeedback = await Feedback.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalFeedback / limit);

    const feedbackItems = await Feedback.find(matchQuery)
      .populate({
        path: "devices",
        select: "label location token",
      })
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json(
      {
        success: true,
        feedback: feedbackItems,
        totalPages: totalPages,
        currentPage: page,
      },
      { status: 200 }
    );
  } catch (error) {
    let errorMessage = "Error fetching feedback";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
