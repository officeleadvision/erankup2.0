"use client";

import React from "react";
import {
  EyeIcon,
  EyeSlashIcon,
  ListBulletIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { formatDateBG } from "@/lib/formatDateBG";
import { Question } from "./SortableQuestionItem";

interface QuestionItemProps {
  question: Question;
  handleToggleHidden: (question: Question) => void;
  handleViewDevicesClick: (question: Question) => void;
  handleEditQuestionClick: (question: Question) => void;
  handleDeleteQuestionClick: (question: Question) => void;
  isSubmitting: boolean;
}

export default function QuestionItem({
  question,
  handleToggleHidden,
  handleViewDevicesClick,
  handleEditQuestionClick,
  handleDeleteQuestionClick,
  isSubmitting,
}: QuestionItemProps) {
  return (
    <div className="q-row border-b border-slate-200 bg-white px-3 py-3 hover:bg-slate-50 md:px-4">
      <div className="min-w-0 text-sm text-slate-800">
        {/* Long questions wrap to two lines instead of running into the next
            column; the full text stays available as a tooltip. */}
        <p className="line-clamp-2 break-words" title={question.question}>
          {question.question}
        </p>
      </div>

      <div className="text-sm text-slate-700 md:text-center">
        <span className="mr-2 font-medium text-slate-500 md:hidden">
          Дата:
        </span>
        {formatDateBG(question.date)}
      </div>

      <div className="text-sm text-slate-700 md:text-center">
        <span className="mr-2 font-medium text-slate-500 md:hidden">
          Поредност:
        </span>
        {question.order}
      </div>

      <div className="flex items-center md:justify-center">
        <span className="mr-2 text-sm font-medium text-slate-500 md:hidden">
          Видимост:
        </span>
        <button
          onClick={() => handleToggleHidden(question)}
          className={`rounded-full p-1 transition-colors hover:bg-slate-200 ${
            isSubmitting ? "cursor-not-allowed opacity-50" : ""
          }`}
          disabled={isSubmitting}
          title={question.hidden ? "Покажи въпроса" : "Скрий въпроса"}
        >
          {question.hidden ? (
            <EyeIcon className="h-5 w-5 text-green-500" />
          ) : (
            <EyeSlashIcon className="h-5 w-5 text-red-500" />
          )}
        </button>
      </div>

      <div className="flex items-center md:justify-center">
        <span className="mr-2 text-sm font-medium text-slate-500 md:hidden">
          Устройства:
        </span>
        <button
          onClick={() => handleViewDevicesClick(question)}
          className="inline-flex items-center gap-1 rounded-full p-1 text-sm text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
          title="Преглед на присвоени устройства"
        >
          <ListBulletIcon className="h-5 w-5" />({question.devices?.length || 0})
        </button>
      </div>

      <div className="flex items-center gap-1 md:justify-end">
        <button
          onClick={() => handleEditQuestionClick(question)}
          className="rounded-full p-1 text-indigo-600 transition-colors hover:bg-slate-100 hover:text-indigo-900"
          title="Редактирай въпрос"
        >
          <PencilIcon className="h-5 w-5" />
        </button>
        {!question.hidden && (
          <button
            onClick={() => handleDeleteQuestionClick(question)}
            className="rounded-full p-1 text-red-600 transition-colors hover:bg-slate-100 hover:text-red-900"
            title="Изтрий (скрий) въпрос"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
