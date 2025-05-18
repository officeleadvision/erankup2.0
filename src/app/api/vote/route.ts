import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Vote, { type VoteType } from "@/models/Vote";
import Device from "@/models/Device";
import Question from "@/models/Question";
import mongoose from "mongoose";

interface AddVoteRequestBody {
  token: string;
  questionText?: string;
  vote: VoteType;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { token, questionText, vote }: AddVoteRequestBody =
      await request.json();

    if (!token || !vote) {
      return NextResponse.json(
        {
          success: false,
          message: "Vote type and device token are required.",
        },
        { status: 400 }
      );
    }

    const validVoteTypes: VoteType[] = [
      "superlike",
      "like",
      "neutral",
      "dislike",
      "superdislike",
    ];
    if (!validVoteTypes.includes(vote)) {
      return NextResponse.json(
        { success: false, message: "Invalid vote type provided." },
        { status: 400 }
      );
    }

    const device = await Device.findOne({ token: token });
    if (!device) {
      return NextResponse.json(
        { success: false, message: "Device not found for the provided token." },
        { status: 404 }
      );
    }

    let effectiveQuestion;

    effectiveQuestion = await Question.findOne({
      username: device.owner,
      devices: {
        $elemMatch: { $eq: device._id },
      },
      hidden: false,
    }).sort({ date: -1, order: 1 });

    if (!effectiveQuestion) {
      effectiveQuestion = await Question.findOne({
        username: device.owner,
        hidden: false,
      }).sort({ date: -1, order: 1 });
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

    const deviceObjectForVote = {
      _id: device.id,
      owner: device.owner,
      location: device.location,
      label: device.label,
      token: device.token,
    };

    const voteDocumentToSave = {
      question: effectiveQuestion.question,
      date: new Date(),
      vote: vote,
      device: deviceObjectForVote,
      username: device.owner,
      location: device.location,
    };

    const savedVote = await Vote.create(voteDocumentToSave);

    return NextResponse.json(
      {
        success: true,
        message: "Vote submitted successfully",
        voteId: savedVote._id,
      },
      { status: 201 }
    );
  } catch (error) {
    let errorMessage = "Error submitting vote";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
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

    const votes = await Vote.find({ username })
      .populate({
        path: "device",
        select: "label location token",
      })
      .sort({ date: -1 });

    return NextResponse.json(
      {
        success: true,
        votes,
      },
      { status: 200 }
    );
  } catch (error) {
    let errorMessage = "Error fetching votes";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
