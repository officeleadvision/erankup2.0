import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";
import { logActivity } from "@/lib/activityLogger";
import { decrypt } from "@/lib/cryptoUtils";
import {
  formatDateInTimezone,
  parseDateStartOfDayUTC,
  parseDateEndOfDayUTC,
} from "@/lib/timezoneUtils";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type ResolvedDeviceInfo = {
  label?: string | null;
  location?: string | null;
  token?: string | null;
};

const voteTranslations: Record<string, string> = {
  superlike: "😄 Много доволен",
  like: "🙂 Доволен",
  neutral: "😐 Неутрален",
  dislike: "😞 Недоволен",
  superdislike: "😠 Много недоволен",
};

const translateVote = (vote?: unknown) => {
  if (!vote || typeof vote !== "string") return "N/A";
  return voteTranslations[vote] || vote;
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
  if (deviceEntry?.data && deviceEntry.data[field])
    return deviceEntry.data[field];
  return undefined;
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

    const feedbackItems = await Feedback.find(matchQuery)
      .populate({
        path: "devices",
        model: Device,
        select: "label location token",
      })
      .sort({ date: -1 })
      .lean({ virtuals: true, getters: true });

    const feedbackIds = feedbackItems
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

    const deviceIdSet = new Set<string>();
    const deviceTokenSet = new Set<string>();
    feedbackItems.forEach((fb: any) => {
      const devicesArray = Array.isArray(fb.devices)
        ? fb.devices
        : fb.devices
        ? [fb.devices]
        : [];
      devicesArray.forEach((deviceEntry: any) => {
        const idCandidate =
          deviceEntry?._id ||
          deviceEntry?.id ||
          deviceEntry?._doc?._id ||
          deviceEntry?.device?._id;
        if (idCandidate) {
          deviceIdSet.add(String(idCandidate));
        }
        if (typeof deviceEntry === "string") {
          deviceIdSet.add(deviceEntry);
          deviceTokenSet.add(deviceEntry);
        }
        const tokenCandidate =
          extractDeviceField(deviceEntry, "token") ||
          (typeof deviceEntry === "object" ? deviceEntry.token : undefined);
        if (tokenCandidate) {
          deviceTokenSet.add(tokenCandidate);
        }
      });
    });

    const deviceQuery = [];
    if (deviceIdSet.size > 0) {
      deviceQuery.push({ _id: { $in: Array.from(deviceIdSet) } });
    }
    if (deviceTokenSet.size > 0) {
      deviceQuery.push({ token: { $in: Array.from(deviceTokenSet) } });
    }

    const devicesFromDb =
      deviceQuery.length > 0
        ? await Device.find({ $or: deviceQuery }).select("label location token")
        : [];

    const deviceById = new Map<string, ResolvedDeviceInfo>();
    const deviceByToken = new Map<string, ResolvedDeviceInfo>();

    devicesFromDb.forEach((device) => {
      deviceById.set(String(device._id), {
        label: device.label,
        location: device.location,
        token: device.token,
      });
      if (device.token) {
        deviceByToken.set(device.token, {
          label: device.label,
          location: device.location,
          token: device.token,
        });
      }
    });

    const resolveDevicesForFeedback = (fb: any): ResolvedDeviceInfo[] => {
      const devicesArray = Array.isArray(fb.devices)
        ? fb.devices
        : fb.devices
        ? [fb.devices]
        : [];

      const storedDevices =
        fb?._id && devicesByFeedbackId.get(String(fb._id))
          ? devicesByFeedbackId.get(String(fb._id))
          : [];

      const candidates: any[] = [
        ...devicesArray,
        ...(Array.isArray(storedDevices) ? storedDevices : []),
      ];

      if (candidates.length === 0) {
        return [
          {
            label: fb.device_label ?? "N/A",
            location: fb.location ?? "N/A",
          },
        ];
      }

      return candidates.map((deviceEntry: any) => {
        const deviceId =
          typeof deviceEntry === "string"
            ? deviceEntry
            : deviceEntry?._id
            ? String(deviceEntry._id)
            : deviceEntry?.id
            ? String(deviceEntry.id)
            : deviceEntry?._doc?._id
            ? String(deviceEntry._doc._id)
            : deviceEntry?.device?._id
            ? String(deviceEntry.device._id)
            : undefined;
        const token = extractDeviceField(deviceEntry, "token");
        const lookupDevice =
          (deviceId && deviceById.get(deviceId)) ||
          (token && deviceByToken.get(token));

        return {
          label:
            extractDeviceField(deviceEntry, "label") ??
            lookupDevice?.label ??
            fb.device_label ??
            "N/A",
          location:
            extractDeviceField(deviceEntry, "location") ??
            lookupDevice?.location ??
            fb.location ??
            "N/A",
          token: token ?? lookupDevice?.token,
        };
      });
    };

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
      "Questions",
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
      const { datePart, timePart } = formatDateInTimezone(fbDate, timezone);

      const resolvedDevices = resolveDevicesForFeedback(fb);
      const deviceLabels = resolvedDevices
        .map((d) => d.label ?? "N/A")
        .join("; ");
      const deviceLocations = resolvedDevices
        .map((d) => d.location ?? "N/A")
        .join("; ");

      const questionsCell =
        Array.isArray((fb as any).questionsVote) &&
        (fb as any).questionsVote.length > 0
          ? (fb as any).questionsVote
              .map((item: any) => {
                const questionText = item?.question || "N/A";
                const translated = translateVote(item?.vote);
                return `${questionText}: ${translated}`;
              })
              .join("\n")
          : fb.question;

      const rowValues = [
        datePart,
        timePart,
        questionsCell,
        fb.vote,
        fb.translated_vote,
        safeDecrypt(fb.name),
        safeDecrypt(fb.phone),
        safeDecrypt(fb.email),
        safeDecrypt(fb.comment),
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
