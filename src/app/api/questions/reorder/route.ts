import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import Question from "@/models/Question";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

interface ReorderPayloadItem {
  questionId: string;
  newOrder: number;
}

interface ReorderRequestBody {
  reorder: ReorderPayloadItem[];
}

export async function PUT(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization");
  let rawTokenString: string | undefined = undefined;

  if (
    authorizationHeader &&
    authorizationHeader.toLowerCase().startsWith("bearer ")
  ) {
    rawTokenString = authorizationHeader.substring(7);
  }

  const getTokenParams: any = {
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  };

  if (rawTokenString) {
    getTokenParams.raw = rawTokenString;
  }

  const token = await getToken(getTokenParams);

  if (!token || !token.sub) {
    let message = "Authentication required.";
    if (rawTokenString && (!token || !token.sub)) {
      message = "Invalid or expired token provided.";
    }
    return NextResponse.json({ success: false, message }, { status: 401 });
  }

  try {
    const body: ReorderRequestBody = await request.json();
    const { reorder } = body;

    if (!reorder || !Array.isArray(reorder) || reorder.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid reorder payload." },
        { status: 400 }
      );
    }

    await dbConnect();

    const updatePromises = reorder.map((item) => {
      if (!item.questionId || typeof item.newOrder !== "number") {
        return Promise.resolve(null);
      }
      return Question.findByIdAndUpdate(
        item.questionId,
        { order: item.newOrder },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: "Questions reordered successfully.",
    });
  } catch (error) {
    let message = "Internal Server Error";
    if (error instanceof SyntaxError) {
      message = "Invalid JSON payload.";
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
