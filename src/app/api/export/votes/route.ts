import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import Device from "@/models/Device";
import { logActivity } from "@/lib/activityLogger";
import {
  formatDateInTimezone,
  parseDateStartOfDay,
  parseDateEndOfDay,
  resolveTimezone,
} from "@/lib/timezoneUtils";
import {
  buildFeedbackMatchQuery,
  CASE_INSENSITIVE_COLLATION,
  extractQuestionVoteItemsFromFeedback,
} from "@/lib/voteAggregation";
import {
  buildExportResponse,
  extractDeviceField,
  parseExportFormat,
  safeDecrypt,
  toDevicesArray,
} from "@/lib/exportUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const voteTranslations: Record<string, string> = {
  superlike: "Много доволен",
  like: "Доволен",
  neutral: "Неутрален",
  dislike: "Недоволен",
  superdislike: "Много недоволен",
};

const translateVote = (vote?: unknown) => {
  if (!vote || typeof vote !== "string") return "";
  return voteTranslations[vote.toLowerCase()] || vote;
};

type FeedbackExportDoc = {
  _id: unknown;
  date: Date;
  username?: string;
  question?: string;
  vote?: string;
  questionsVote?: Array<{ question?: string; vote?: string } | null>;
  devices?: unknown;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  comment?: string | null;
};

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
    const format = parseExportFormat(searchParams.get("format"));

    if (!format) {
      return NextResponse.json(
        { success: false, message: "Invalid format. Use csv or xlsx." },
        { status: 400 }
      );
    }

    // The same timezone drives BOTH the day boundaries of the query and the
    // rendered Date/Time columns, so every exported row falls inside the
    // requested calendar range as the user sees it.
    const timezone = resolveTimezone(searchParams.get("timezone"));

    const startDate = parseDateStartOfDay(startDateString, timezone);
    const endDate = parseDateEndOfDay(endDateString, timezone);

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
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { success: false, message: "startDate must not be after endDate." },
        { status: 400 }
      );
    }

    const filters = {
      username,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    };

    // Devices are stored as embedded objects on the feedback document; read
    // them raw (no populate) so the label/location captured at vote time are
    // exported even if the device was later renamed or deleted.
    const feedbackEntries = (await Feedback.find(
      buildFeedbackMatchQuery(filters)
    )
      .collation(CASE_INSENSITIVE_COLLATION)
      .sort({ date: -1 })
      .lean()) as unknown as FeedbackExportDoc[];

    // Fallback lookup for legacy rows that only stored device ids / tokens.
    const deviceIds = new Set<string>();
    const deviceTokens = new Set<string>();
    const collectDeviceKeys = (devices: unknown) => {
      toDevicesArray(devices).forEach((deviceEntry) => {
        if (typeof deviceEntry === "string") {
          deviceIds.add(deviceEntry);
          deviceTokens.add(deviceEntry);
        } else if (
          deviceEntry &&
          typeof deviceEntry === "object" &&
          !extractDeviceField(deviceEntry, "label")
        ) {
          const id = (deviceEntry as { _id?: unknown })._id;
          if (id) deviceIds.add(String(id));
          const token = extractDeviceField(deviceEntry, "token");
          if (token) deviceTokens.add(token);
        }
      });
    };
    feedbackEntries.forEach((entry) => collectDeviceKeys(entry.devices));

    const deviceLookup = new Map<
      string,
      { label?: string; location?: string }
    >();
    if (deviceIds.size > 0 || deviceTokens.size > 0) {
      const validIds = Array.from(deviceIds).filter((id) =>
        /^[a-f\d]{24}$/i.test(id)
      );
      const orClauses: Record<string, unknown>[] = [];
      if (validIds.length > 0) orClauses.push({ _id: { $in: validIds } });
      if (deviceTokens.size > 0)
        orClauses.push({ token: { $in: Array.from(deviceTokens) } });
      if (orClauses.length > 0) {
        const devices = await Device.find({ $or: orClauses })
          .select("label location token")
          .lean();
        devices.forEach((device) => {
          const info = { label: device.label, location: device.location };
          deviceLookup.set(String(device._id), info);
          if (device.token) deviceLookup.set(device.token, info);
        });
      }
    }

    const resolveDevice = (devices: unknown) => {
      const primary = toDevicesArray(devices)[0];
      const fromEmbedded = {
        label: extractDeviceField(primary, "label"),
        location: extractDeviceField(primary, "location"),
      };
      if (fromEmbedded.label || fromEmbedded.location) {
        return {
          label: fromEmbedded.label ?? "",
          location: fromEmbedded.location ?? "",
        };
      }
      const key =
        typeof primary === "string"
          ? primary
          : (primary as { _id?: unknown } | undefined)?._id
          ? String((primary as { _id?: unknown })._id)
          : extractDeviceField(primary, "token");
      const looked = key ? deviceLookup.get(key) : undefined;
      return { label: looked?.label ?? "", location: looked?.location ?? "" };
    };

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

    const rows: Array<{ sortKey: number; values: Array<string | number> }> = [];

    for (const entry of feedbackEntries) {
      const entryDate = new Date(entry.date);
      const { datePart, timePart } = formatDateInTimezone(entryDate, timezone);
      const device = resolveDevice(entry.devices);

      const name = safeDecrypt(entry.name);
      const phone = safeDecrypt(entry.phone);
      const email = safeDecrypt(entry.email);
      const comment = safeDecrypt(entry.comment);

      extractQuestionVoteItemsFromFeedback(entry).forEach((q) => {
        const rawVote = q.vote ?? entry.vote ?? "";
        rows.push({
          sortKey: entryDate.getTime(),
          values: [
            datePart,
            timePart,
            rawVote,
            translateVote(rawVote),
            q.question || entry.question || "N/A",
            device.label,
            device.location,
            entry.username ?? "",
            name,
            phone,
            email,
            comment,
          ],
        });
      });
    }

    rows.sort((a, b) => b.sortKey - a.sortKey);

    const worksheetData: Array<Array<string | number>> = [
      headers,
      ...rows.map((row) => row.values),
    ];
    const totalRows = rows.length;

    const persistExportActivity = async (
      status: "success" | "error",
      message: string
    ) => {
      try {
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
            timezone,
            totalRows,
            feedbackSessions: feedbackEntries.length,
          },
        });
      } catch (logError) {
        console.error("Failed to persist votes export log", logError);
      }
    };

    if (totalRows === 0) {
      await persistExportActivity(
        "error",
        "No votes found for the selected criteria."
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

    await persistExportActivity(
      "success",
      `Exported ${totalRows} vote rows (${feedbackEntries.length} feedback sessions) as ${format.toUpperCase()}`
    );

    return buildExportResponse(
      format,
      worksheetData,
      "votes_export",
      "Votes"
    );
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
