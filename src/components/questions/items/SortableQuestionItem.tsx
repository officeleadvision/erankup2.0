"use client";

import React from "react";
import {
  EyeIcon,
  EyeSlashIcon,
  ListBulletIcon,
  PencilIcon,
  TrashIcon,
  BarsArrowUpIcon,
} from "@heroicons/react/24/outline";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDateBG } from "@/lib/formatDateBG";

export interface DeviceReference {
  _id: string;
  label: string;
}

export interface Question {
  _id: string;
  question: string;
  devices: DeviceReference[];
  hidden: boolean;
  order: number;
  date: string;
  username: string;
}

interface SortableQuestionItemProps {
  question: Question;
  handleToggleHidden: (question: Question) => void;
  handleViewDevicesClick: (question: Question) => void;
  handleEditQuestionClick: (question: Question) => void;
  handleDeleteQuestionClick: (question: Question) => void;
  isSubmitting: boolean;
}

export default function SortableQuestionItem({
  question,
  handleToggleHidden,
  handleViewDevicesClick,
  handleEditQuestionClick,
  handleDeleteQuestionClick,
  isSubmitting,
}: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : "auto",
    opacity: isDragging ? 0.85 : 1,
    position: "relative" as const,
    boxShadow: isDragging ? "0 8px 20px rgba(15, 23, 42, 0.18)" : "none",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`q-row border-b border-slate-200 px-3 py-3 md:px-4 ${
        isDragging
          ? "rounded-md bg-indigo-50"
          : "bg-white hover:bg-slate-50"
      }`}
    >
      <div
        className="flex min-w-0 cursor-grab items-start gap-2 text-sm text-slate-800 select-none active:cursor-grabbing"
        {...listeners}
      >
        <BarsArrowUpIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
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
