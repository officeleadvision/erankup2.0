"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowDownTrayIcon,
  ChevronUpDownIcon,
  CheckIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import {
  buildTimezoneList,
  getUserTimezone,
  type TimezoneInfo,
} from "@/lib/timezoneUtils";

type ExportFormat = "csv" | "xlsx";

function ExportPageContent() {
  const { token, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  // Timezone state
  const [timezones, setTimezones] = useState<TimezoneInfo[]>([]);
  const [selectedTimezone, setSelectedTimezone] = useState("Europe/Sofia");
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [isTimezoneDropdownOpen, setIsTimezoneDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load timezones on mount
  useEffect(() => {
    const tzList = buildTimezoneList();
    setTimezones(tzList);
    // Detect user's timezone using utility function
    const userTz = getUserTimezone("Europe/Sofia");
    if (tzList.some((tz) => tz.name === userTz)) {
      setSelectedTimezone(userTz);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsTimezoneDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter timezones based on search
  const filteredTimezones = useMemo(() => {
    if (!timezoneSearch.trim()) return timezones;
    const searchLower = timezoneSearch.toLowerCase();
    return timezones.filter(
      (tz) =>
        tz.name.toLowerCase().includes(searchLower) ||
        tz.label.toLowerCase().includes(searchLower) ||
        tz.offset.toLowerCase().includes(searchLower)
    );
  }, [timezones, timezoneSearch]);

  // Get selected timezone info
  const selectedTimezoneInfo = useMemo(
    () => timezones.find((tz) => tz.name === selectedTimezone),
    [timezones, selectedTimezone]
  );

  const handleExport = async (
    type: "votes" | "feedback",
    exportFormat: ExportFormat
  ) => {
    if (isAuthLoading) {
      toast.warn("Автентикацията все още се зарежда. Моля, изчакайте.");
      return;
    }
    if (!isAuthenticated || !token) {
      toast.error("Токенът за автентикация не е наличен. Моля, влезте отново.");
      return;
    }

    if (!startDate || !endDate) {
      toast.error("Моля, изберете начална и крайна дата.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Началната дата не може да бъде след крайната дата.");
      return;
    }

    setIsExporting(true);

    // Debug: Log the actual dates being sent
    console.log("[Export Frontend] Dates being sent:", {
      startDate,
      endDate,
      selectedTimezone,
    });

    const queryParams = new URLSearchParams();
    if (startDate) {
      queryParams.append("startDate", startDate);
    }
    if (endDate) {
      queryParams.append("endDate", endDate);
    }
    queryParams.append("format", exportFormat);
    queryParams.append("timezone", selectedTimezone);
    const urlWithParams = `/export/${type}?${queryParams.toString()}`;

    console.log("[Export Frontend] Full URL:", urlWithParams);

    try {
      const responseType: "text" | "blob" =
        exportFormat === "xlsx" ? "blob" : "text";
      const exportData = await apiClient<string | Blob>(urlWithParams, {
        method: "GET",
        responseType,
        token: token,
      });

      let blob: Blob;
      if (exportFormat === "xlsx") {
        blob = exportData as Blob;
      } else {
        const csvData = exportData as string;
        blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", blobUrl);
      link.setAttribute(
        "download",
        `${type}_${startDate}_до_${endDate}.${exportFormat}`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success(
        `Експортът на ${
          type === "votes" ? "гласове" : "отзиви"
        } е успешен! Файлът е изтеглен.`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : `Неуспешен експорт на ${
              type === "votes" ? "гласове" : "отзиви"
            }. Моля, опитайте отново.`;
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title is handled by DashboardLayout, uses "Експорт" */}

      {isAuthLoading && (
        <div
          className="p-4 text-sm text-blue-700 bg-blue-100 rounded-lg"
          role="alert"
        >
          <span className="font-medium">
            Автентикация в процес... Моля, изчакайте.
          </span>
        </div>
      )}

      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Период за експорт
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Изберете начална и крайна дата за данните, които искате да
          експортирате.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Начална дата
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 text-gray-900 block w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow duration-150 ease-in-out hover:shadow-md"
            />
          </div>
          <div>
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Крайна дата
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 text-gray-900 block w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow duration-150 ease-in-out hover:shadow-md"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label
              htmlFor="exportFormat"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Формат на експорта
            </label>
            <select
              id="exportFormat"
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="mt-1 block w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow duration-150 ease-in-out hover:shadow-md text-gray-900"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
            </select>
          </div>

          <div ref={dropdownRef} className="relative">
            <label
              htmlFor="timezone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Часова зона
            </label>
            <button
              type="button"
              onClick={() => setIsTimezoneDropdownOpen(!isTimezoneDropdownOpen)}
              className="mt-1 relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-4 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow duration-150 ease-in-out hover:shadow-md"
            >
              <span className="flex items-center">
                <GlobeAltIcon className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                <span className="block truncate text-gray-900">
                  {selectedTimezoneInfo?.label ||
                    selectedTimezone.replace(/_/g, " ")}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </button>

            {isTimezoneDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    placeholder="Търсене на часова зона..."
                    value={timezoneSearch}
                    onChange={(e) => setTimezoneSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    autoFocus
                  />
                </div>
                <ul className="max-h-60 overflow-auto py-1">
                  {filteredTimezones.length === 0 ? (
                    <li className="px-4 py-2 text-sm text-gray-500">
                      Няма намерени часови зони
                    </li>
                  ) : (
                    filteredTimezones.map((tz) => (
                      <li
                        key={tz.name}
                        onClick={() => {
                          setSelectedTimezone(tz.name);
                          setIsTimezoneDropdownOpen(false);
                          setTimezoneSearch("");
                        }}
                        className={`relative cursor-pointer select-none py-2 pl-10 pr-4 hover:bg-indigo-50 ${
                          selectedTimezone === tz.name
                            ? "bg-indigo-100 text-indigo-900"
                            : "text-gray-900"
                        }`}
                      >
                        <span
                          className={`block truncate ${
                            selectedTimezone === tz.name
                              ? "font-semibold"
                              : "font-normal"
                          }`}
                        >
                          {tz.label}
                        </span>
                        {selectedTimezone === tz.name && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
        {startDate && endDate && (
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-700">
              <strong>Ще бъде експортирано за периода:</strong>{" "}
              <span className="text-indigo-900 font-semibold">
                {new Date(startDate + "T00:00:00").toLocaleDateString("bg-BG", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>{" "}
              до{" "}
              <span className="text-indigo-900 font-semibold">
                {new Date(endDate + "T00:00:00").toLocaleDateString("bg-BG", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </p>
            <p className="text-xs text-indigo-600 mt-1">
              Часова зона:{" "}
              {selectedTimezoneInfo?.label ||
                selectedTimezone.replace(/_/g, " ")}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 shadow-xl rounded-xl p-6 md:p-8 text-white transform transition-transform duration-300 ease-out">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xl font-semibold">Експорт на Гласове</h3>
            <ArrowDownTrayIcon className="h-8 w-8 text-green-100" />
          </div>
          <p className="text-sm text-green-50 mb-6">
            Изтеглете {format === "csv" ? "CSV" : "XLSX"} файл с всички гласове
            в избрания период.
          </p>
          <button
            onClick={() => handleExport("votes", format)}
            disabled={isExporting || isAuthLoading || !isAuthenticated}
            className="w-full flex items-center justify-center px-6 py-3 bg-white text-green-600 font-semibold rounded-lg shadow-md hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2 focus:ring-offset-green-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            {isExporting
              ? "Експортиране..."
              : `Експорт на ${format.toUpperCase()} (Гласове)`}
          </button>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl rounded-xl p-6 md:p-8 text-white transform transition-transform duration-300 ease-out">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xl font-semibold">Експорт на Отзиви</h3>
            <ArrowDownTrayIcon className="h-8 w-8 text-blue-100" />
          </div>
          <p className="text-sm text-blue-50 mb-6">
            Изтеглете {format === "csv" ? "CSV" : "XLSX"} файл с всички отзиви в
            избрания период.
          </p>
          <button
            onClick={() => handleExport("feedback", format)}
            disabled={isExporting || isAuthLoading || !isAuthenticated}
            className="w-full flex items-center justify-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg shadow-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            {isExporting
              ? "Експортиране..."
              : `Експорт на ${format.toUpperCase()} (Отзиви)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExportPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <ExportPageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
