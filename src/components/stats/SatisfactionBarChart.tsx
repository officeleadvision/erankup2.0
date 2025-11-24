import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { getVoteTypeDetails, VOTE_TYPE_ORDER } from "@/lib/chartUtils";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { VoteType } from "@/models/Vote";
import Loader from "@/components/ui/Loader";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface VoteSummary {
  totalVotes: number;
  votesByType: Array<{ _id: string | null; count: number }>;
  averageScore?: number | null;
  averageLabel?: string | null;
}

interface SatisfactionBarChartProps {
  summary: VoteSummary | null;
  isLoading: boolean;
}

const SatisfactionBarChart: React.FC<SatisfactionBarChartProps> = ({
  summary,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader text="Зареждане на стълбовидната диаграма..." />
      </div>
    );
  }

  const hasData = summary && summary.votesByType.some((item) => item.count > 0);

  if (!hasData) {
    return (
      <div className="h-72 md:h-96 flex items-center justify-center">
        <p className="text-gray-500">Няма данни за стълбовидната диаграма.</p>
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
        label: "Брой гласове",
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
      },
    ],
  };

  const verticalBarOptions = {
    indexAxis: "x" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Брой гласове",
        },
      },
      x: {},
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Резюме на Удовлетвореността (Брой)",
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += `${context.parsed.y}`;
            }
            return label;
          },
        },
      },
      datalabels: {
        color: "#000",
        anchor: "end" as const,
        align: "top" as const,
        font: {
          weight: "bold" as const,
        },
        formatter: (value: number) => {
          return value > 0 ? value : "";
        },
      },
    },
  };

  return <Bar data={chartData} options={verticalBarOptions} />;
};

export default SatisfactionBarChart;
