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

interface UnifiedVote {
  voteType: VoteType;
  score: number;
  date: Date;
  question?: string | null;
}

interface AggregationFilters {
  username: string;
  startDate?: Date;
  endDate?: Date;
}

interface FeedbackQuestionVote {
  question?: string | null;
  vote?: VoteType | null;
}

interface FeedbackLean {
  date: Date;
  vote?: VoteType | null;
  questionsVote?: Array<FeedbackQuestionVote | null> | null;
  question?: string | null;
  username?: string | null;
  _id?: unknown;
}

const normalizeUsername = (username?: string | null) =>
  (username || "").toLowerCase();

/**
 * Extract individual question+vote items from a feedback entry.
 * If questionsVote array exists, each item becomes a separate vote.
 * Otherwise, falls back to the single question/vote on the entry.
 * This matches the export logic exactly.
 */
const extractQuestionVoteItemsFromFeedback = (
  feedback: FeedbackLean
): Array<{ question?: string | null; vote?: VoteType | null }> => {
  if (
    Array.isArray(feedback.questionsVote) &&
    feedback.questionsVote.length > 0
  ) {
    return feedback.questionsVote.map((item) => ({
      question: item?.question,
      vote: item?.vote as VoteType | null | undefined,
    }));
  }

  return [
    {
      question: feedback.question,
      vote: feedback.vote,
    },
  ];
};

/**
 * Get unified votes from the Feedback collection only.
 * For each feedback entry, each question in questionsVote becomes a separate vote.
 * This matches the export route logic so dashboard counts equal export row counts.
 */
export async function getUnifiedVotes(
  filters: AggregationFilters
): Promise<UnifiedVote[]> {
  const normalizedUsername = normalizeUsername(filters.username);

  const matchQuery: Record<string, any> = { username: normalizedUsername };
  const dateFilter: Record<string, Date> = {};

  if (filters.startDate) {
    dateFilter.$gte = filters.startDate;
  }
  if (filters.endDate) {
    dateFilter.$lte = filters.endDate;
  }

  if (Object.keys(dateFilter).length > 0) {
    matchQuery.date = dateFilter;
  }

  const feedbackEntries = await Feedback.find(matchQuery)
    .select("date vote questionsVote question username")
    .sort({ date: 1 })
    .lean<FeedbackLean[]>();

  const unifiedVotes: UnifiedVote[] = [];

  feedbackEntries.forEach((feedback) => {
    const questionVoteItems = extractQuestionVoteItemsFromFeedback(feedback);

    questionVoteItems.forEach((item) => {
      if (!item.vote || voteScoreMap[item.vote] === undefined) return;

      const score = voteScoreMap[item.vote as VoteType];

      unifiedVotes.push({
        voteType: item.vote,
        score,
        date: feedback.date,
        question: item.question ?? feedback.question ?? null,
      });
    });
  });

  return unifiedVotes;
}
