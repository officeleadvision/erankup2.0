import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";

export const runtime = "nodejs";

function escapeCsvField(field: any): string {
  if (field === null || typeof field === "undefined") {
    return "";
  }
  let stringField = String(field);
  if (
    stringField.includes(",") ||
    stringField.includes("\n") ||
    stringField.includes('"')
  ) {
    stringField = '"' + stringField.replace(/"/g, '""') + '"';
  }
  return stringField;
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
    const startDateString = searchParams.get("startDate");
    const endDateString = searchParams.get("endDate");

    const matchQuery: any = { username };

    if (startDateString) {
      const startDate = new Date(startDateString);
      if (!isNaN(startDate.getTime())) {
        matchQuery.date = { ...matchQuery.date, $gte: startDate };
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid startDate format." },
          { status: 400 }
        );
      }
    }

    if (endDateString) {
      const endDate = new Date(endDateString);
      if (!isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        matchQuery.date = { ...matchQuery.date, $lte: endDate };
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid endDate format." },
          { status: 400 }
        );
      }
    }

    const feedbackItems = await Feedback.find(matchQuery)
      .populate({ path: "devices", model: Device, select: "label location" })
      .sort({ date: -1 });

    if (feedbackItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No feedback found for the selected criteria.",
        },
        { status: 404 }
      );
    }

    const headers = [
      "Date",
      "Time",
      "Main Question",
      "Overall Vote (Raw)",
      "Overall Vote (Translated)",
      "Name",
      "Phone",
      "Email",
      "Comment",
      "Device Labels",
      "Device Locations",
      "Individual Question Votes",
      "Username (Owner)",
    ];

    let csvString = headers.join(",") + "\r\n";

    for (const fb of feedbackItems) {
      const fbDate = new Date(fb.date);
      const datePart = fbDate.toISOString().split("T")[0];
      const timePart = fbDate.toTimeString().split(" ")[0];

      const deviceLabels = fb.devices
        .map((d) => (d as any).label || "N/A")
        .join("; ");
      const deviceLocations = fb.devices
        .map((d) => (d as any).location || "N/A")
        .join("; ");

      const row = [
        datePart,
        timePart,
        escapeCsvField(fb.question),
        escapeCsvField(fb.vote),
        escapeCsvField(fb.translated_vote),
        escapeCsvField(fb.name),
        escapeCsvField(fb.phone),
        escapeCsvField(fb.email),
        escapeCsvField(fb.comment),
        escapeCsvField(deviceLabels),
        escapeCsvField(deviceLocations),
        escapeCsvField(fb.questionsVoteToString),
        escapeCsvField(fb.username),
      ];
      csvString += row.join(",") + "\r\n";
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "text/csv");
    responseHeaders.set(
      "Content-Disposition",
      'attachment; filename="feedback_export.csv"'
    );

    return new NextResponse(csvString, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    let errorMessage = "Error exporting feedback to CSV";
    if (error instanceof Error) errorMessage = error.message;
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
