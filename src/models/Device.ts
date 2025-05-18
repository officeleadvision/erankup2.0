import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDevice extends Document {
  dateOfPlacement: Date;
  owner: string;
  location: string;
  token: string;
  label?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const DeviceSchema: Schema<IDevice> = new Schema(
  {
    dateOfPlacement: { type: Date, default: Date.now, required: true },
    owner: { type: String, lowercase: true, required: true },
    location: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    label: { type: String },
  },
  { timestamps: true, collection: "devices" }
);

const Device: Model<IDevice> =
  mongoose.models.Device || mongoose.model<IDevice>("Device", DeviceSchema);

export default Device;
