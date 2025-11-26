import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";
import { logActivity } from "@/lib/activityLogger";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type PopulatedDevice = {
  label?: string | null;
  location?: string | null;
};

function escapeCsvField(field: unknown): string {
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
    const login = request.headers.get("x-user-login") || username || "unknown";

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

    const startDate = startDateString ? new Date(startDateString) : null;
    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid startDate format." },
        { status: 400 }
      );
    }

    const endDateRaw = endDateString ? new Date(endDateString) : null;
    if (endDateRaw && isNaN(endDateRaw.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid endDate format." },
        { status: 400 }
      );
    }

    const endDate = endDateRaw ? new Date(endDateRaw.getTime()) : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    type DateQuery = {
      $gte?: Date;
      $lte?: Date;
    };

    const matchQuery: { username: string; date?: DateQuery } = { username };

    if (startDate) {
      matchQuery.date = { ...(matchQuery.date || {}), $gte: startDate };
    }

    if (endDate) {
      matchQuery.date = { ...(matchQuery.date || {}), $lte: endDate };
    }

    const feedbackItems = await Feedback.find(matchQuery)
      .populate({ path: "devices", model: Device, select: "label location" })
      .sort({ date: -1 });

    const persistExportActivity = async (
      status: "success" | "error",
      message: string,
      rowsOverride?: number
    ) => {
      try {
        const totalRows =
          typeof rowsOverride === "number"
            ? rowsOverride
            : feedbackItems.length;
        await logActivity({
          account: username,
          performedBy: login,
          entityType: "export",
          action: "feedback",
          status,
          message,
          metadata: {
            exportType: "feedback",
            format,
            startDate: startDateString,
            endDate: endDateString,
            totalRows,
          },
        });
      } catch (logError) {
        console.error("Failed to persist feedback export log", logError);
      }
    };

    if (feedbackItems.length === 0) {
      await persistExportActivity(
        "error",
        "No feedback found for the selected criteria.",
        0
      );
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
        .map((d) => (d as PopulatedDevice).label ?? "N/A")
        .join("; ");
      const deviceLocations = fb.devices
        .map((d) => (d as PopulatedDevice).location ?? "N/A")
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
      ].map((value) =>
        value === null || typeof value === "undefined" ? "" : value
      );

      worksheetData.push(rowValues as Array<string | number>);
      const csvRow = rowValues.map((value) => escapeCsvField(value));
      csvString += csvRow.join(",") + "\r\n";
    }

    await persistExportActivity(
      "success",
      `Exported ${
        feedbackItems.length
      } feedback rows as ${format.toUpperCase()}`
    );

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
    console.error("Error exporting feedback", error);
    let errorMessage = "Error exporting feedback";
    if (error instanceof Error) errorMessage = error.message;
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
