import mongoose, { Schema, Document, Model } from "mongoose";
import { IDevice } from "./Device"; // For populating and type safety

export type VoteType =
  | "superlike"
  | "like"
  | "neutral"
  | "dislike"
  | "superdislike";

const voteTranslations: Record<VoteType, string> = {
  superlike: "Много доволен",
  like: "Доволен",
  neutral: "Неутрален",
  dislike: "Недоволен",
  superdislike: "Много недоволен",
};

export interface IVote extends Document {
  date: Date;
  username?: string;
  location: string; // Now a regular field, not just a virtual
  device: IDevice | any; // Store the full device object
  question: string;
  vote_translated?: string; // This will be a virtual
  vote: VoteType;
  feedbackId?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const VoteSchema: Schema<IVote> = new Schema(
  {
    date: { type: Date, default: Date.now, required: true },
    username: { type: String, lowercase: true, required: false },
    location: { type: String, required: false }, // Add location as a direct field
    device: {
      type: Schema.Types.Mixed, // Allow storing the full device object
      required: true,
    },
    question: {
      type: String,
      required: true,
      default: "Доволни ли сте от обслужването?",
    },
    vote: {
      type: String,
      enum: ["superlike", "like", "neutral", "dislike", "superdislike"],
      required: true,
    },
    feedbackId: {
      type: Schema.Types.ObjectId,
      ref: "Feedback",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "votes",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for vote_translated
VoteSchema.virtual("vote_translated").get(function (this: IVote) {
  return voteTranslations[this.vote] || "N/A";
});

// Keep backwards compatibility with the old virtuals
// These are no longer needed for newly created votes but help with old data
VoteSchema.virtual("device_label").get(function (this: IVote) {
  // Try to get label from the embedded device
  if (
    this.device &&
    typeof this.device === "object" &&
    "label" in this.device
  ) {
    return this.device.label;
  }
  return undefined;
});

const Vote: Model<IVote> =
  mongoose.models.Vote || mongoose.model<IVote>("Vote", VoteSchema);

export default Vote;
