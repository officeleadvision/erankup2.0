import Feedback from "@/models/Feedback";
import { VoteType } from "@/models/Vote";

export const allowedVotes: VoteType[] = [
  "superlike",
  "like",
  "neutral",
  "dislike",
  "superdislike",
];

export const voteScoreMap: Record<VoteType, number> = {
  superdislike: 1,
  dislike: 2,
  neutral: 3,
  like: 4,
  superlike: 5,
};

/**
 * Case-insensitive collation used for every `username` match. Legacy records
 * were written through the raw driver (bypassing the schema's `lowercase:
 * true`), so the stored value may have mixed case.
 */
export const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 } as const;

/**
 * `feedbacks` is the ONLY source of truth for statistics and exports.
 *
 * Do not "improve" this by also counting documents from the `votes`
 * collection. `votes` is the raw tap log written by `POST /api/vote`, and it is
 * full of duplicates of the very same answer:
 *
 *  - rapid-fire taps — hotel_botevgrad has six `superlike` votes stamped
 *    within three seconds on one device (10:51:35 → 10:51:38);
 *  - re-submissions — the tablet posts the vote first and the feedback session
 *    afterwards, so a failed/retried submit leaves an extra `votes` document
 *    behind (varna-os: 1178 votes vs 1146 feedback sessions, and every one of
 *    the 32 extras sits within minutes of a real session on the same device).
 *
 * Merging the two collections was measured to inflate varna-os 2026 traffic
 * from 1956 to 1985 votes; the account owner confirmed the feedback-only
 * figures are the correct ones. A feedback session holds every answer of the
 * session in `questionsVote`, which both the dashboard and the export expand
 * into one row per answer.
 */
export interface UnifiedVote {
  voteType: VoteType;
  score: number;
  date: Date;
  question?: string | null;
}

export interface AggregationFilters {
  username: string;
  startDate?: Date;
  endDate?: Date;
}

interface FeedbackQuestionVote {
  question?: string | null;
  vote?: VoteType | string | null;
}

interface FeedbackLean {
  date: Date;
  vote?: VoteType | string | null;
  questionsVote?: Array<FeedbackQuestionVote | null> | null;
  question?: string | null;
  username?: string | null;
  _id?: unknown;
}

const normalizeUsername = (username?: string | null) =>
  (username || "").trim().toLowerCase();

const normalizeVote = (value: unknown): VoteType | null => {
  if (typeof value !== "string") return null;
  const lowered = value.toLowerCase();
  return lowered in voteScoreMap ? (lowered as VoteType) : null;
};

/**
 * Extract individual question+vote items from a feedback entry.
 * If questionsVote array exists, each item becomes a separate vote.
 * Otherwise, falls back to the single question/vote on the entry.
 * This matches the export logic exactly.
 */
export const extractQuestionVoteItemsFromFeedback = (
  feedback: FeedbackLean
): Array<{ question?: string | null; vote?: string | null }> => {
  if (
    Array.isArray(feedback.questionsVote) &&
    feedback.questionsVote.length > 0
  ) {
    return feedback.questionsVote.map((item) => ({
      question: item?.question,
      vote: item?.vote as string | null | undefined,
    }));
  }

  return [
    {
      question: feedback.question,
      vote: feedback.vote as string | null | undefined,
    },
  ];
};

/**
 * Build the mongo filter used by the dashboard statistics and the exports, so
 * that both always operate on exactly the same set of documents.
 */
export function buildFeedbackMatchQuery(filters: AggregationFilters) {
  const matchQuery: { username: string; date?: { $gte?: Date; $lte?: Date } } =
    { username: normalizeUsername(filters.username) };

  if (filters.startDate || filters.endDate) {
    matchQuery.date = {};
    if (filters.startDate) matchQuery.date.$gte = filters.startDate;
    if (filters.endDate) matchQuery.date.$lte = filters.endDate;
  }

  return matchQuery;
}

/**
 * Newest feedback session for the account, ignoring any date filter, so an
 * empty period can explain itself. Deliberately reads the same collection the
 * charts read — otherwise the hint could point at a date the chart can never
 * show.
 */
export async function getLastVoteDate(username: string): Promise<Date | null> {
  const feedback = await Feedback.findOne({
    username: normalizeUsername(username),
  })
    .collation(CASE_INSENSITIVE_COLLATION)
    .select("date")
    .sort({ date: -1 })
    .lean<{ date?: Date } | null>();

  return feedback?.date ? new Date(feedback.date) : null;
}

/**
 * Every individual answer for the account in the range: one entry per question
 * answered in a feedback session. The exports build their rows from the same
 * query, so dashboard counts equal export row counts.
 */
export async function getUnifiedVotes(
  filters: AggregationFilters
): Promise<UnifiedVote[]> {
  const feedbackEntries = await Feedback.find(buildFeedbackMatchQuery(filters))
    .collation(CASE_INSENSITIVE_COLLATION)
    .select("date vote questionsVote question username")
    .sort({ date: 1 })
    .lean<FeedbackLean[]>();

  const unifiedVotes: UnifiedVote[] = [];

  feedbackEntries.forEach((feedback) => {
    extractQuestionVoteItemsFromFeedback(feedback).forEach((item) => {
      const voteType = normalizeVote(item.vote);
      if (!voteType) return;

      unifiedVotes.push({
        voteType,
        score: voteScoreMap[voteType],
        date: feedback.date,
        question: item.question ?? feedback.question ?? null,
      });
    });
  });

  return unifiedVotes;
}
