"use client";

import React, { useEffect, useState, FormEvent } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import VoteTimelineChart from "@/components/stats/VoteTimelineChart";
import SummaryCards from "@/components/stats/SummaryCards";
import SatisfactionPieChart from "@/components/stats/SatisfactionPieChart";
import SatisfactionBarChart from "@/components/stats/SatisfactionBarChart";
import { getVoteTypeDetails } from "@/lib/chartUtils";
import { formatDateBG } from "@/lib/formatDateBG";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";

interface VoteSummary {
  totalVotes: number;
  votesByType: Array<{ _id: string | null; count: number }>;
}

interface VoteTimelinePoint {
  timePeriod: { year: number; month: number; day?: number; hour?: number };
  totalCount: number;
}

interface VoteTimelineData {
  timeline: VoteTimelinePoint[];
  success?: boolean;
}

function StatsPageContent() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<VoteSummary | null>(null);
  const [timelineData, setTimelineData] = useState<VoteTimelineData | null>(
    null
  );
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);

  const today = new Date();
  const defaultEndDate = today.toISOString().split("T")[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6);
  const defaultStartDate = sevenDaysAgo.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [activePeriod, setActivePeriod] = useState("week");
  const [timelineGroupBy, setTimelineGroupBy] = useState("day");

  const fetchVoteSummary = async () => {
    if (!token) return;
    setIsLoadingSummary(true);
    try {
      const summaryParams = new URLSearchParams({
        startDate,
        endDate,
      }).toString();
      const summaryData = await apiClient<VoteSummary>(
        `/stats/votes/summary?${summaryParams}`,
        {
          token,
        }
      );
      setSummary(summaryData);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to fetch period-filtered vote summary.";
      toast.error(errorMessage);
      setSummary(null);
    }
    setIsLoadingSummary(false);
  };

  const fetchVoteTimeline = async () => {
    if (!token) return;
    setIsLoadingTimeline(true);
    try {
      const isOneDayRange = startDate === endDate;

      let effectiveGroupBy = timelineGroupBy;
      if (timelineGroupBy === "hour" && !isOneDayRange) {
        effectiveGroupBy = "day";
      }

      const timelineParamsObj: Record<string, string> = {
        startDate,
        endDate,
        groupBy: effectiveGroupBy,
      };

      const timelineParams = new URLSearchParams(timelineParamsObj).toString();
      const data = await apiClient<VoteTimelineData>(
        `/stats/votes/timeline?${timelineParams}`,
        { token }
      );
      setTimelineData(data);
    } catch (err) {
      if (timelineGroupBy === "hour") {
        const hourErrorMessage =
          "Почасово групиране е възможно само за еднодневен период.";
        toast.warn(hourErrorMessage);
        setTimelineGroupBy("day");
        const fallbackParams = new URLSearchParams({
          startDate,
          endDate,
          groupBy: "day",
        }).toString();

        try {
          const fallbackData = await apiClient<VoteTimelineData>(
            `/stats/votes/timeline?${fallbackParams}`,
            { token }
          );
          setTimelineData(fallbackData);
        } catch {
          const fallbackErrorMessage =
            "Грешка при извличане на данни за графиката (резервен вариант).";
          toast.error(fallbackErrorMessage);
          setTimelineData(null);
        }
      } else {
        const generalErrorMessage =
          "Грешка при извличане на данни за графиката.";
        toast.error(generalErrorMessage);
        setTimelineData(null);
      }
    }
    setIsLoadingTimeline(false);
  };

  useEffect(() => {
    if (token) {
      fetchVoteSummary();
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    if (token) {
      fetchVoteTimeline();
    }
  }, [startDate, endDate, timelineGroupBy, token]);

  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
    let newStartDate = new Date();
    let newEndDate = new Date();
    let newGroupBy = "day";

    newEndDate.setHours(23, 59, 59, 999);

    switch (period) {
      case "all":
        newStartDate = new Date(2000, 0, 1);
        newStartDate.setHours(0, 0, 0, 0);
        newGroupBy = "month";
        break;
      case "day":
        newStartDate.setHours(0, 0, 0, 0);
        newEndDate = new Date(newStartDate);
        newEndDate.setHours(23, 59, 59, 999);
        newGroupBy = "hour";
        break;
      case "week":
        newStartDate.setDate(newEndDate.getDate() - 6);
        newStartDate.setHours(0, 0, 0, 0);
        newGroupBy = "day";
        break;
      case "month":
        newStartDate.setDate(1);
        newStartDate.setHours(0, 0, 0, 0);
        newGroupBy = "day";
        break;
      case "year":
        newStartDate.setMonth(0, 1);
        newStartDate.setHours(0, 0, 0, 0);
        newGroupBy = "month";
        break;
      default:
        newStartDate.setDate(newEndDate.getDate() - 6);
        newStartDate.setHours(0, 0, 0, 0);
        newGroupBy = "day";
    }

    setStartDate(newStartDate.toISOString().split("T")[0]);
    setEndDate(newEndDate.toISOString().split("T")[0]);
    setTimelineGroupBy(newGroupBy);
  };

  const handleCustomDateFilterSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActivePeriod("custom");
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Началната дата не може да бъде след крайната дата.");
      return;
    }
    fetchVoteSummary();
    fetchVoteTimeline();
  };

  const voteTypeDetails = summary?.votesByType.map((item) =>
    getVoteTypeDetails(item._id)
  );

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">
        Статистики за гласуванията
      </h2>

      <SummaryCards summary={summary} isLoading={isLoadingSummary} />

      <form
        onSubmit={handleCustomDateFilterSubmit}
        className="mb-8 p-4 bg-white shadow-md rounded-lg flex flex-col sm:flex-row gap-4 items-center"
      >
        <div className="flex-1 w-full sm:w-auto">
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Начална дата:
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex-1 w-full sm:w-auto">
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Крайна дата:
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="w-full sm:w-auto mt-2 sm:mt-0 self-end sm:self-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Филтрирай
        </button>
      </form>

      <div className="mb-8 p-4 bg-white shadow-md rounded-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-700">
              Активност (Трафик)
            </h3>
            <p className="text-sm text-slate-500">
              Показване на данни от{" "}
              <span className="text-slate-800 font-medium">
                {new Date(startDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>{" "}
              до{" "}
              <span className="text-slate-800 font-medium">
                {new Date(endDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap gap-1">
            {(["day", "week", "month", "year", "all"] as const).map(
              (period) => (
                <button
                  key={period}
                  onClick={() => handlePeriodChange(period)}
                  className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium rounded-md transition-colors
                    ${
                      activePeriod === period
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                >
                  {period === "day" && "Днес"}
                  {period === "week" && "Седмица"}
                  {period === "month" && "Месец"}
                  {period === "year" && "Година"}
                  {period === "all" && "Всички времена"}
                </button>
              )
            )}
          </div>
        </div>
        {isLoadingTimeline ? (
          <div className="text-center py-10 text-slate-600 h-96 flex items-center justify-center">
            <Loader text="Зареждане на данни..." />
          </div>
        ) : timelineData && timelineData.timeline.length > 0 ? (
          <div className="h-96 bg-white rounded">
            <VoteTimelineChart
              timelineData={timelineData.timeline}
              groupBy={timelineGroupBy as "day" | "hour" | "month" | "week"}
            />
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500">
            Няма данни за избрания период или група.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="p-4 bg-white shadow-md rounded-lg">
          <h3 className="text-xl font-semibold text-slate-700 mb-1">
            Удовлетвореност (общо)
          </h3>
          <p className="text-sm text-slate-500">
            Показване на данни от{" "}
            <span className="text-slate-800 font-medium">
              {new Date(startDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>{" "}
            до{" "}
            <span className="text-slate-800 font-medium">
              {new Date(endDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </p>
          <div className="h-96 bg-white rounded">
            <SatisfactionPieChart
              summary={summary}
              isLoading={isLoadingSummary}
            />
          </div>
        </div>
        <div className="p-4 bg-white shadow-md rounded-lg">
          <h3 className="text-xl font-semibold text-slate-700 mb-1">
            Удовлетвореност (детайлно)
          </h3>
          <p className="text-sm text-slate-500">
            Показване на данни от{" "}
            <span className="text-slate-800 font-medium">
              {new Date(startDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>{" "}
            до{" "}
            <span className="text-slate-800 font-medium">
              {new Date(endDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </p>
          <div className="h-96 bg-white rounded">
            <SatisfactionBarChart
              summary={summary}
              isLoading={isLoadingSummary}
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-white shadow-md rounded-lg overflow-x-auto">
        <h3 className="text-xl font-semibold text-slate-700 mb-4">
          Детайлна Статистика по Тип Гласуване
        </h3>
        {isLoadingSummary ? (
          <div className="text-center py-10 text-slate-600 h-64 flex items-center justify-center">
            <Loader text="Зареждане на данни..." />
          </div>
        ) : summary &&
          summary.votesByType &&
          summary.votesByType.filter((item) => item._id !== null).length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Тип на Гласа
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Брой
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Процент
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {summary.votesByType
                .filter((item) => item._id !== null)
                .map((item) => {
                  const voteDetails = getVoteTypeDetails(item._id!);
                  const percentage =
                    summary.totalVotes > 0
                      ? ((item.count / summary.totalVotes) * 100).toFixed(2)
                      : "0.00";
                  return (
                    <tr key={item._id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900 flex items-center">
                        <span
                          className="h-3 w-3 rounded-full mr-3"
                          style={{ backgroundColor: voteDetails.color }}
                        ></span>
                        {voteDetails.label}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.count}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                        {percentage}%
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-10 text-slate-500">
            Няма детайлни данни за избрания период.
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <StatsPageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
