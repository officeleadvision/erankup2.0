"use client";

import React, { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import apiClient from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";

interface LoginFormProps {
  onSuccess?: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient<{
        success: boolean;
        token: string;
        message?: string;
      }>("/authenticate", {
        method: "POST",
        body: { username: identifier, password },
      });

      if (response.success && response.token) {
        login(response.token);
        let redirectTo = "/dashboard";
        try {
          const decoded = JSON.parse(atob(response.token.split(".")[1]));
          if (decoded?.godmode) {
            redirectTo = "/dashboard?godmode=true";
          }
        } catch (parseError) {
          console.error("Failed to decode token", parseError);
        }
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(redirectTo);
        }
      } else {
        setError(
          response.message ||
            "Неуспешен вход. Моля, проверете въведените данни."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Възникна неочаквана грешка."
      );
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium leading-6 text-gray-700 dark:text-gray-300"
        >
          Потребителско име или акаунт
        </label>
        <div className="mt-2">
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value.toLowerCase())}
            className="block w-full px-4 py-2.5 rounded-xl border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-700/50 dark:text-white dark:ring-slate-600 dark:placeholder:text-gray-500 dark:focus:ring-indigo-500"
            placeholder="потребител или акаунт"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium leading-6 text-gray-700 dark:text-gray-300"
          >
            Парола
          </label>
        </div>
        <div className="mt-2">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full px-4 py-2.5 rounded-xl border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-700/50 dark:text-white dark:ring-slate-600 dark:placeholder:text-gray-500 dark:focus:ring-indigo-500"
            placeholder="••••••••"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
          <div className="flex">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {error}
            </p>
          </div>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="relative w-full flex justify-center items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-sm transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 disabled:pointer-events-none overflow-hidden group"
        >
          <span className="relative z-10">
            {isLoading ? "Влизане..." : "Вход"}
          </span>
          <span className="absolute inset-0 h-full w-full bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
        </button>
      </div>
    </form>
  );
}
