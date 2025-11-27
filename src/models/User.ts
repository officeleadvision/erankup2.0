import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  username: string;
  user?: string;
  moderator?: boolean;
  admin?: boolean;
  blocked?: boolean;
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;
  authenticate(password: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    username: { type: String, lowercase: true, required: true, unique: true },
    user: { type: String, lowercase: true, index: true },
    password: { type: String, required: true, select: false },
    moderator: { type: Boolean, default: false },
    admin: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false, required: true },
  },
  { timestamps: true, collection: "users" }
);

UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

UserSchema.pre<IUser>("save", function (next) {
  if (!this.user) {
    this.user = this.username;
  }
  next();
});

UserSchema.methods.authenticate = async function (
  password: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
