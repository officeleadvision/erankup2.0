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
} from "@/lib/voteAggregation";
import {
  buildExportResponse,
  extractDeviceField,
  extractDeviceId,
  parseExportFormat,
  safeDecrypt,
  toDevicesArray,
} from "@/lib/exportUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResolvedDeviceInfo = {
  label: string;
  location: string;
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

    const matchQuery = buildFeedbackMatchQuery({
      username,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });

    const feedbackItems = (await Feedback.find(matchQuery)
      .collation(CASE_INSENSITIVE_COLLATION)
      .sort({ date: -1 })
      .lean()) as unknown as FeedbackExportDoc[];

    // Resolve legacy device references (ids / tokens) in one query.
    const deviceIdSet = new Set<string>();
    const deviceTokenSet = new Set<string>();
    feedbackItems.forEach((fb) => {
      toDevicesArray(fb.devices).forEach((deviceEntry) => {
        const id = extractDeviceId(deviceEntry);
        if (id) deviceIdSet.add(id);
        if (typeof deviceEntry === "string") deviceTokenSet.add(deviceEntry);
        const token = extractDeviceField(deviceEntry, "token");
        if (token) deviceTokenSet.add(token);
      });
    });

    const deviceById = new Map<string, ResolvedDeviceInfo>();
    const deviceByToken = new Map<string, ResolvedDeviceInfo>();
    const validIds = Array.from(deviceIdSet).filter((id) =>
      /^[a-f\d]{24}$/i.test(id)
    );
    const orClauses: Record<string, unknown>[] = [];
    if (validIds.length > 0) orClauses.push({ _id: { $in: validIds } });
    if (deviceTokenSet.size > 0)
      orClauses.push({ token: { $in: Array.from(deviceTokenSet) } });
    if (orClauses.length > 0) {
      const devicesFromDb = await Device.find({ $or: orClauses })
        .select("label location token")
        .lean();
      devicesFromDb.forEach((device) => {
        const info: ResolvedDeviceInfo = {
          label: device.label ?? "N/A",
          location: device.location ?? "N/A",
        };
        deviceById.set(String(device._id), info);
        if (device.token) deviceByToken.set(device.token, info);
      });
    }

    const resolveDevicesForFeedback = (
      fb: FeedbackExportDoc
    ): ResolvedDeviceInfo[] => {
      const candidates = toDevicesArray(fb.devices);
      if (candidates.length === 0) {
        return [{ label: "N/A", location: "N/A" }];
      }
      return candidates.map((deviceEntry) => {
        const deviceId = extractDeviceId(deviceEntry);
        const token = extractDeviceField(deviceEntry, "token");
        const lookupDevice =
          (deviceId && deviceById.get(deviceId)) ||
          (token && deviceByToken.get(token)) ||
          undefined;
        return {
          label:
            extractDeviceField(deviceEntry, "label") ??
            lookupDevice?.label ??
            "N/A",
          location:
            extractDeviceField(deviceEntry, "location") ??
            lookupDevice?.location ??
            "N/A",
        };
      });
    };

    const persistExportActivity = async (
      status: "success" | "error",
      message: string
    ) => {
      try {
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
            timezone,
            totalRows: feedbackItems.length,
          },
        });
      } catch (logError) {
        console.error("Failed to persist feedback export log", logError);
      }
    };

    if (feedbackItems.length === 0) {
      await persistExportActivity(
        "error",
        "No feedback found for the selected criteria."
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

    const rows: Array<Array<string | number>> = [headers];

    for (const fb of feedbackItems) {
      const { datePart, timePart } = formatDateInTimezone(
        new Date(fb.date),
        timezone
      );

      const resolvedDevices = resolveDevicesForFeedback(fb);
      const deviceLabels = resolvedDevices.map((d) => d.label).join("; ");
      const deviceLocations = resolvedDevices
        .map((d) => d.location)
        .join("; ");

      const questionVotes = Array.isArray(fb.questionsVote)
        ? fb.questionsVote.filter(
            (item): item is { question?: string; vote?: string } =>
              item !== null && typeof item === "object"
          )
        : [];

      // Virtuals are NOT applied by .lean(), so compute them explicitly.
      const questionsVoteToString =
        questionVotes.length > 0
          ? questionVotes
              .map(
                (item) => `${item.question || "N/A"}: ${translateVote(item.vote)}`
              )
              .join("\n")
          : "";

      const questionsCell =
        questionVotes.length > 0
          ? questionVotes.map((item) => item.question || "N/A").join("\n")
          : fb.question ?? "";

      rows.push([
        datePart,
        timePart,
        questionsCell,
        fb.vote ?? "",
        fb.vote ? translateVote(fb.vote) : "",
        safeDecrypt(fb.name),
        safeDecrypt(fb.phone),
        safeDecrypt(fb.email),
        safeDecrypt(fb.comment),
        deviceLabels,
        deviceLocations,
        questionsVoteToString,
        fb.username ?? "",
      ]);
    }

    await persistExportActivity(
      "success",
      `Exported ${feedbackItems.length} feedback rows as ${format.toUpperCase()}`
    );

    return buildExportResponse(format, rows, "feedback_export", "Feedback");
  } catch (error) {
    console.error("Error exporting feedback", error);
    return NextResponse.json(
      { success: false, message: "Error exporting feedback" },
      { status: 500 }
    );
  }
}
