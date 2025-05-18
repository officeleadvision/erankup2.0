"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";

interface DeviceInFeedback {
  _id: string;
  label: string;
  location?: string;
}

interface FeedbackItem {
  _id: string;
  date: string;
  question?: string;
  vote?: string;
  translated_vote?: string;
  name?: string;
  phone?: string;
  email?: string;
  comment?: string;
  devices: DeviceInFeedback[];
  questionsVoteToString?: string;
  username?: string;
}

interface FeedbackApiResponse {
  success: boolean;
  feedback: FeedbackItem[];
  message?: string;
  totalPages?: number;
  currentPage?: number;
}

const ITEMS_PER_PAGE = 10;

const formatDateTimeBG = (dateString: string): string => {
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
};

function FeedbackPageContent() {
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchFeedback = useCallback(() => {
    if (token) {
      setIsLoading(true);

      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", currentPage.toString());
      params.append("limit", ITEMS_PER_PAGE.toString());

      apiClient<FeedbackApiResponse>(`/feedback?${params.toString()}`, {
        token,
      })
        .then((data) => {
          if (data.success && data.feedback) {
            setFeedbackList(data.feedback);
            setTotalPages(data.totalPages || 0);
            setCurrentPage(data.currentPage || 1);
          } else {
            const message = data.message || "Failed to load feedback.";
            toast.error(message);
            setFeedbackList([]);
            setTotalPages(0);
          }
        })
        .catch((err) => {
          const message =
            err.message || "An error occurred while fetching feedback.";
          toast.error(message);
          setFeedbackList([]);
          setTotalPages(0);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [token, startDate, endDate, currentPage]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleDateFilterApply = () => {
    setCurrentPage(1);
    fetchFeedback();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">
        Обратна връзка от потребителите
      </h2>

      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-3">
          Филтриране по дата
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Начална дата (
              <span className="text-slate-800 font-medium">
                {startDate
                  ? new Date(startDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "N/A"}
              </span>
              )
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Крайна дата (
              <span className="text-slate-800 font-medium">
                {endDate
                  ? new Date(endDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "N/A"}
              </span>
              )
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <button
            onClick={handleDateFilterApply}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 sm:text-sm h-fit mt-auto md:mt-0"
          >
            Зареди отново
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader text="Зареждане на отзиви..." />
        </div>
      )}

      {!isLoading && feedbackList.length === 0 && (
        <div className="text-center py-10">
          <p className="text-slate-500 text-lg">
            Няма подадени отзиви за избрания период.
          </p>
        </div>
      )}

      {!isLoading && feedbackList.length > 0 && (
        <div className="space-y-6">
          {feedbackList.map((item) => {
            const deviceLabels =
              item.devices?.map((d) => d.label || "N/A").join("; ") ||
              "Не е посочено";
            const deviceLocations =
              item.devices?.map((d) => d.location || "N/A").join("; ") ||
              "Не е посочено";

            const sentimentColor =
              item.translated_vote?.toLowerCase().includes("положит") ||
              item.vote?.toLowerCase().includes("положит")
                ? "bg-green-50 border-l-4 border-green-500"
                : item.translated_vote?.toLowerCase().includes("отриц") ||
                  item.vote?.toLowerCase().includes("отриц")
                ? "bg-red-50 border-l-4 border-red-500"
                : "bg-slate-50 border-l-4 border-slate-300";

            return (
              <div
                key={item._id}
                className="bg-white shadow-md rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg"
              >
                <div className="bg-indigo-600 text-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <h3 className="text-lg font-semibold flex items-center">
                    {item.name ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {item.name}
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.035-.691-.1-1.021A5 5 0 0010 11z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Анонимен отзив
                      </>
                    )}
                  </h3>
                  <span className="text-sm bg-indigo-700 px-3 py-1 rounded-full mt-2 sm:mt-0 flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {formatDateTimeBG(item.date)}
                  </span>
                </div>

                {(item.email || item.phone) && (
                  <div className="px-4 py-2 bg-slate-100 flex flex-wrap gap-2">
                    {item.email && (
                      <span className="text-sm text-slate-600 flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        {item.email}
                      </span>
                    )}
                    {item.phone && (
                      <span className="text-sm text-slate-600 flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                        </svg>
                        {item.phone}
                      </span>
                    )}
                  </div>
                )}

                <div className="p-4 sm:p-6">
                  {(item.vote || item.translated_vote) && (
                    <div className={`${sentimentColor} p-3 rounded mb-4`}>
                      <p className="text-sm flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-medium">Общо усещане: </span>
                        <span className="ml-1">
                          {item.translated_vote || item.vote || "N/A"}
                        </span>
                      </p>
                    </div>
                  )}

                  {item.comment && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-slate-800 mb-2 flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-2 text-indigo-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Коментар:
                      </p>
                      <div className="bg-slate-50 p-4 rounded border border-slate-200">
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {item.comment}
                        </p>
                      </div>
                    </div>
                  )}

                  {item.questionsVoteToString && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-slate-800 mb-2 flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-2 text-indigo-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                        </svg>
                        Отговори на въпроси:
                      </p>
                      <div className="bg-slate-50 p-4 rounded border border-slate-200">
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {item.questionsVoteToString}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-slate-400 mt-0.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-slate-700">
                          Устройства:
                        </p>
                        <p className="text-xs text-slate-600">{deviceLabels}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-slate-400 mt-0.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-slate-700">
                          Локации:
                        </p>
                        <p className="text-xs text-slate-600">
                          {deviceLocations}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Предишна
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              disabled={currentPage === page}
              className={`px-3 py-1 text-sm font-medium border rounded-md transition-colors
                        ${
                          currentPage === page
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Следваща
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <FeedbackPageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
