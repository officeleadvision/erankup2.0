"use client";

import React from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  ComputerDesktopIcon,
  QuestionMarkCircleIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  KeyIcon,
  ChatBubbleLeftEllipsisIcon,
} from "@heroicons/react/24/outline";

function DashboardHomePageContent() {
  const { username } = useAuth();

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 md:p-6 text-center flex flex-col justify-center items-center">
        <p className="text-xl text-slate-700 mb-4">
          Добре дошли във вашето erankup v2.0 Табло!
        </p>
        <p className="text-slate-600 mb-8">
          Изберете опция от менюто или от бързите връзки по-долу.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-4xl">
          <Link
            href="/dashboard/devices"
            className="flex flex-col items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-3 rounded-lg text-center transition duration-150 ease-in-out shadow-md hover:shadow-lg"
          >
            <ComputerDesktopIcon className="h-8 w-8 mb-2" />
            <span className="text-sm">Управление на устройства</span>
          </Link>
          <Link
            href="/dashboard/questions"
            className="flex flex-col items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-3 rounded-lg text-center transition duration-150 ease-in-out shadow-md hover:shadow-lg"
          >
            <QuestionMarkCircleIcon className="h-8 w-8 mb-2" />
            <span className="text-sm">Управление на въпроси</span>
          </Link>
          <Link
            href="/dashboard/feedback"
            className="flex flex-col items-center justify-center bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 px-3 rounded-lg text-center transition duration-150 ease-in-out shadow-md hover:shadow-lg"
          >
            <ChatBubbleLeftEllipsisIcon className="h-8 w-8 mb-2" />
            <span className="text-sm">Отзиви</span>
          </Link>
          <Link
            href="/dashboard/stats"
            className="flex flex-col items-center justify-center bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-3 rounded-lg text-center transition duration-150 ease-in-out shadow-md hover:shadow-lg"
          >
            <ChartBarIcon className="h-8 w-8 mb-2" />
            <span className="text-sm">Преглед на статистики</span>
          </Link>
          <Link
            href="/dashboard/export"
            className="flex flex-col items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-4 px-3 rounded-lg text-center transition duration-150 ease-in-out shadow-md hover:shadow-lg"
          >
            <ArrowDownTrayIcon className="h-8 w-8 mb-2" />
            <span className="text-sm">Експорт на данни</span>
          </Link>
          <Link
            href="/profile"
            className="flex flex-col items-center justify-center bg-slate-600 hover:bg-slate-700 text-white font-semibold py-4 px-3 rounded-lg text-center transition duration-150 ease-in-out shadow-md hover:shadow-lg"
          >
            <KeyIcon className="h-8 w-8 mb-2" />
            <span className="text-sm">Смяна на парола</span>
          </Link>
        </div>
      </div>
      {/* Conditional Banner Display */}
      {username === "protect_hold" && (
        <div className="w-full mb-6 rounded-lg overflow-hidden">
          <img
            src="/banners/banner.jpg"
            alt="Protect Hold Banner"
            className="w-full"
          />
        </div>
      )}
      {username === "enclean" && (
        <div className="w-full mb-6 rounded-lg overflow-hidden">
          <img
            src="/banners/enclean.jpg"
            alt="Enclean Banner"
            className="w-full"
          />
        </div>
      )}
      {username === "hotel_botevgrad" && (
        <div className="w-full mb-6 rounded-lg overflow-hidden">
          <img
            src="/banners/hotel_botevgrad.jpg"
            alt="Hotel Botevgrad Banner"
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <DashboardHomePageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
