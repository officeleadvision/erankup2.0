import Feedback from "@/models/Feedback";
import Vote, { VoteType } from "@/models/Vote";

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

interface FeedbackCandidate {
  date: Date;
  voteType: VoteType;
  averageScore: number;
  originalVote?: VoteType;
  question?: string | null;
}

interface FeedbackQuestionVote {
  question?: string | null;
  vote?: VoteType | null;
}

interface FeedbackLean {
  date: Date;
  vote?: VoteType | null;
  questionsVote?: Array<FeedbackQuestionVote | null> | null;
  linkedVoteId?: unknown;
  devices?: Array<Record<string, any>> | null;
  question?: string | null;
  username?: string | null;
  _id?: unknown;
}

interface VoteLean {
  date: Date;
  vote: VoteType;
  question?: string | null;
  device?: Record<string, any> | null;
  feedbackId?: unknown;
  username?: string | null;
}

const DUPLICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const scoreToVoteType = (avg: number): VoteType => {
  if (avg >= 4.5) return "superlike";
  if (avg >= 3.5) return "like";
  if (avg >= 2.5) return "neutral";
  if (avg >= 1.5) return "dislike";
  return "superdislike";
};

const normalizeUsername = (username?: string | null) =>
  (username || "").toLowerCase();

const getDeviceTokenFromFeedback = (feedback: FeedbackLean) => {
  const devices = Array.isArray(feedback.devices) ? feedback.devices : [];
  if (devices.length === 0) return undefined;
  const primaryDevice = devices[0];
  if (
    primaryDevice &&
    typeof primaryDevice === "object" &&
    "token" in primaryDevice
  ) {
    return primaryDevice.token as string | undefined;
  }
  return undefined;
};

const getDeviceTokenFromVote = (vote: VoteLean) => {
  const device = vote.device;
  if (device && typeof device === "object" && "token" in device) {
    return device.token as string | undefined;
  }
  return undefined;
};

const buildDedupeKey = (username?: string | null, token?: string) =>
  `${normalizeUsername(username)}::${token || ""}`;

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

  const [feedbackEntries, voteEntries] = await Promise.all([
    Feedback.find(matchQuery)
      .select("date vote questionsVote linkedVoteId devices question username")
      .sort({ date: 1 })
      .lean<FeedbackLean[]>(),
    Vote.find(matchQuery)
      .select("date vote question device feedbackId username")
      .sort({ date: 1 })
      .lean<VoteLean[]>(),
  ]);

  const feedbackById = new Map<string, FeedbackLean>();
  feedbackEntries.forEach((fb) => {
    if (fb?._id) {
      feedbackById.set(String(fb._id), fb);
    }
  });

  const unifiedVotes: UnifiedVote[] = [];
  const dedupeMap = new Map<string, FeedbackCandidate[]>();

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

      const deviceToken = getDeviceTokenFromFeedback(feedback);
      const dedupeKey = buildDedupeKey(feedback.username, deviceToken);
      const existingCandidates = dedupeMap.get(dedupeKey) || [];

      existingCandidates.push({
        date: feedback.date,
        voteType: item.vote,
        averageScore: score,
        originalVote: (feedback.vote as VoteType | undefined) || undefined,
        question: item.question ?? feedback.question ?? null,
      });

      dedupeMap.set(dedupeKey, existingCandidates);
    });
  });

  voteEntries.forEach((vote) => {
    // If vote is linked to feedback, prefer the feedback's question votes (already handled).
    if (vote.feedbackId) {
      const feedback = feedbackById.get(String(vote.feedbackId));
      if (!feedback) {
        return;
      }
      const questionVoteItems = extractQuestionVoteItemsFromFeedback(feedback);
      questionVoteItems.forEach((item) => {
        if (!item.vote || voteScoreMap[item.vote] === undefined) return;

        const deviceToken = getDeviceTokenFromVote(vote);
        const dedupeKey = buildDedupeKey(vote.username, deviceToken);
        const potentialMatches = dedupeMap.get(dedupeKey) || [];

        const voteScore = voteScoreMap[item.vote];
        const voteDate = new Date(vote.date);

        const hasDuplicate = potentialMatches.some((candidate) => {
          const candidateDate = new Date(candidate.date);
          const timeDiff = Math.abs(
            candidateDate.getTime() - voteDate.getTime()
          );
          if (timeDiff > DUPLICATION_WINDOW_MS) {
            return false;
          }

          const questionMatches =
            !item.question ||
            !candidate.question ||
            item.question === candidate.question;
          if (!questionMatches) {
            return false;
          }

          const originalVoteMatches = candidate.originalVote === item.vote;
          const scoreCloseEnough =
            Math.abs(candidate.averageScore - voteScore) <= 0.51;

          return originalVoteMatches || scoreCloseEnough;
        });

        if (hasDuplicate) {
          return;
        }

        unifiedVotes.push({
          voteType: item.vote,
          score: voteScore,
          date: vote.date,
          question: item.question ?? feedback.question ?? null,
        });
      });
      return;
    }

    const deviceToken = getDeviceTokenFromVote(vote);
    const dedupeKey = buildDedupeKey(vote.username, deviceToken);
    const potentialMatches = dedupeMap.get(dedupeKey) || [];

    const voteScore = voteScoreMap[vote.vote];
    const voteDate = new Date(vote.date);

    const hasDuplicate = potentialMatches.some((candidate) => {
      const candidateDate = new Date(candidate.date);
      const timeDiff = Math.abs(candidateDate.getTime() - voteDate.getTime());
      if (timeDiff > DUPLICATION_WINDOW_MS) {
        return false;
      }

      const questionMatches =
        !vote.question ||
        !candidate.question ||
        vote.question === candidate.question;
      if (!questionMatches) {
        return false;
      }

      const originalVoteMatches = candidate.originalVote === vote.vote;
      const scoreCloseEnough =
        Math.abs(candidate.averageScore - voteScore) <= 0.51;

      return originalVoteMatches || scoreCloseEnough;
    });

    if (hasDuplicate) {
      return;
    }

    unifiedVotes.push({
      voteType: vote.vote,
      score: voteScore,
      date: vote.date,
      question: vote.question ?? null,
    });
  });

  return unifiedVotes;
}
