import React from "react";
import { getVoteTypeDetails, VOTE_TYPE_ORDER } from "@/lib/chartUtils";
import Loader from "@/components/ui/Loader";

interface VoteSummary {
  totalVotes: number;
  votesByType: Array<{ _id: string | null; count: number }>;
  averageScore?: number | null;
  averageLabel?: string | null;
}

interface SummaryCardsProps {
  summary: VoteSummary | null;
  isLoading: boolean;
}

const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  percentage?: string;
  bgColorClass: string;
  textColorClass?: string;
  style?: React.CSSProperties;
}> = ({
  title,
  value,
  percentage,
  bgColorClass,
  textColorClass = "text-white",
  style = {},
}) => {
  return (
    <div
      className={`p-4 md:p-6 rounded-lg shadow-lg ${bgColorClass} ${textColorClass}`}
      style={style}
    >
      <h3 className="text-sm md:text-md font-semibold text-gray-200">
        {title}
      </h3>
      <p className="text-2xl md:text-3xl font-bold">{value}</p>
      {percentage && (
        <p className="text-xs md:text-sm text-gray-100">{percentage}</p>
      )}
    </div>
  );
};

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-white overflow-hidden shadow rounded-lg p-5 h-36 flex items-center justify-center"
          >
            <Loader size="sm" text="Зареждане..." />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="col-span-full text-center py-10 mb-6">
        <p className="text-gray-500">
          Няма обобщени данни за показване на картите.
        </p>
      </div>
    );
  }

  const totalVotesCard = summary.totalVotes;
  const averageScore =
    typeof summary.averageScore === "number" && !isNaN(summary.averageScore)
      ? summary.averageScore
      : null;
  const averageScoreDisplay =
    averageScore !== null ? averageScore.toFixed(2) : "—";
  const averageLabel = summary.averageLabel || undefined;
  const votesMap = new Map(
    summary.votesByType.map((item) => [item._id, item.count])
  );

  const cardsData = VOTE_TYPE_ORDER.map((voteTypeId) => {
    const details = getVoteTypeDetails(voteTypeId);
    const count = votesMap.get(voteTypeId) || 0;
    const percentage =
      summary.totalVotes > 0
        ? ((count / summary.totalVotes) * 100).toFixed(0)
        : "0";
    return {
      id: voteTypeId,
      title: details.label,
      value: count,
      percentage: `${percentage}%`,
      bgColorClass: details.color.startsWith("#") ? "" : details.color,
      style: details.color.startsWith("#")
        ? { backgroundColor: details.backgroundColor }
        : {},
      textColorClass:
        details.color === "#FFEE58" ? "text-gray-800" : "text-white",
    };
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
      <SummaryCard
        title="Общо гласове"
        value={totalVotesCard}
        bgColorClass="bg-blue-500"
      />
      <SummaryCard
        title="Средно усещане"
        value={averageScoreDisplay}
        percentage={averageLabel}
        bgColorClass="bg-indigo-500"
      />
      {cardsData.map((card) => (
        <SummaryCard
          key={card.id}
          title={card.title}
          value={card.value}
          percentage={card.percentage}
          bgColorClass={card.bgColorClass}
          textColorClass={card.textColorClass}
          style={card.style}
        />
      ))}
    </div>
  );
};

export default SummaryCards;
