import mongoose, { Schema, Document, Model } from "mongoose";
import { IDevice } from "./Device";
import { encrypt, decrypt } from "../lib/cryptoUtils";
import { VoteType } from "./Vote";

interface IQuestionVote {
  question?: string;
  vote?: VoteType;
}

const feedbackVoteTranslations: Record<string, string> = {
  superlike: "😄 Много доволен",
  like: "🙂 Доволен",
  neutral: "😐 Неутрален",
  dislike: "😞 Недоволен",
  superdislike: "😠 Много недоволен",
};

export interface IFeedback extends Document {
  date: Date;
  username: string;
  question: string;
  devices: mongoose.Types.ObjectId[] | IDevice[] | any[];
  questionsVote?: IQuestionVote[];
  questionsVoteToString?: string;
  vote?: VoteType;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  comment?: string | null;
  location?: string;
  device_label?: string;
  translated_vote?: string;
  linkedVoteId?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const QuestionVoteSchema = new Schema<IQuestionVote>(
  {
    question: { type: String },
    vote: { type: String },
  },
  { _id: true }
);

const FeedbackSchema: Schema<IFeedback> = new Schema(
  {
    date: { type: Date, default: Date.now, required: true },
    username: { type: String, lowercase: true, required: true },
    question: {
      type: String,
      required: true,
      default: "Доволни ли сте от обслужването?",
    },
    devices: {
      type: [Schema.Types.Mixed],
      required: true,
      default: [],
    },
    questionsVote: [QuestionVoteSchema],
    vote: {
      type: String,
      enum: ["superlike", "like", "neutral", "dislike", "superdislike"],
    },
    name: { type: String, get: decrypt, set: encrypt },
    phone: { type: String, get: decrypt, set: encrypt },
    email: { type: String, get: decrypt, set: encrypt },
    comment: { type: String, get: decrypt, set: encrypt },
    linkedVoteId: {
      type: Schema.Types.ObjectId,
      ref: "Vote",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "feedbacks",
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

FeedbackSchema.virtual("location").get(function (this: IFeedback) {
  if (this.devices && this.devices.length > 0) {
    const firstDevice = this.devices[0];

    if (
      firstDevice &&
      typeof firstDevice === "object" &&
      "location" in firstDevice
    ) {
      return firstDevice.location;
    }

    if (
      this.populated("devices") &&
      typeof firstDevice !== "string" &&
      firstDevice &&
      "location" in firstDevice
    ) {
      return firstDevice.location;
    }
  }
  return undefined;
});

FeedbackSchema.virtual("device_label").get(function (this: IFeedback) {
  if (this.devices && this.devices.length > 0) {
    const firstDevice = this.devices[0];

    if (
      firstDevice &&
      typeof firstDevice === "object" &&
      "label" in firstDevice
    ) {
      return firstDevice.label;
    }

    if (
      this.populated("devices") &&
      typeof firstDevice !== "string" &&
      firstDevice &&
      "label" in firstDevice
    ) {
      return firstDevice.label;
    }
  }
  return undefined;
});

FeedbackSchema.virtual("translated_vote").get(function (this: IFeedback) {
  if (!this.vote) return undefined;
  return feedbackVoteTranslations[this.vote] || this.vote;
});

FeedbackSchema.virtual("questionsVoteToString").get(function (this: IFeedback) {
  if (!this.questionsVote || this.questionsVote.length === 0) {
    return undefined;
  }
  return this.questionsVote
    .map((item) => {
      const translated = item.vote
        ? feedbackVoteTranslations[item.vote] || item.vote
        : "N/A";
      return `${item.question || "N/A"}: ${translated}`;
    })
    .join("\n");
});

const Feedback: Model<IFeedback> =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>("Feedback", FeedbackSchema);

export default Feedback;
