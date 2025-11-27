import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import ActivityLog from "@/models/ActivityLog";

type Scope = "account" | "global";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(searchParams.get("limit") || "25", 10);
    const searchTermRaw = searchParams.get("search") || "";
    const searchTerm = searchTermRaw.trim();
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limitRaw =
      Number.isNaN(limitParam) || limitParam < 1 ? 25 : limitParam;
    const limit = Math.min(Math.max(limitRaw, 5), 100);

    const accountUsername = request.headers.get("x-user-username");
    const isModerator = request.headers.get("x-user-moderator") === "true";
    const isAdmin = request.headers.get("x-user-admin") === "true";

    if (!accountUsername || (!isModerator && !isAdmin)) {
      return NextResponse.json(
        {
          success: false,
          message: "Insufficient permissions to view export logs.",
        },
        { status: 403 }
      );
    }

    const scope: Scope = isAdmin ? "global" : "account";
    const query: Record<string, unknown> = {};

    if (scope === "account" && accountUsername) {
      query.account = accountUsername;
      query.entityType = { $ne: "user" };
    }

    if (searchTerm) {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");
      query.$or = [
        { account: searchRegex },
        { performedBy: searchRegex },
        { entityType: searchRegex },
        { action: searchRegex },
        { entityId: searchRegex },
        { entityName: searchRegex },
        { message: searchRegex },
        {
          $expr: {
            $regexMatch: {
              input: {
                $ifNull: [
                  {
                    $convert: {
                      input: "$metadata",
                      to: "string",
                      onError: "",
                      onNull: "",
                    },
                  },
                  "",
                ],
              },
              regex: searchRegex,
            },
          },
        },
      ];
    }

    const [logs, totalCount] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

    return NextResponse.json({
      success: true,
      scope,
      page,
      limit,
      totalPages,
      search: searchTerm || undefined,
      logs: logs.map((log) => ({
        id: String(log._id),
        account: log.account,
        performedBy: log.performedBy,
        entityType: log.entityType,
        action: log.action,
        entityId: log.entityId,
        entityName: log.entityName,
        status: log.status,
        message: log.message,
        metadata: log.metadata ?? null,
        createdAt: log.createdAt,
      })),
      note:
        scope === "global"
          ? "Като администратор виждате всички действия с устройства, въпроси, експорти и потребители за всеки акаунт."
          : "Всички експорти, промени на устройства и въпроси за този акаунт. Потребителските действия са достъпни само за администратори.",
    });
  } catch (error) {
    console.error("Failed to load export logs", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load export logs.",
      },
      { status: 500 }
    );
  }
}
