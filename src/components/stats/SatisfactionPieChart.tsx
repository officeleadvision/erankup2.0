import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import { getVoteTypeDetails, VOTE_TYPE_ORDER } from "@/lib/chartUtils";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { VoteType } from "@/models/Vote";
import Loader from "@/components/ui/Loader";

ChartJS.register(ArcElement, Tooltip, Legend, Title, ChartDataLabels);

interface VoteSummary {
  totalVotes: number;
  votesByType: Array<{ _id: string | null; count: number }>;
}

interface SatisfactionPieChartProps {
  summary: VoteSummary | null;
  isLoading: boolean;
}

const SatisfactionPieChart: React.FC<SatisfactionPieChartProps> = ({
  summary,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader text="Зареждане на кръговата диаграма..." />
      </div>
    );
  }

  const hasData = summary && summary.votesByType.some((item) => item.count > 0);

  if (!hasData) {
    return (
      <div className="h-72 md:h-96 flex items-center justify-center">
        <p className="text-gray-500">Няма данни за кръговата диаграма.</p>
      </div>
    );
  }

  if (!summary) return null;

  const votesMap = new Map(
    summary.votesByType.map((item) => [item._id, item.count])
  );

  const labels = VOTE_TYPE_ORDER.map(
    (voteTypeId) => getVoteTypeDetails(voteTypeId).label
  );
  const dataValues = VOTE_TYPE_ORDER.map(
    (voteTypeId) => votesMap.get(voteTypeId) || 0
  );
  const backgroundColors = VOTE_TYPE_ORDER.map(
    (voteTypeId) => getVoteTypeDetails(voteTypeId).backgroundColor
  );
  const borderColors = VOTE_TYPE_ORDER.map(
    (voteTypeId) => getVoteTypeDetails(voteTypeId).color
  );

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Разпределение на гласовете",
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          font: {
            size: 14,
          },
          padding: 15,
        },
      },
      title: {
        display: true,
        text: "Разпределение на Удовлетвореността (Дял)",
        font: {
          size: 18,
          weight: "bold" as const,
        },
        padding: {
          bottom: 15,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed !== null) {
              const total = context.dataset.data.reduce(
                (acc: number, val: number) => acc + val,
                0
              );
              const percentage =
                total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
              label += `${context.raw} (${percentage}%)`;
            }
            return label;
          },
        },
      },
      datalabels: {
        color: "#fff",
        font: {
          weight: "bold" as const,
          size: 14,
        },
        formatter: (value: number, context: any) => {
          const total = context.dataset.data.reduce(
            (acc: number, val: number) => acc + val,
            0
          );
          const percentageString =
            total > 0 ? ((value / total) * 100).toFixed(0) : "0";
          return value > 0 && parseFloat(percentageString) > 0
            ? `${percentageString}%`
            : "";
        },
      },
    },
  };

  return <Pie data={chartData} options={options} />;
};

export default SatisfactionPieChart;
