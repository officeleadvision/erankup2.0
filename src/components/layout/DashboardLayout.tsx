"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  HomeIcon,
  ComputerDesktopIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftEllipsisIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type NavigationItem = {
  name: string;
  href: string;
  icon: typeof HomeIcon;
  requiresAdmin?: boolean;
};

const navigation: NavigationItem[] = [
  { name: "Табло", href: "/dashboard", icon: HomeIcon },
  { name: "Устройства", href: "/dashboard/devices", icon: ComputerDesktopIcon },
  {
    name: "Въпроси",
    href: "/dashboard/questions",
    icon: QuestionMarkCircleIcon,
  },
  {
    name: "Отзиви",
    href: "/dashboard/feedback",
    icon: ChatBubbleLeftEllipsisIcon,
  },
  { name: "Статистики", href: "/dashboard/stats", icon: ChartBarIcon },
  { name: "Експорт", href: "/dashboard/export", icon: ArrowDownTrayIcon },
  {
    name: "Потребители",
    href: "/dashboard/users",
    icon: UsersIcon,
    requiresAdmin: true,
  },
  { name: "Логове", href: "/dashboard/logs", icon: ClipboardDocumentListIcon },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { username, logout, admin } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const visibleNavigation = useMemo(
    () =>
      navigation.filter((item) => (item.requiresAdmin ? admin : true)),
    [admin]
  );

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex">
      <div
        className={`w-64 bg-slate-800 text-slate-100 flex flex-col shadow-lg h-screen overflow-y-auto fixed top-0 left-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="erankup1 Logo"
              width={80}
              height={80}
              priority
              className="h-auto w-auto"
            />
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 p-1 rounded-md"
            aria-label="Close menu"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <nav className="mt-4 flex-1 px-2 space-y-1">
          {visibleNavigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
              className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150 ease-in-out ${
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))
                    ? "text-white"
                    : "text-slate-400 group-hover:text-slate-200"
                }`}
              />
              {item.name}
            </Link>
          ))}
        </nav>
        {username && (
          <div className="px-2 py-3 border-t border-slate-700">
            <Link
              href="/profile"
              onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}
              className="block px-2 py-2 rounded-md hover:bg-slate-700 group"
            >
              <div className="flex items-center">
                <UserCircleIcon className="h-8 w-8 text-indigo-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {username}
                  </p>
                  <p className="text-xs text-slate-400">Смяна на парола</p>
                </div>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="mt-2 w-full group flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-red-300 hover:bg-red-600 hover:text-white transition-all duration-150 ease-in-out"
            >
              <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 flex-shrink-0 text-red-400 group-hover:text-white" />
              Изход
            </button>
          </div>
        )}
      </div>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <header className="bg-slate-800 shadow-sm">
          <div className="mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center md:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="mobile-menu"
                >
                  <span className="sr-only">Open main menu</span>
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 flex justify-center md:justify-start">
                <h1 className="text-xl md:text-2xl font-bold text-slate-100 ml-2 md:ml-0 truncate">
                  {navigation.find(
                    (nav) =>
                      pathname === nav.href ||
                      (nav.href !== "/dashboard" &&
                        pathname.startsWith(nav.href))
                  )?.name || "Табло"}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto bg-white">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
