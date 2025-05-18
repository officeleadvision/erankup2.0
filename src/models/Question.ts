import mongoose, { Schema, Document, Model } from "mongoose";
import { IDevice } from "./Device";

export interface IQuestion extends Document {
  date: Date;
  order: number;
  hidden: boolean;
  username: string;
  question: string;
  devices: mongoose.Types.ObjectId[] | IDevice[];
  createdAt?: Date;
  updatedAt?: Date;
}

const QuestionSchema: Schema<IQuestion> = new Schema(
  {
    date: { type: Date, default: Date.now, required: true },
    order: { type: Number, required: true, default: 0 },
    hidden: { type: Boolean, required: true, default: false },
    username: { type: String, lowercase: true, required: true },
    question: {
      type: String,
      required: true,
      default: "Доволни ли сте от обслужването?",
    },
    devices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Device" }],
  },
  { timestamps: true, collection: "questions" }
);

const Question: Model<IQuestion> =
  mongoose.models.Question ||
  mongoose.model<IQuestion>("Question", QuestionSchema);

export default Question;
