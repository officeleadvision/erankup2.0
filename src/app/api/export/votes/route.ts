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

    const startDate =
      startDateString && startDateString.trim() !== ""
        ? new Date(startDateString)
        : null;
    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid startDate format." },
        { status: 400 }
      );
    }

    const endDateRaw =
      endDateString && endDateString.trim() !== ""
        ? new Date(endDateString)
        : null;
    if (endDateRaw && isNaN(endDateRaw.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid endDate format." },
        { status: 400 }
      );
    }

    const endDate =
      endDateRaw !== null ? new Date(endDateRaw.getTime()) : endDateRaw;
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

    const feedbackEntries = await Feedback.find(matchQuery)
      .populate({ path: "devices", model: Device, select: "label location" })
      .sort({ date: -1 });

    const persistExportActivity = async (
      status: "success" | "error",
      message: string,
      rowsOverride?: number
    ) => {
      try {
        const totalRows =
          typeof rowsOverride === "number" ? rowsOverride : feedbackEntries.length;
        await logActivity({
          account: username,
          performedBy: login,
          entityType: "export",
          action: "votes",
          status,
          message,
          metadata: {
            exportType: "votes",
            format,
            startDate: startDateString,
            endDate: endDateString,
            totalRows,
          },
        });
      } catch (logError) {
        console.error("Failed to persist votes export log", logError);
      }
    };

    if (feedbackEntries.length === 0) {
      await persistExportActivity(
        "error",
        "No feedback entries found for the selected criteria to export as votes.",
        0
      );
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

    const worksheetData: Array<Array<string | number>> = [headers];
    let csvString = headers.join(",") + "\r\n";

    for (const entry of feedbackEntries) {
      const entryDate = new Date(entry.date);
      const datePart = entryDate.toISOString().split("T")[0];
      const timePart = entryDate.toTimeString().split(" ")[0];

      const primaryDevice =
        entry.devices && entry.devices.length > 0
          ? (entry.devices[0] as PopulatedDevice)
          : null;
      const deviceLabel = primaryDevice?.label ?? "";
      const deviceLocation = primaryDevice?.location ?? "";

      const rowValues = [
        datePart,
        timePart,
        entry.vote,
        entry.translated_vote,
        entry.questionsVoteToString,
        deviceLabel,
        deviceLocation,
        entry.username,
        entry.name,
        entry.phone,
        entry.email,
        entry.comment,
      ].map((value) => (value === null || typeof value === "undefined" ? "" : value));

      worksheetData.push(rowValues as Array<string | number>);
      const csvRow = rowValues.map((value) => escapeCsvField(value));
      csvString += csvRow.join(",") + "\r\n";
    }

    await persistExportActivity(
      "success",
      `Exported ${feedbackEntries.length} vote rows as ${format.toUpperCase()}`
    );

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Votes");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

      const responseHeaders = new Headers();
      responseHeaders.set(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      responseHeaders.set(
        "Content-Disposition",
        'attachment; filename="votes_export.xlsx"'
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
      'attachment; filename="votes_export.csv"'
    );

    return new NextResponse(csvString, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Failed to export votes", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error. Failed to export votes.",
      },
      { status: 500 }
    );
  }
}
