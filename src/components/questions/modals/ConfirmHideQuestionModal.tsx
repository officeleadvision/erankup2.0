"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import Loader from "@/components/ui/Loader";
import { TrashIcon } from "@heroicons/react/24/outline";

interface ConfirmHideQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  questionName: string;
  isSubmitting: boolean;
}

export default function ConfirmHideQuestionModal({
  isOpen,
  onClose,
  onConfirm,
  questionName,
  isSubmitting,
}: ConfirmHideQuestionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Потвърди Скриване на Въпрос"
    >
      <p className="text-sm text-slate-600">{`Наистина ли искате да скриете въпроса: "${questionName}"? Той няма да бъде видим за потребителите, но ще остане в системата.`}</p>
      <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
        <button
          type="button"
          className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:col-start-2 disabled:opacity-50"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader size="sm" /> : "Скрий Въпроса"}
        </button>
        <button
          type="button"
          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Отказ
        </button>
      </div>
    </Modal>
  );
}
