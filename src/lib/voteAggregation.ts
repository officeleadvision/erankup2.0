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

interface FeedbackLean {
  date: Date;
  vote?: VoteType | null;
  questionsVote?: Array<{ vote?: VoteType | null } | null> | null;
  linkedVoteId?: unknown;
  devices?: Array<Record<string, any>> | null;
  question?: string | null;
  username?: string | null;
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
  if (primaryDevice && typeof primaryDevice === "object" && "token" in primaryDevice) {
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

const extractScoresFromFeedback = (feedback: FeedbackLean): number[] => {
  const questionVotes = Array.isArray(feedback.questionsVote)
    ? feedback.questionsVote
        .map((item) => item?.vote)
        .filter((vote): vote is VoteType => !!vote && voteScoreMap[vote] !== undefined)
    : [];

  if (questionVotes.length > 0) {
    return questionVotes.map((vote) => voteScoreMap[vote]);
  }

  if (feedback.vote && voteScoreMap[feedback.vote] !== undefined) {
    return [voteScoreMap[feedback.vote]];
  }

  return [];
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
      .lean<FeedbackLean>(),
    Vote.find(matchQuery)
      .select("date vote question device feedbackId username")
      .sort({ date: 1 })
      .lean<VoteLean>(),
  ]);

  const unifiedVotes: UnifiedVote[] = [];
  const dedupeMap = new Map<string, FeedbackCandidate[]>();

  feedbackEntries.forEach((feedback) => {
    const scores = extractScoresFromFeedback(feedback);
    if (scores.length === 0) {
      return;
    }

    const averageScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const derivedVoteType = scoreToVoteType(averageScore);

    unifiedVotes.push({
      voteType: derivedVoteType,
      score: averageScore,
      date: feedback.date,
    });

    const deviceToken = getDeviceTokenFromFeedback(feedback);
    const dedupeKey = buildDedupeKey(feedback.username, deviceToken);
    const existingCandidates = dedupeMap.get(dedupeKey) || [];

    existingCandidates.push({
      date: feedback.date,
      voteType: derivedVoteType,
      averageScore,
      originalVote: (feedback.vote as VoteType | undefined) || undefined,
      question: feedback.question,
    });

    dedupeMap.set(dedupeKey, existingCandidates);
  });

  voteEntries.forEach((vote) => {
    if (vote.feedbackId) {
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
        !vote.question || !candidate.question || vote.question === candidate.question;
      if (!questionMatches) {
        return false;
      }

      const originalVoteMatches = candidate.originalVote === vote.vote;
      const scoreCloseEnough = Math.abs(candidate.averageScore - voteScore) <= 0.51;

      return originalVoteMatches || scoreCloseEnough;
    });

    if (hasDuplicate) {
      return;
    }

    unifiedVotes.push({
      voteType: vote.vote,
      score: voteScore,
      date: vote.date,
    });
  });

  return unifiedVotes;
}
