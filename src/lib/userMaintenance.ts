import User from "@/models/User";

let blockedBackfillPromise: Promise<void> | null = null;
let moderatorBackfillPromise: Promise<void> | null = null;

export async function ensureBlockedField() {
  if (!blockedBackfillPromise) {
    blockedBackfillPromise = User.updateMany(
      { blocked: { $exists: false } },
      { $set: { blocked: false } }
    )
      .then(() => undefined)
      .catch((error) => {
        console.error("Failed to backfill blocked flag", error);
        blockedBackfillPromise = null;
      });
  }

  return blockedBackfillPromise;
}

export async function ensureModeratorField() {
  if (!moderatorBackfillPromise) {
    moderatorBackfillPromise = (async () => {
      await User.updateMany(
        { moderator: { $exists: false }, godmode: true },
        { $set: { moderator: true } }
      );
      await User.updateMany(
        { moderator: { $exists: false } },
        { $set: { moderator: false } }
      );
      await User.updateMany(
        { godmode: { $exists: true } },
        { $unset: { godmode: "" } }
      );
    })().catch((error) => {
      console.error("Failed to backfill moderator flag", error);
      moderatorBackfillPromise = null;
    });
  }

  return moderatorBackfillPromise;
}

