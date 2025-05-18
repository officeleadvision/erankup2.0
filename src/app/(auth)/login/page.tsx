"use client";

import LoginForm from "@/components/auth/LoginForm";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 flex flex-col justify-center relative overflow-hidden py-6 sm:py-12">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[url(/globe.svg)] bg-center [mask-image:radial-gradient(closest-side,white,transparent)] dark:bg-slate-900 opacity-10"></div>
      <div className="absolute top-0 left-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob"></div>
      <div className="absolute bottom-0 right-0 translate-y-1/4 -translate-x-1/4 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-2000"></div>

      <div className="relative flex flex-col items-center">
        <Link href="/" className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="erankup1 лого"
            width={120}
            height={120}
            className="drop-shadow-md"
          />
        </Link>

        <div className="w-full max-w-md p-8 space-y-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-gray-900/5 dark:ring-white/10">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-indigo-900 dark:text-white">
              Вход в системата
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Въведете вашите данни за достъп
            </p>
          </div>

          <LoginForm />

          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              ← Обратно към началната страница
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 erankup1. Всички права запазени.</p>
        </div>
      </div>
    </div>
  );
}
