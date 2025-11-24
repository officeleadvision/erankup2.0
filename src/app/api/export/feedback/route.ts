import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";
import * as XLSX from "xlsx";

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
    const requestedFormat = (searchParams.get("format") || "csv").toLowerCase();

    if (requestedFormat !== "csv" && requestedFormat !== "xlsx") {
      return NextResponse.json(
        { success: false, message: "Invalid format. Use csv or xlsx." },
        { status: 400 }
      );
    }

    const format = requestedFormat as "csv" | "xlsx";

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

    const worksheetData: Array<Array<string | number>> = [headers];
    let csvString = headers.join(",") + "\r\n";

    for (const fb of feedbackItems) {
      const fbDate = new Date(fb.date);
      const datePart = fbDate.toISOString().split("T")[0];
      const timePart = fbDate.toTimeString().split(" ")[0];

      const deviceLabels = fb.devices
        .map((d) => ((d as any).label || "N/A"))
        .join("; ");
      const deviceLocations = fb.devices
        .map((d) => ((d as any).location || "N/A"))
        .join("; ");

      const rowValues = [
        datePart,
        timePart,
        fb.question,
        fb.vote,
        fb.translated_vote,
        fb.name,
        fb.phone,
        fb.email,
        fb.comment,
        deviceLabels,
        deviceLocations,
        fb.questionsVoteToString,
        fb.username,
      ].map((value) => (value === null || typeof value === "undefined" ? "" : value));

      worksheetData.push(rowValues as Array<string | number>);
      const csvRow = rowValues.map((value) => escapeCsvField(value));
      csvString += csvRow.join(",") + "\r\n";
    }

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Feedback");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

      const responseHeaders = new Headers();
      responseHeaders.set(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      responseHeaders.set(
        "Content-Disposition",
        'attachment; filename="feedback_export.xlsx"'
      );

      return new NextResponse(buffer, {
        status: 200,
        headers: responseHeaders,
      });
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
    let errorMessage = "Error exporting feedback";
    if (error instanceof Error) errorMessage = error.message;
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
