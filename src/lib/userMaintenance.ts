import User from "@/models/User";

let blockedBackfillPromise: Promise<void> | null = null;

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

