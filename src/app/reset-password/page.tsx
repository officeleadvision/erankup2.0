"use client";

import React, { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setStatus({
        type: "error",
        message: "Липсва токен за смяна на паролата.",
      });
      return;
    }
    setStatus({ type: null, message: "" });
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/user/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
          newPasswordAgain: confirmPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Неуспешна смяна на паролата.");
      }

      setStatus({
        type: "success",
        message:
          data?.message ||
          "Паролата е сменена успешно. Можете да влезете с новата парола.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Неуспешна смяна на паролата.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-slate-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl ring-1 ring-indigo-50 p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Смяна на парола
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Въведете новата си парола, за да получите достъп до erankup1.
          </p>
        </div>

        {status.type && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {status.message}
          </div>
        )}

        {!token && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Липсва валиден токен за смяна на парола. Моля, използвайте линка от
            последния имейл.
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-semibold text-slate-700"
            >
              Нова парола
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-semibold text-slate-700"
            >
              Повтори новата парола
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !token}
            className="w-full rounded-2xl bg-indigo-600 text-white font-semibold py-3 shadow-lg shadow-indigo-200 hover:bg-indigo-500 transition disabled:opacity-60 disabled:pointer-events-none"
          >
            {isSubmitting ? "Записване..." : "Запази новата парола"}
          </button>
        </form>

        <div className="text-center text-sm text-slate-500">
          <Link href="/login" className="text-indigo-600 hover:text-indigo-500">
            ← Назад към вход
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-slate-100 px-4 py-10">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl ring-1 ring-indigo-50 p-8 text-center space-y-4">
            <div className="h-12 w-12 mx-auto rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
            <p className="text-sm text-slate-500">Зареждане на страницата...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

