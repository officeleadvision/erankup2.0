"use client";

import React from "react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ size = "md", text, className }) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center w-full h-full ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`animate-spin rounded-full border-t-2 border-b-2 ${sizeClasses[size]} border-indigo-600`}
      ></div>
      {text && <p className="mt-3 text-sm text-slate-600">{text}</p>}
      <span className="sr-only">{text || "Зареждане..."}</span>
    </div>
  );
};

export default Loader;
