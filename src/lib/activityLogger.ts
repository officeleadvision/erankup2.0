import ActivityLog, {
  ActivityEntityType,
  ActivityStatus,
} from "@/models/ActivityLog";

type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "export"
  | "reorder"
  | "toggle"
  | "download"
  | string;

export interface ActivityLogPayload {
  account: string;
  performedBy: string;
  entityType: ActivityEntityType;
  action: ActivityAction;
  status: ActivityStatus;
  message?: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(payload: ActivityLogPayload) {
  if (!payload.account || !payload.performedBy) {
    return;
  }

  try {
    await ActivityLog.create({
      account: payload.account,
      performedBy: payload.performedBy,
      entityType: payload.entityType,
      action: payload.action,
      status: payload.status,
      message: payload.message,
      entityId: payload.entityId,
      entityName: payload.entityName,
      metadata: payload.metadata ?? undefined,
    });
  } catch (error) {
    console.error("Failed to persist activity log", error);
  }
}

