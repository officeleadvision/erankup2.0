"use client";

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { getVoteTypeDetails } from "@/lib/chartUtils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartDataLabels
);

interface VoteTimelinePointFE {
  timePeriod: { year: number; month: number; day?: number; hour?: number };
  totalCount: number;
  byType?: Record<string, number>;
}

interface VoteTimelineChartProps {
  timelineData: VoteTimelinePointFE[];
  groupBy: "day" | "hour" | "month" | "week";
  /** Vote types to overlay as lines (empty = totals only). */
  selectedTypes?: string[];
  /** Show the totals columns. */
  showTotals?: boolean;
}

const VoteTimelineChart: React.FC<VoteTimelineChartProps> = ({
  timelineData,
  groupBy,
  selectedTypes = [],
  showTotals = true,
}) => {
  // The API buckets by wall-clock components in the browser's own timezone
  // (we send it along), so build LOCAL dates here: the axis then shows the
  // same day/hour the bucket was computed for, with no UTC shift.
  const labels = timelineData.map((point) => {
    const { year, month, day, hour } = point.timePeriod;
    if (groupBy === "hour" && day !== undefined && hour !== undefined) {
      return new Date(year, month - 1, day, hour);
    }
    if (groupBy === "month") {
      return new Date(year, month - 1, 1);
    }
    return new Date(year, month - 1, day ?? 1);
  });

  const totals = timelineData.map((point) => point.totalCount);
  const maxCount = Math.max(...totals, 0);
  const yMax = maxCount > 0 ? Math.ceil(maxCount * 1.25) : 10;

  const data: ChartData<"bar" | "line", number[], Date> = {
    labels,
    datasets: [
      ...(showTotals
        ? [
            {
              type: "bar" as const,
              label: "Общо",
              data: totals,
              backgroundColor: "rgba(20, 184, 166, 0.35)",
              borderColor: "rgb(13, 148, 136)",
              borderWidth: 1,
              borderRadius: 4,
              order: 2,
              datalabels: {
                display: true,
                color: "#0f172a",
                anchor: "end" as const,
                align: "top" as const,
                offset: 2,
                font: { weight: "bold" as const, size: 11 },
                formatter: (value: number) => (value > 0 ? value : ""),
              },
            },
          ]
        : []),
      ...selectedTypes.map((type) => {
        const details = getVoteTypeDetails(type);
        return {
          type: "line" as const,
          label: details.label,
          data: timelineData.map((point) => point.byType?.[type] ?? 0),
          borderColor: details.color,
          backgroundColor: details.color,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false,
          order: 1,
          datalabels: { display: false },
        };
      }),
    ],
  };

  let timeUnit: "day" | "hour" | "month" | "week" = "day";
  let tooltipFmt = "dd.MM.yyyy";
  let displayFmt: Record<string, string> = { day: "dd.MM" };

  switch (groupBy) {
    case "hour":
      timeUnit = "hour";
      tooltipFmt = "dd.MM.yyyy HH:mm";
      displayFmt = { hour: "HH:mm", day: "dd.MM" };
      break;
    case "day":
      timeUnit = "day";
      displayFmt = { day: "dd.MM" };
      break;
    case "week":
      timeUnit = "week";
      displayFmt = { week: "dd.MM" };
      break;
    case "month":
      timeUnit = "month";
      tooltipFmt = "MMMM yyyy";
      displayFmt = { month: "MMM yyyy" };
      break;
  }

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: selectedTypes.length > 0 || !showTotals,
        position: "bottom",
        labels: { usePointStyle: true, boxWidth: 8 },
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          footer: (items) => {
            const total = items.find((i) => i.dataset.type === "bar");
            return total ? `Общо: ${total.parsed.y}` : "";
          },
        },
      },
    },
    scales: {
      x: {
        type: "time" as const,
        offset: true,
        time: {
          unit: timeUnit,
          tooltipFormat: tooltipFmt,
          displayFormats: displayFmt,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        max: yMax,
        ticks: { precision: 0 },
      },
    },
  };

  return <Chart type="bar" options={options} data={data} />;
};

export default VoteTimelineChart;
