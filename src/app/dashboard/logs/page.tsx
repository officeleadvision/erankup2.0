"use client";

import React, { useCallback, useEffect, useState } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

type ActivityEntityType = "export" | "device" | "question";

type ActivityLogEntry = {
  id: string;
  account: string;
  performedBy: string;
  entityType: ActivityEntityType;
  action: string;
  entityId?: string | null;
  entityName?: string | null;
  status: "success" | "error";
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type ActivityLogResponse = {
  success: boolean;
  scope: "account" | "global";
  note?: string;
  page?: number;
  totalPages?: number;
  limit?: number;
  search?: string;
  logs: ActivityLogEntry[];
};

const ITEMS_PER_PAGE = 25;

function LogsPageContent() {
  const { token, godmode, admin, isLoading: isAuthLoading } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [logScope, setLogScope] = useState<"account" | "global">("account");
  const [logNote, setLogNote] = useState<string | null>(null);
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const canViewLogs = Boolean(token && (godmode || admin));

  const entityTypeLabels: Record<ActivityEntityType, string> = {
    export: "Експорт",
    device: "Устройство",
    question: "Въпрос",
  };

  const formatChangeValue = (value: unknown): string => {
    if (value === null || typeof value === "undefined") {
      return "—";
    }
    if (Array.isArray(value)) {
      return value.map((item) => formatChangeValue(item)).join(", ");
    }
    if (typeof value === "boolean") {
      return value ? "Да" : "Не";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const actionLabels: Record<string, string> = {
    feedback: "Отзиви",
    votes: "Гласове",
    create: "Създаване",
    update: "Актуализация",
    delete: "Изтриване",
    reorder: "Пренареждане",
    toggle: "Смяна на видимост",
    download: "Изтегляне",
  };

  const normalizeDateLabel = (input?: unknown): string | null => {
    if (typeof input !== "string" || input.trim() === "") {
      return null;
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return input;
    }
    return parsed.toLocaleDateString("bg-BG");
  };

  const buildPeriodLabel = (start?: string | null, end?: string | null) => {
    const startLabel = normalizeDateLabel(start);
    const endLabel = normalizeDateLabel(end);
    if (!startLabel && !endLabel) {
      return "Целият наличен период";
    }
    return `${startLabel ?? "Начало"} → ${endLabel ?? "Край"}`;
  };

  const fetchLogs = useCallback(async () => {
    if (!token || !canViewLogs) {
      setLogs([]);
      setLogNote(null);
      setLogScope("account");
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }
    setIsLogLoading(true);
    setLogError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (appliedSearch) {
        params.append("search", appliedSearch);
      }
      const response = await apiClient<ActivityLogResponse>(
        `/export/logs?${params.toString()}`,
        {
          method: "GET",
          token,
        }
      );
      setLogs(response.logs || []);
      setLogScope(response.scope);
      setLogNote(response.note || null);
      setTotalPages(response.totalPages || 1);
      if (response.page && response.page !== currentPage) {
        setCurrentPage(response.page);
      }
    } catch (error: unknown) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : "Неуспешно зареждане на логовете.";
      setLogError(fallbackMessage);
    } finally {
      setIsLogLoading(false);
    }
  }, [token, canViewLogs, currentPage, appliedSearch]);

  useEffect(() => {
    if (canViewLogs) {
      fetchLogs();
    }
  }, [canViewLogs, fetchLogs]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(searchTerm.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <p className="text-sm text-gray-500">Зареждане на достъп...</p>
      </div>
    );
  }

  if (!canViewLogs) {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Нямате достъп до логовете
        </h3>
        <p className="text-sm text-gray-600">
          За да ореглеждат историята на действията, моля свържете се с
          администратор.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex flex-col">
              <h3 className="text-xl font-semibold text-gray-800">
                История на действията
              </h3>
              {logNote && (
                <p className="text-xs text-gray-400 mt-1">{logNote}</p>
              )}
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Търси по потребител, действие, съобщение или други полета..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              {appliedSearch && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-xs text-slate-500 hover:text-slate-700 transition"
                >
                  Изчистване
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLogLoading || currentPage === 1}
            >
              Предишна
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLogLoading || currentPage >= totalPages}
            >
              Следваща
            </button>
            <button
              type="button"
              onClick={fetchLogs}
              className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isLogLoading}
            >
              Обнови
            </button>
          </div>
        </div>

        {logError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {logError}
          </div>
        )}

        {!logError && (
          <div className="mt-6">
            {isLogLoading ? (
              <p className="text-sm text-gray-500">Зареждане...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-gray-500">
                Няма налични записи за показване.
              </p>
            ) : (
              <div className="space-y-4">
                {logs.map((entry) => {
                  const metadata = (entry.metadata ?? {}) as Record<
                    string,
                    unknown
                  >;
                  const getMetaString = (key: string): string | null => {
                    const value = metadata[key];
                    return typeof value === "string" && value.trim() !== ""
                      ? value
                      : null;
                  };
                  const getMetaNumber = (key: string): number | undefined => {
                    const value = metadata[key];
                    return typeof value === "number" ? value : undefined;
                  };
                  const getMetaBoolean = (key: string): boolean | undefined => {
                    const value = metadata[key];
                    return typeof value === "boolean" ? value : undefined;
                  };
                  const getMetaStringArray = (
                    key: string
                  ): string[] | undefined => {
                    const value = metadata[key];
                    if (!Array.isArray(value)) return undefined;
                    const filtered = value.filter(
                      (item): item is string => typeof item === "string"
                    );
                    return filtered.length > 0 ? filtered : undefined;
                  };

                  const isExport = entry.entityType === "export";
                  const isDevice = entry.entityType === "device";
                  const isQuestion = entry.entityType === "question";

                  const exportStart = isExport
                    ? getMetaString("startDate")
                    : null;
                  const exportEnd = isExport ? getMetaString("endDate") : null;
                  const exportFormat = isExport
                    ? getMetaString("format")
                    : null;
                  const exportTypeLabel = isExport
                    ? actionLabels[entry.action] ?? entry.action
                    : null;
                  const totalRows = isExport
                    ? getMetaNumber("totalRows")
                    : undefined;
                  const deviceLabel = isDevice
                    ? getMetaString("label") || entry.entityName || null
                    : null;
                  const deviceLocation = isDevice
                    ? getMetaString("location")
                    : null;
                  const deviceUpdatedFields = isDevice
                    ? getMetaStringArray("updatedFields")
                    : undefined;
                  const questionHidden = isQuestion
                    ? getMetaBoolean("hidden")
                    : undefined;
                  const questionOrder = isQuestion
                    ? getMetaNumber("order")
                    : undefined;
                  const questionReorderCount = isQuestion
                    ? getMetaNumber("reorderCount")
                    : undefined;
                  const questionUpdatedFields = isQuestion
                    ? getMetaStringArray("updatedFields")
                    : undefined;

                  const changeEntries = Array.isArray(metadata.changes)
                    ? metadata.changes
                        .filter(
                          (item): item is Record<string, unknown> =>
                            item !== null && typeof item === "object"
                        )
                        .map((item) => ({
                          field:
                            typeof item.field === "string"
                              ? item.field
                              : "field",
                          from: formatChangeValue(item.from),
                          to: formatChangeValue(item.to),
                          description:
                            typeof item.description === "string"
                              ? item.description
                              : undefined,
                          details: Array.isArray(item.details)
                            ? item.details
                                .filter(
                                  (detail) =>
                                    detail !== null &&
                                    typeof detail === "object"
                                )
                                .map(
                                  (detail) => detail as Record<string, unknown>
                                )
                            : undefined,
                        }))
                    : [];

                  const entityLabel =
                    entityTypeLabels[entry.entityType] ?? "Активност";
                  const actionLabel =
                    actionLabels[entry.action] ??
                    entry.action.charAt(0).toUpperCase() +
                      entry.action.slice(1);
                  const statusBadgeClass =
                    entry.status === "success"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800";
                  const statusLabel =
                    entry.status === "success" ? "Успех" : "Грешка";
                  const createdAtLabel = new Date(
                    entry.createdAt
                  ).toLocaleString("bg-BG");

                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                        <p className="text-sm font-medium text-gray-700">
                          {entityLabel} ·{" "}
                          {isExport && exportTypeLabel
                            ? exportTypeLabel
                            : actionLabel}
                          {isExport && exportFormat && (
                            <> · {exportFormat.toUpperCase()}</>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {createdAtLabel}
                        </p>
                      </div>

                      <span
                        className={`mt-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}
                      >
                        {statusLabel}
                      </span>

                      <p className="mt-2 text-sm text-gray-600">
                        Изпълнено от{" "}
                        <span className="font-semibold text-gray-800">
                          {entry.performedBy}
                        </span>{" "}
                        {logScope === "global" && entry.account && (
                          <>
                            за акаунт{" "}
                            <span className="font-semibold text-gray-800">
                              {entry.account}
                            </span>{" "}
                          </>
                        )}
                        .
                      </p>

                      {isExport && (
                        <p className="mt-1 text-sm text-gray-600">
                          Период:{" "}
                          <span className="font-medium">
                            {buildPeriodLabel(exportStart, exportEnd)}
                          </span>
                          {typeof totalRows !== "undefined" && (
                            <> · Редове: {totalRows}</>
                          )}
                        </p>
                      )}

                      {isDevice && (
                        <>
                          <p className="mt-1 text-sm text-gray-600">
                            Устройство:{" "}
                            <span className="font-medium">
                              {deviceLabel ?? "—"}
                            </span>
                            {deviceLocation && (
                              <> · Локация: {deviceLocation}</>
                            )}
                          </p>
                          {deviceUpdatedFields &&
                            deviceUpdatedFields.length > 0 && (
                              <p className="mt-1 text-xs text-gray-500">
                                Променени полета:{" "}
                                {deviceUpdatedFields.join(", ")}
                              </p>
                            )}
                        </>
                      )}

                      {isQuestion && (
                        <>
                          <p className="mt-1 text-sm text-gray-600">
                            Въпрос:{" "}
                            <span className="font-medium">
                              {entry.entityName ?? "—"}
                            </span>
                          </p>
                          {typeof questionOrder !== "undefined" && (
                            <p className="mt-1 text-sm text-gray-600">
                              Поредност:{" "}
                              <span className="font-medium">
                                {questionOrder}
                              </span>
                            </p>
                          )}
                          {typeof questionHidden !== "undefined" && (
                            <p className="mt-1 text-sm text-gray-600">
                              Видимост:{" "}
                              <span className="font-medium">
                                {questionHidden ? "Скрит" : "Видим"}
                              </span>
                            </p>
                          )}
                          {questionReorderCount ? (
                            <p className="mt-1 text-xs text-gray-500">
                              Брой засегнати въпроси: {questionReorderCount}
                            </p>
                          ) : null}
                          {questionUpdatedFields &&
                            questionUpdatedFields.length > 0 && (
                              <p className="mt-1 text-xs text-gray-500">
                                Променени полета:{" "}
                                {questionUpdatedFields.join(", ")}
                              </p>
                            )}
                        </>
                      )}

                      {changeEntries.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          {changeEntries.map((change, idx) => (
                            <div key={`${entry.id}-change-${idx}`}>
                              <span className="font-semibold">
                                {change.field}:
                              </span>{" "}
                              {change.description ? (
                                <span>{change.description}</span>
                              ) : (
                                <>
                                  <span className="text-red-600">
                                    {change.from}
                                  </span>{" "}
                                  →{" "}
                                  <span className="text-green-600">
                                    {change.to}
                                  </span>
                                </>
                              )}
                              {change.details && change.details.length > 0 && (
                                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs text-slate-500">
                                  {change.details.map((detail, detailIndex) => {
                                    const detailQuestion =
                                      typeof detail.question === "string"
                                        ? detail.question
                                        : typeof detail.questionId === "string"
                                        ? detail.questionId
                                        : null;
                                    const fromOrderValue =
                                      typeof detail.fromOrder === "number"
                                        ? detail.fromOrder
                                        : undefined;
                                    const toOrderValue =
                                      typeof detail.toOrder === "number"
                                        ? detail.toOrder
                                        : undefined;
                                    const detailDescription =
                                      typeof detail.description === "string"
                                        ? detail.description
                                        : null;
                                    const isReorder =
                                      change.field === "reorder" &&
                                      (typeof fromOrderValue !== "undefined" ||
                                        typeof toOrderValue !== "undefined");

                                    return (
                                      <li
                                        key={`${entry.id}-detail-${idx}-${detailIndex}`}
                                      >
                                        {isReorder ? (
                                          <>
                                            Преместен{" "}
                                            {detailQuestion
                                              ? `„${detailQuestion}“`
                                              : "елемент"}
                                            :{" "}
                                            <span className="text-red-600">
                                              {fromOrderValue ?? "—"}
                                            </span>{" "}
                                            →{" "}
                                            <span className="text-green-600">
                                              {toOrderValue ?? "—"}
                                            </span>
                                          </>
                                        ) : detailDescription ? (
                                          detailDescription
                                        ) : (
                                          <>
                                            {detailQuestion
                                              ? `${detailQuestion}: `
                                              : ""}
                                            <span className="text-red-600">
                                              {formatChangeValue(
                                                detail.fromOrder ??
                                                  detail.from ??
                                                  detail.value
                                              )}
                                            </span>{" "}
                                            →{" "}
                                            <span className="text-green-600">
                                              {formatChangeValue(
                                                detail.toOrder ??
                                                  detail.to ??
                                                  detail.newValue
                                              )}
                                            </span>
                                          </>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {entry.message && (
                        <p className="mt-1 text-xs text-gray-500">
                          {entry.message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!logError && logs.length > 0 && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Страница {currentPage} от {Math.max(totalPages, 1)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLogLoading || currentPage === 1}
              >
                Първа
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLogLoading || currentPage === 1}
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLogLoading || currentPage >= totalPages}
              >
                Напред
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLogLoading || currentPage >= totalPages}
              >
                Последна
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LogsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <LogsPageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
