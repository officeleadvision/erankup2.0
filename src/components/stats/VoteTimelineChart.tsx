"use client";

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  CategoryScale,
  LinearScale,
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
}

interface VoteTimelineChartProps {
  timelineData: VoteTimelinePointFE[];
  groupBy: "day" | "hour" | "month" | "week";
}

const VoteTimelineChart: React.FC<VoteTimelineChartProps> = ({
  timelineData,
  groupBy,
}) => {
  const labels = timelineData.map((point) => {
    const { year, month, day, hour } = point.timePeriod;

    if (groupBy === "hour" && day !== undefined && hour !== undefined) {
      return new Date(year, month - 1, day, hour).toISOString();
    } else if ((groupBy === "day" || groupBy === "week") && day !== undefined) {
      return new Date(year, month - 1, day).toISOString();
    } else if (groupBy === "month") {
      return new Date(year, month - 1, 1).toISOString();
    }
    return new Date(year, month - 1, day || 1).toISOString();
  });

  const dataPoints = timelineData.map((point) => point.totalCount);

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Общ брой гласове",
        data: dataPoints,
        fill: true,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.4,
      },
    ],
  };

  let timeUnit: "day" | "hour" | "month" | "week" = "day";
  let tooltipFmt = "dd.MM.yyyy";
  let displayFmt = { day: "dd.MM" };

  switch (groupBy) {
    case "hour":
      timeUnit = "hour";
      tooltipFmt = "dd.MM.yyyy HH:mm";
      displayFmt = { hour: "HH:mm", ...displayFmt } as any;
      break;
    case "day":
      timeUnit = "day";
      break;
    case "week":
      timeUnit = "week";
      tooltipFmt = "dd.MM.yyyy";
      displayFmt = { week: "dd.MM", ...displayFmt } as any;
      break;
    case "month":
      timeUnit = "month";
      tooltipFmt = "MM.yyyy";
      displayFmt = { month: "MM.yyyy", ...displayFmt } as any;
      break;
  }

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      datalabels: {
        color: "#000",
        anchor: "end" as const,
        align: "top" as const,
        offset: 5,
        font: {
          weight: "bold" as const,
          size: 11,
        },
        formatter: (value: number) => {
          return value > 0 ? value : "";
        },
      },
    },
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit: timeUnit,
          tooltipFormat: tooltipFmt,
          displayFormats: displayFmt,
        },
        title: {
          display: false,
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: false,
        },
        ticks: {},
      },
    },
  };

  return <Line options={options} data={data} />;
};

export default VoteTimelineChart;
