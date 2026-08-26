"use client";

import React, { useEffect, useState, FormEvent, useCallback } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter } from "next/navigation";
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

/** Accent of the totals columns; matches the bar fill in VoteTimelineChart. */
const TOTALS_COLOR = "#14b8a6";

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
  const router = useRouter();
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
  // Columns = totals (always available); the vote-type lines are preselected
  // from the data of the current range, until the user picks their own set.
  const [showTotals, setShowTotals] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [autoSelectTypes, setAutoSelectTypes] = useState(true);
  const allTypesSelected = selectedTypes.length === VOTE_TYPE_ORDER.length;
  const toggleType = (type: string) => {
    setAutoSelectTypes(false);
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };
  const toggleAllTypes = () => {
    setAutoSelectTypes(false);
    setSelectedTypes(allTypesSelected ? [] : [...VOTE_TYPE_ORDER]);
  };

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
      if (autoSelectTypes) {
        // Preselect only the vote types that actually occur in this range, in
        // the canonical order, so the chart opens on the relevant lines.
        const present = VOTE_TYPE_ORDER.filter((type) =>
          (data.timeline || []).some((point) => (point.byType?.[type] ?? 0) > 0)
        );
        setSelectedTypes(present);
      }
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
  }, [token, startDate, endDate, timelineGroupBy, timezone, autoSelectTypes]);

  useEffect(() => {
    fetchVoteSummary();
  }, [fetchVoteSummary]);

  useEffect(() => {
    fetchVoteTimeline();
  }, [fetchVoteTimeline]);

  const handlePeriodChange = (period: Period) => {
    setActivePeriod(period);
    setAutoSelectTypes(true);
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
    setAutoSelectTypes(true);
    setTimelineGroupBy(startDate === endDate ? "hour" : "day");
    fetchVoteSummary();
    fetchVoteTimeline();
  };

  // Every chart drills down into the matching feedback entries.
  const openFeedback = (
    rangeStart: string,
    rangeEnd: string,
    voteType?: string
  ) => {
    const params = new URLSearchParams({
      startDate: rangeStart,
      endDate: rangeEnd,
    });
    if (voteType) params.set("vote", voteType);
    router.push(`/dashboard/feedback?${params.toString()}`);
  };

  // A column or a line point drills down to that bucket's date range.
  const handlePointSelect = ({
    date,
    voteType,
  }: {
    date: Date;
    voteType?: string;
  }) => {
    const today = new Date();
    let rangeStart = date;
    let rangeEnd = date;

    if (timelineGroupBy === "month") {
      rangeStart = new Date(date.getFullYear(), date.getMonth(), 1);
      rangeEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }
    if (rangeEnd > today) rangeEnd = today;

    openFeedback(
      toLocalDateInputValue(rangeStart),
      toLocalDateInputValue(rangeEnd),
      voteType
    );
  };

  // The satisfaction charts have no time axis, so they use the whole period.
  const handleVoteSelect = (voteType: string) =>
    openFeedback(startDate, endDate, voteType);

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

      <div className="mb-8 bg-white shadow-md rounded-2xl overflow-hidden">
        <div className="chrome-band px-4 pt-4 pb-5 md:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-800 tracking-[-0.01em]">
                Активност (Трафик)
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">{periodLabel}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Часова зона: {timezone.replace(/_/g, " ")} · кликнете върху
                колона или точка, за да видите отзивите
              </p>
            </div>
            <div className="seg" role="group" aria-label="Период">
              {(["day", "week", "month", "year", "all"] as const).map(
                (period) => (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={activePeriod === period}
                    onClick={() => handlePeriodChange(period)}
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTotals((prev) => !prev)}
              aria-pressed={showTotals}
              className="mchip mchip--square"
              style={{ "--chip": TOTALS_COLOR } as React.CSSProperties}
              title="Колони с общия брой гласове"
            >
              <span className="chip-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              Общо
            </button>
            <span className="chip-rule" aria-hidden="true" />
            <button
              type="button"
              onClick={toggleAllTypes}
              aria-pressed={allTypesSelected}
              className="mchip"
              style={{ "--chip": "#334155" } as React.CSSProperties}
            >
              Всички
            </button>
            {VOTE_TYPE_ORDER.map((type) => {
              const details = getVoteTypeDetails(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  aria-pressed={selectedTypes.includes(type)}
                  className="mchip"
                  style={{ "--chip": details.color } as React.CSSProperties}
                >
                  <span className="chip-dot" aria-hidden="true" />
                  {details.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 pb-5 pt-3 md:px-6">
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
              onPointSelect={handlePointSelect}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="p-4 bg-white shadow-md rounded-lg">
          <h3 className="text-xl font-semibold text-slate-800 mb-1 tracking-[-0.01em]">
            Удовлетвореност (общо)
          </h3>
          <p className="text-sm text-slate-500">{periodLabel}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Кликнете върху част от кръга, за да видите тези отзиви
          </p>
          <div className="h-96 bg-white rounded">
            <SatisfactionPieChart
              summary={summary}
              isLoading={isLoadingSummary}
              onVoteSelect={handleVoteSelect}
            />
          </div>
        </div>
        <div className="p-4 bg-white shadow-md rounded-lg">
          <h3 className="text-xl font-semibold text-slate-800 mb-1 tracking-[-0.01em]">
            Удовлетвореност (детайлно)
          </h3>
          <p className="text-sm text-slate-500">{periodLabel}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Кликнете върху колона, за да видите тези отзиви
          </p>
          <div className="h-96 bg-white rounded">
            <SatisfactionBarChart
              summary={summary}
              isLoading={isLoadingSummary}
              onVoteSelect={handleVoteSelect}
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
                    <tr
                      key={item._id}
                      onClick={() =>
                        item._id && handleVoteSelect(String(item._id))
                      }
                      className="hover:bg-slate-50 cursor-pointer"
                      title="Виж отзивите с тази оценка"
                    >
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
