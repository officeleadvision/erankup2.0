"use client";

import React, { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";

const ProfilePage = () => {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (newPassword !== confirmPassword) {
      toast.error("Новите пароли не съвпадат.");
      setIsSubmitting(false);
      return;
    }

    if (!currentPassword || !newPassword) {
      toast.error("Всички полета за парола са задължителни.");
      setIsSubmitting(false);
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Новата парола трябва да бъде поне 6 символа.");
      setIsSubmitting(false);
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/change-password", {
        method: "POST",
        headers,
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Неуспешна промяна на паролата.");
      } else {
        toast.success(data.message || "Паролата е променена успешно!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      toast.error("Възникна неочаквана грешка. Моля, опитайте отново.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-0 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center text-slate-800">
          Профил
        </h1>

        <div className="bg-white shadow-xl rounded-lg p-4 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-slate-700">
            Промяна на Паролата
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1"
                htmlFor="currentPassword"
              >
                Текуща Парола
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 sm:text-sm placeholder-slate-400"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1"
                htmlFor="newPassword"
              >
                Нова Парола
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 sm:text-sm placeholder-slate-400"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1"
                htmlFor="confirmPassword"
              >
                Потвърди Нова Парола
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 sm:text-sm placeholder-slate-400"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-colors"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader size="sm" /> : "Промяна на Паролата"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
