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

// Assuming Question and DeviceReference interfaces are defined in a shared types file or passed correctly
// For simplicity, defining them here if not already available globally or via import from a central types definition
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
    opacity: isDragging ? 0.8 : 1,
    position: "relative" as const, // Ensure position is a valid CSS property value
    boxShadow: isDragging ? "0 5px 15px rgba(0, 0, 0, 0.15)" : "none",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex flex-col md:flex-row items-start md:items-center w-full border-b border-slate-200 p-3 md:p-0 ${
        isDragging
          ? "bg-indigo-100 shadow-lg rounded-md"
          : "bg-white hover:bg-slate-50"
      }`}
    >
      <div
        className="flex-grow px-1 md:px-4 py-2 md:py-3 whitespace-normal md:whitespace-nowrap text-sm text-slate-800 w-full md:w-2/5 cursor-grab"
        {...listeners}
      >
        <BarsArrowUpIcon className="h-5 w-5 inline mr-2 text-slate-500" />
        {question.question}
      </div>
      <div className="flex flex-wrap md:flex-nowrap items-center justify-between w-full md:w-auto">
        <div className="px-1 md:px-4 py-1 md:py-3 text-sm text-slate-700 w-1/2 md:w-auto">
          <span className="inline-block md:hidden font-medium mr-2 text-slate-600">
            Дата:
          </span>
          {formatDateBG(question.date)}
        </div>
        <div className="px-1 md:px-4 py-1 md:py-3 text-sm text-slate-700 w-1/2 md:w-auto md:text-center">
          <span className="inline-block md:hidden font-medium mr-2 text-slate-600">
            Поредност:
          </span>
          {question.order}
        </div>
        <div className="px-1 md:px-4 py-1 md:py-3 text-sm w-1/3 md:w-auto">
          <button
            onClick={() => handleToggleHidden(question)}
            className={`p-1 rounded-full hover:bg-slate-200 transition-colors ${
              isSubmitting ? "opacity-50 cursor-not-allowed" : ""
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
        <div className="px-1 md:px-4 py-1 md:py-3 text-sm text-slate-700 w-1/3 md:w-auto">
          <button
            onClick={() => handleViewDevicesClick(question)}
            className="text-indigo-600 hover:text-indigo-700 p-1 rounded-full hover:bg-indigo-100 transition-colors"
            title="Преглед на присвоени устройства"
          >
            <ListBulletIcon className="h-5 w-5" /> (
            {question.devices?.length || 0})
          </button>
        </div>
        <div className="px-1 md:px-4 py-1 md:py-3 text-right text-sm font-medium space-x-2 w-1/3 md:w-auto">
          <button
            onClick={() => handleEditQuestionClick(question)}
            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-slate-100 transition-colors"
            title="Редактирай въпрос"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          {!question.hidden && (
            <button
              onClick={() => handleDeleteQuestionClick(question)}
              className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-slate-100 transition-colors"
              title="Изтрий (скрий) въпрос"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
