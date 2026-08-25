import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Vote, { type VoteType } from "@/models/Vote";
import Device from "@/models/Device";
import Question from "@/models/Question";

export const dynamic = "force-dynamic";

interface AddVoteRequestBody {
  token: string;
  questionText?: string;
  vote: VoteType;
}

const validVoteTypes: VoteType[] = [
  "superlike",
  "like",
  "neutral",
  "dislike",
  "superdislike",
];

/**
 * Public endpoint used by the tablets. Intentionally unauthenticated.
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    let body: AddVoteRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { token, questionText, vote } = body;

    if (!token || !vote) {
      return NextResponse.json(
        {
          success: false,
          message: "Vote type and device token are required.",
        },
        { status: 400 }
      );
    }

    if (!validVoteTypes.includes(vote)) {
      return NextResponse.json(
        { success: false, message: "Invalid vote type provided." },
        { status: 400 }
      );
    }

    const device = await Device.findOne({ token: token.trim() });
    if (!device) {
      return NextResponse.json(
        { success: false, message: "Device not found for the provided token." },
        { status: 404 }
      );
    }

    // Prefer the exact question the tablet showed. Fall back to the device's
    // first active question, then to any active question of the owner.
    const trimmedQuestionText =
      typeof questionText === "string" ? questionText.trim() : "";

    let effectiveQuestion = trimmedQuestionText
      ? await Question.findOne({
          username: device.owner,
          question: trimmedQuestionText,
          hidden: false,
        })
      : null;

    if (!effectiveQuestion) {
      effectiveQuestion = await Question.findOne({
        username: device.owner,
        devices: device._id,
        hidden: false,
      }).sort({ order: 1, date: -1 });
    }

    if (!effectiveQuestion) {
      effectiveQuestion = await Question.findOne({
        username: device.owner,
        hidden: false,
      }).sort({ order: 1, date: -1 });
    }

    if (!effectiveQuestion) {
      return NextResponse.json(
        {
          success: false,
          message: "No active question found for this device to vote on.",
        },
        { status: 404 }
      );
    }

    const savedVote = await Vote.create({
      question: effectiveQuestion.question,
      date: new Date(),
      vote,
      device: {
        _id: device.id,
        owner: device.owner,
        location: device.location,
        label: device.label,
        token: device.token,
      },
      username: device.owner,
      location: device.location,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Vote submitted successfully",
        voteId: savedVote._id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/vote failed", error);
    return NextResponse.json(
      { success: false, message: "Error submitting vote" },
      { status: 500 }
    );
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

    const votes = await Vote.find({ username: username.toLowerCase() })
      .sort({ date: -1 })
      .limit(500);

    return NextResponse.json({ success: true, votes }, { status: 200 });
  } catch (error) {
    console.error("GET /api/vote failed", error);
    return NextResponse.json(
      { success: false, message: "Error fetching votes" },
      { status: 500 }
    );
  }
}
