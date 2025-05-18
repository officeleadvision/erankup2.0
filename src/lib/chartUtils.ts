export const VOTE_TYPE_MAP: Record<
  string,
  { label: string; color: string; backgroundColor: string }
> = {
  "1": {
    label: "Много Доволни",
    color: "#2E7D32",
    backgroundColor: "rgba(46, 125, 50, 0.8)",
  },
  "2": {
    label: "Доволни",
    color: "#66BB6A",
    backgroundColor: "rgba(102, 187, 106, 0.8)",
  },
  "3": {
    label: "Неутрални",
    color: "#FFEE58",
    backgroundColor: "rgba(255, 238, 88, 0.8)",
  },
  "4": {
    label: "Недоволни",
    color: "#EF5350",
    backgroundColor: "rgba(239, 83, 80, 0.8)",
  },
  "5": {
    label: "Много Недоволни",
    color: "#C62828",
    backgroundColor: "rgba(198, 40, 40, 0.8)",
  },
  superlike: {
    label: "Много Доволни",
    color: "#2E7D32",
    backgroundColor: "rgba(46, 125, 50, 0.8)",
  },
  like: {
    label: "Доволни",
    color: "#66BB6A",
    backgroundColor: "rgba(102, 187, 106, 0.8)",
  },
  dislike: {
    label: "Недоволни",
    color: "#EF5350",
    backgroundColor: "rgba(239, 83, 80, 0.8)",
  },
  superdislike: {
    label: "Много Недоволни",
    color: "#C62828",
    backgroundColor: "rgba(198, 40, 40, 0.8)",
  },
};

export const getVoteTypeDetails = (voteTypeId: string | null | undefined) => {
  if (voteTypeId && VOTE_TYPE_MAP[voteTypeId]) {
    return VOTE_TYPE_MAP[voteTypeId];
  }
  return {
    label: "Неизвестен тип",
    color: "#BDBDBD",
    backgroundColor: "rgba(189, 189, 189, 0.8)",
  };
};

export const VOTE_TYPE_ORDER = ["superlike", "like", "dislike", "superdislike"];
