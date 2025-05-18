"use client";

import React, { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl transform transition-all duration-300 ease-in-out w-[95%] sm:w-full m-2 sm:m-4 ${sizeClasses[size]} overflow-y-auto max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-3 sm:p-4 border-b border-slate-200 rounded-t">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-800 pr-6">
            {title}
          </h3>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 bg-transparent hover:bg-slate-100 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
          </button>
        </div>
        <div className="p-3 sm:p-5 space-y-4 text-slate-700">{children}</div>
      </div>
    </div>
  );
}
