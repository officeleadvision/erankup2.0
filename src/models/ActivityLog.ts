import mongoose, { Document, Model, Schema } from "mongoose";

export type ActivityEntityType = "export" | "device" | "question";
export type ActivityStatus = "success" | "error";

export interface IActivityLog extends Document {
  account: string;
  performedBy: string;
  entityType: ActivityEntityType;
  action: string;
  entityId?: string;
  entityName?: string;
  status: ActivityStatus;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema: Schema<IActivityLog> = new Schema(
  {
    account: { type: String, required: true, index: true },
    performedBy: { type: String, required: true },
    entityType: {
      type: String,
      enum: ["export", "device", "question"],
      required: true,
      index: true,
    },
    action: { type: String, required: true },
    entityId: { type: String },
    entityName: { type: String },
    status: { type: String, enum: ["success", "error"], default: "success" },
    message: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: "activity_logs",
  }
);

ActivityLogSchema.index({ account: 1, createdAt: -1 });
ActivityLogSchema.index({ entityType: 1, createdAt: -1 });

const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);

export default ActivityLog;

