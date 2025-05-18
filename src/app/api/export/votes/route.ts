import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";

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

    const matchQuery: Record<string, any> = { username };

    if (startDateString && startDateString.trim() !== "") {
      const startDate = new Date(startDateString);
      if (!isNaN(startDate.getTime())) {
        matchQuery.date = { ...(matchQuery.date || {}), $gte: startDate };
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
        matchQuery.date = { ...(matchQuery.date || {}), $lte: endDate };
      } else {
        return NextResponse.json(
          { success: false, message: "Invalid endDate format." },
          { status: 400 }
        );
      }
    }

    const feedbackEntries = await Feedback.find(matchQuery)
      .populate({ path: "devices", model: Device, select: "label location" })
      .sort({ date: -1 });

    if (feedbackEntries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No feedback entries found for the selected criteria to export as votes.",
        },
        { status: 404 }
      );
    }

    const headers = [
      "Date",
      "Time",
      "Overall Vote (Raw)",
      "Overall Vote (Translated)",
      "Individual Question Responses",
      "Device Label",
      "Device Location",
      "Username (Owner)",
      "Name",
      "Phone",
      "Email",
      "Comment",
    ];

    let csvString = headers.join(",") + "\r\n";

    for (const entry of feedbackEntries) {
      const entryDate = new Date(entry.date);
      const datePart = entryDate.toISOString().split("T")[0];
      const timePart = entryDate.toTimeString().split(" ")[0];

      const deviceLabel =
        entry.devices && entry.devices.length > 0
          ? (entry.devices[0] as any).label
          : "";
      const deviceLocation =
        entry.devices && entry.devices.length > 0
          ? (entry.devices[0] as any).location
          : "";

      const row = [
        datePart,
        timePart,
        escapeCsvField(entry.vote),
        escapeCsvField(entry.translated_vote),
        escapeCsvField(entry.questionsVoteToString),
        escapeCsvField(deviceLabel),
        escapeCsvField(deviceLocation),
        escapeCsvField(entry.username),
        escapeCsvField(entry.name),
        escapeCsvField(entry.phone),
        escapeCsvField(entry.email),
        escapeCsvField(entry.comment),
      ];
      csvString += row.join(",") + "\r\n";
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "text/csv");
    responseHeaders.set(
      "Content-Disposition",
      'attachment; filename="votes_export.csv"'
    );

    return new NextResponse(csvString, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error. Failed to export votes.",
      },
      { status: 500 }
    );
  }
}
