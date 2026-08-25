"use client";

import React, { useEffect, useState, FormEvent, useCallback } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import VoteTimelineChart from "@/components/stats/VoteTimelineChart";
import SummaryCards from "@/components/stats/SummaryCards";
import SatisfactionPieChart from "@/components/stats/SatisfactionPieChart";
import SatisfactionBarChart from "@/components/stats/SatisfactionBarChart";
import { getVoteTypeDetails, VOTE_TYPE_ORDER } from "@/lib/chartUtils";
import {
  formatDateInputBG,
  getUserTimezone,
  toLocalDateInputValue,
} from "@/lib/timezoneUtils";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";

interface VoteSummary {
  totalVotes: number;
  lastVoteAt?: string | null;
  votesByType: Array<{ _id: string | null; count: number }>;
  averageScore?: number | null;
  averageLabel?: string | null;
}

interface VoteTimelinePoint {
  timePeriod: { year: number; month: number; day?: number; hour?: number };
  totalCount: number;
  byType?: Record<string, number>;
}

interface VoteTimelineData {
  timeline: VoteTimelinePoint[];
  success?: boolean;
}

type Period = "day" | "week" | "month" | "year" | "all" | "custom";
type GroupBy = "day" | "hour" | "month";

const defaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return {
    start: toLocalDateInputValue(start),
    end: toLocalDateInputValue(end),
  };
};

function StatsPageContent() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<VoteSummary | null>(null);
  const [timelineData, setTimelineData] = useState<VoteTimelineData | null>(
    null
  );
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);

  // Everything is expressed in the browser's timezone; the API receives it so
  // day boundaries and buckets line up with what the user sees (and with the
  // export, when the same timezone is picked there).
  const [timezone] = useState(() => getUserTimezone());

  const [{ start: initialStart, end: initialEnd }] = useState(defaultRange);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [activePeriod, setActivePeriod] = useState<Period>("week");
  const [timelineGroupBy, setTimelineGroupBy] = useState<GroupBy>("day");
  // Columns = totals (on by default); vote-type lines are opt-in.
  const [showTotals, setShowTotals] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const allTypesSelected = selectedTypes.length === VOTE_TYPE_ORDER.length;
  const toggleType = (type: string) =>
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  const toggleAllTypes = () =>
    setSelectedTypes(allTypesSelected ? [] : [...VOTE_TYPE_ORDER]);

  const fetchVoteSummary = useCallback(async () => {
    if (!token) return;
    setIsLoadingSummary(true);
    try {
      const summaryParams = new URLSearchParams({
        startDate,
        endDate,
        timezone,
      }).toString();
      const summaryData = await apiClient<VoteSummary>(
        `/stats/votes/summary?${summaryParams}`,
        { token }
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
  }, [token, startDate, endDate, timezone]);

  const fetchVoteTimeline = useCallback(async () => {
    if (!token) return;
    setIsLoadingTimeline(true);

    const isOneDayRange = startDate === endDate;
    const effectiveGroupBy: GroupBy =
      timelineGroupBy === "hour" && !isOneDayRange ? "day" : timelineGroupBy;

    try {
      const timelineParams = new URLSearchParams({
        startDate,
        endDate,
        groupBy: effectiveGroupBy,
        timezone,
      }).toString();
      const data = await apiClient<VoteTimelineData>(
        `/stats/votes/timeline?${timelineParams}`,
        { token }
      );
      setTimelineData(data);
      if (effectiveGroupBy !== timelineGroupBy) {
        setTimelineGroupBy(effectiveGroupBy);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Грешка при извличане на данни за графиката.";
      toast.error(message);
      setTimelineData(null);
    }
    setIsLoadingTimeline(false);
  }, [token, startDate, endDate, timelineGroupBy, timezone]);

  useEffect(() => {
    fetchVoteSummary();
  }, [fetchVoteSummary]);

  useEffect(() => {
    fetchVoteTimeline();
  }, [fetchVoteTimeline]);

  const handlePeriodChange = (period: Period) => {
    setActivePeriod(period);
    const now = new Date();
    let newStartDate = new Date(now);
    let newGroupBy: GroupBy = "day";

    switch (period) {
      case "all":
        newStartDate = new Date(2000, 0, 1);
        newGroupBy = "month";
        break;
      case "day":
        newGroupBy = "hour";
        break;
      case "week":
        newStartDate.setDate(now.getDate() - 6);
        newGroupBy = "day";
        break;
      case "month":
        // Current month, day by day.
        newStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        newGroupBy = "day";
        break;
      case "year":
        newStartDate = new Date(now.getFullYear(), 0, 1);
        newGroupBy = "month";
        break;
      default:
        newStartDate.setDate(now.getDate() - 6);
        newGroupBy = "day";
    }

    setStartDate(toLocalDateInputValue(newStartDate));
    setEndDate(toLocalDateInputValue(now));
    setTimelineGroupBy(newGroupBy);
  };

  const handleCustomDateFilterSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (startDate > endDate) {
      toast.error("Началната дата не може да бъде след крайната дата.");
      return;
    }
    setActivePeriod("custom");
    setTimelineGroupBy(startDate === endDate ? "hour" : "day");
    fetchVoteSummary();
    fetchVoteTimeline();
  };

  const periodLabel = (
    <>
      Показване на данни от{" "}
      <span className="text-slate-800 font-medium">
        {formatDateInputBG(startDate)}
      </span>{" "}
      до{" "}
      <span className="text-slate-800 font-medium">
        {formatDateInputBG(endDate)}
      </span>
    </>
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
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-gray-900 p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
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
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-gray-900 p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
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
            <p className="text-sm text-slate-500">{periodLabel}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Часова зона: {timezone.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap gap-1">
            {(["day", "week", "month", "year", "all"] as const).map(
              (period) => (
                <button
                  key={period}
                  type="button"
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
        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          <button
            type="button"
            onClick={() => setShowTotals((prev) => !prev)}
            aria-pressed={showTotals}
            className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${
              showTotals
                ? "bg-teal-500 text-white border-teal-500"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            Общо
          </button>
          <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
          <button
            type="button"
            onClick={toggleAllTypes}
            className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${
              allTypesSelected
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            Всички
          </button>
          {VOTE_TYPE_ORDER.map((type) => {
            const details = getVoteTypeDetails(type);
            const active = selectedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={active}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${
                  active
                    ? "text-white"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
                style={
                  active
                    ? { backgroundColor: details.color, borderColor: details.color }
                    : undefined
                }
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/60"
                  style={{ backgroundColor: details.color }}
                />
                {details.label}
              </button>
            );
          })}
        </div>
        {isLoadingTimeline ? (
          <div className="text-center py-10 text-slate-600 h-96 flex items-center justify-center">
            <Loader text="Зареждане на данни..." />
          </div>
        ) : !showTotals && selectedTypes.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            Изберете поне една серия („Общо“ или тип глас).
          </div>
        ) : timelineData && timelineData.timeline.length > 0 ? (
          <div className="h-96 bg-white rounded">
            <VoteTimelineChart
              timelineData={timelineData.timeline}
              groupBy={timelineGroupBy}
              selectedTypes={selectedTypes}
              showTotals={showTotals}
            />
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500">
            <p>Няма гласували за този период.</p>
            {summary?.lastVoteAt ? (
              <p className="mt-1 text-sm">
                Последен глас за този акаунт:{" "}
                <span className="font-medium text-slate-700">
                  {new Date(summary.lastVoteAt).toLocaleString("bg-BG", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>{" "}
                — изберете по-дълъг период или „Всички времена“.
              </p>
            ) : (
              <p className="mt-1 text-sm">
                За този акаунт още няма гласували.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="p-4 bg-white shadow-md rounded-lg">
          <h3 className="text-xl font-semibold text-slate-700 mb-1">
            Удовлетвореност (общо)
          </h3>
          <p className="text-sm text-slate-500">{periodLabel}</p>
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
          <p className="text-sm text-slate-500">{periodLabel}</p>
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
                  const voteDetails = getVoteTypeDetails(item._id);
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
            Няма гласували за този период.
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
