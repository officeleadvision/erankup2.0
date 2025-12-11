import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";
import { decrypt } from "@/lib/cryptoUtils";
import { logActivity } from "@/lib/activityLogger";
import {
  formatDateInTimezone,
  parseDateStartOfDayUTC,
  parseDateEndOfDayUTC,
} from "@/lib/timezoneUtils";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type DeviceLike = {
  label?: string | null;
  location?: string | null;
  token?: string | null;
};

const voteTranslations: Record<string, string> = {
  superlike: "Много доволен",
  like: "Доволен",
  neutral: "Неутрален",
  dislike: "Недоволен",
  superdislike: "Много недоволен",
};

const translateVote = (vote?: unknown) => {
  if (!vote || typeof vote !== "string") return "";
  return voteTranslations[vote] || vote;
};

const extractDeviceField = (
  deviceEntry: any,
  field: "label" | "location" | "token"
) => {
  if (!deviceEntry) return undefined;
  if (deviceEntry[field]) return deviceEntry[field];
  if (deviceEntry?.device && deviceEntry.device[field])
    return deviceEntry.device[field];
  if (deviceEntry?._doc && deviceEntry._doc[field])
    return deviceEntry._doc[field];
  return undefined;
};

const safeDecrypt = (value: unknown) => {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value !== "string") return value as any;
  const decrypted = decrypt(value);
  if (decrypted === null || decrypted === "[Decryption Error]") {
    return value;
  }
  return decrypted;
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

    const timezone = searchParams.get("timezone") || "UTC";

    // Parse dates using utility functions
    const startDate = parseDateStartOfDayUTC(startDateString);
    const endDate = parseDateEndOfDayUTC(endDateString);

    // Validate dates if provided
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

    type DateQuery = {
      $gte?: Date;
      $lte?: Date;
    };

    const matchQuery: { username: string; date?: DateQuery } = {
      username: username.toLowerCase(),
    };

    if (startDate) {
      matchQuery.date = { ...(matchQuery.date || {}), $gte: startDate };
    }

    if (endDate) {
      matchQuery.date = { ...(matchQuery.date || {}), $lte: endDate };
    }

    const feedbackEntries = await Feedback.find(matchQuery)
      .populate({
        path: "devices",
        model: Device,
        select: "label location token",
      })
      .sort({ date: -1 })
      .lean({ virtuals: true, getters: true });

    const feedbackIds = feedbackEntries
      .map((fb: any) => fb?._id)
      .filter(Boolean)
      .map((id: any) => String(id));

    const devicesByFeedbackId = new Map<string, any[]>();
    if (feedbackIds.length > 0) {
      const feedbackDevices = await Feedback.find({
        _id: { $in: feedbackIds },
      })
        .select("devices")
        .lean();
      feedbackDevices.forEach((fd: any) => {
        if (!fd?._id || !Array.isArray(fd.devices)) return;
        devicesByFeedbackId.set(String(fd._id), fd.devices);
      });
    }

    const persistExportActivity = async (
      status: "success" | "error",
      message: string,
      rowsOverride?: number
    ) => {
      try {
        const totalRows =
          typeof rowsOverride === "number"
            ? rowsOverride
            : feedbackEntries.length;
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
      const { datePart, timePart } = formatDateInTimezone(entryDate, timezone);

      const devicesArray = Array.isArray((entry as any).devices)
        ? (entry as any).devices
        : (entry as any).devices
        ? [(entry as any).devices]
        : [];

      const storedDevices =
        entry?._id && devicesByFeedbackId.get(String(entry._id))
          ? devicesByFeedbackId.get(String(entry._id))
          : [];

      const primaryDeviceCandidate =
        (Array.isArray(storedDevices) && storedDevices[0]) ||
        (devicesArray.length > 0 ? devicesArray[0] : null);

      const deviceLabel =
        extractDeviceField(primaryDeviceCandidate, "label") ??
        entry.device_label ??
        "";
      const deviceLocation =
        extractDeviceField(primaryDeviceCandidate, "location") ??
        entry.location ??
        "";

      const questionsList =
        Array.isArray(entry.questionsVote) && entry.questionsVote.length > 0
          ? entry.questionsVote
          : [
              {
                question: entry.question,
                vote: entry.vote,
              },
            ];

      questionsList.forEach((q: any) => {
        const rowValues = [
          datePart,
          timePart,
          q?.vote ?? entry.vote,
          translateVote(q?.vote ?? entry.vote),
          `${q?.question || entry.question || "N/A"}`,
          deviceLabel,
          deviceLocation,
          entry.username,
          safeDecrypt(entry.name),
          safeDecrypt(entry.phone),
          safeDecrypt(entry.email),
          safeDecrypt(entry.comment),
        ].map((value) =>
          value === null || typeof value === "undefined" ? "" : value
        );

        worksheetData.push(rowValues as Array<string | number>);
        const csvRow = rowValues.map((value) => escapeCsvField(value));
        csvString += csvRow.join(",") + "\r\n";
      });
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
