"use client";

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import apiClient from "@/lib/apiClient";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";
import Modal from "@/components/ui/Modal";
import {
  ArrowPathIcon,
  KeyIcon,
  LockClosedIcon,
  LockOpenIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

type ManagedUser = {
  id: string;
  username: string;
  account: string;
  admin: boolean;
  moderator: boolean;
  blocked: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function UsersPageContent() {
  const { token, admin, moderator, username, loginUsername } = useAuth();
  const canManageUsers = Boolean(token && admin);
  const canManageModerator = Boolean(admin);
  const currentLogin = loginUsername?.toLowerCase() ?? null;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutationUserId, setMutationUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserAlias, setNewUserAlias] = useState("");
  const [newUserAdmin, setNewUserAdmin] = useState(false);
  const [newUserModerator, setNewUserModerator] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const accountAlias = useMemo(() => username ?? "", [username]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const fetchUsers = useCallback(
    async (query: string, { background }: { background?: boolean } = {}) => {
      if (!token || !canManageUsers) {
        setUsers([]);
        setIsLoading(false);
        return;
      }

      if (background) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (query) {
          params.append("search", query);
        }
        const endpoint = `/users${params.toString() ? `?${params}` : ""}`;
        const response = await apiClient<{
          success: boolean;
          users: ManagedUser[];
        }>(endpoint, {
          method: "GET",
          token,
        });
        if (response.success) {
          setUsers(response.users || []);
        } else {
          setUsers([]);
          setError("Неуспешно зареждане на потребителите.");
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Неуспешно зареждане на потребителите.";
        setError(message);
        setUsers([]);
      } finally {
        if (background) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [token, canManageUsers]
  );

  useEffect(() => {
    fetchUsers(debouncedSearch);
  }, [debouncedSearch, fetchUsers]);

  const handleRefresh = () => {
    fetchUsers(debouncedSearch, { background: true });
  };

  const handleToggleRole = async (
    user: ManagedUser,
    field: "admin" | "moderator"
  ) => {
    if (field === "moderator" && !canManageModerator) {
      toast.warn("Само Admin акаунт може да променя този флаг.");
      return;
    }
    if (user.moderator && !canManageModerator) {
      toast.warn("Само Admin акаунт може да управлява този потребител.");
      return;
    }
    if (!token) return;
    setMutationUserId(user.id);
    try {
      const response = await apiClient<{
        success: boolean;
        user?: ManagedUser;
      }>(`/users/${user.id}`, {
        method: "PATCH",
        token,
        body: { [field]: !user[field] },
      });

      if (!response.success || !response.user) {
        throw new Error("Неуспешно обновяване на потребителя.");
      }

      setUsers((prev) =>
        prev.map((existing) =>
          existing.id === response.user?.id ? response.user : existing
        )
      );
      toast.success(
        field === "admin"
          ? `${user.username} ${
              response.user.admin ? "вече е" : "вече не е"
            } администратор.`
          : `${user.username} ${
              response.user.moderator ? "има" : "няма"
            } активиран Moderator.`
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Неуспешно обновяване на потребителя.";
      toast.error(message);
    } finally {
      setMutationUserId(null);
    }
  };

  const handleResetPassword = async (user: ManagedUser) => {
    if (!token) return;
    if (user.moderator && !canManageModerator) {
      toast.warn("Само Admin акаунт може да управлява този потребител.");
      return;
    }

    setMutationUserId(user.id);
    try {
      const response = await apiClient<{
        success: boolean;
        message?: string;
      }>(`/users/${user.id}/reset-link`, {
        method: "POST",
        token,
      });

      if (!response.success) {
        throw new Error(
          response.message || "Неуспешно изпращане на връзка за парола."
        );
      }

      toast.success(
        response.message ||
          `Изпратена е връзка за смяна на парола към ${user.username}.`
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Неуспешно изпращане на връзка за парола.";
      toast.error(message);
    } finally {
      setMutationUserId(null);
    }
  };

  const handleToggleBlocked = async (user: ManagedUser) => {
    if (!token) return;
    if (user.moderator && !canManageModerator) {
      toast.warn("Само Admin акаунт може да управлява този потребител.");
      return;
    }
    if (currentLogin && user.username.toLowerCase() === currentLogin) {
      toast.warn("Не можете да блокирате собствения си акаунт.");
      return;
    }
    setMutationUserId(user.id);
    try {
      const response = await apiClient<{
        success: boolean;
        user?: ManagedUser;
      }>(`/users/${user.id}`, {
        method: "PATCH",
        token,
        body: { blocked: !user.blocked },
      });

      if (!response.success || !response.user) {
        throw new Error("Неуспешно обновяване на достъпа.");
      }

      setUsers((prev) =>
        prev.map((existing) =>
          existing.id === response.user?.id ? response.user : existing
        )
      );

      toast.success(
        response.user.blocked
          ? `${user.username} е блокиран.`
          : `${user.username} отново има достъп.`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Неуспешно обновяване на достъпа.";
      toast.error(message);
    } finally {
      setMutationUserId(null);
    }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    if (!token) return;
    if (user.moderator && !canManageModerator) {
      toast.warn("Само Admin акаунт може да управлява този потребител.");
      return;
    }
    if (currentLogin && user.username.toLowerCase() === currentLogin) {
      toast.warn("Не можете да изтриете собствения си акаунт.");
      return;
    }
    const confirmed = window.confirm(
      `Сигурни ли сте, че искате да изтриете ${user.username}?`
    );
    if (!confirmed) return;

    setMutationUserId(user.id);
    try {
      const response = await apiClient<{
        success: boolean;
        message?: string;
      }>(`/users/${user.id}`, {
        method: "DELETE",
        token,
      });

      if (!response.success) {
        throw new Error(response.message || "Неуспешно изтриване.");
      }

      setUsers((prev) => prev.filter((existing) => existing.id !== user.id));
      toast.success(
        response.message || `Потребителят ${user.username} беше изтрит.`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Неуспешно изтриване.";
      toast.error(message);
    } finally {
      setMutationUserId(null);
    }
  };

  const openCreateModal = () => {
    setNewUserEmail("");
    setNewUserAlias(accountAlias);
    setNewUserAdmin(false);
    setNewUserModerator(false);
    setIsCreateModalOpen(true);
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      toast.error("Липсва токен за удостоверяване.");
      return;
    }

    const trimmedEmail = newUserEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error("Моля, въведете имейл адрес.");
      return;
    }

    setIsCreatingUser(true);
    try {
      const response = await apiClient<{
        success: boolean;
        message?: string;
        user?: ManagedUser;
      }>(`/users`, {
        method: "POST",
        token,
        body: {
          username: trimmedEmail,
          accountAlias: newUserAlias.trim().toLowerCase(),
          admin: newUserAdmin,
          moderator: canManageModerator ? newUserModerator : false,
        },
      });

      if (!response.success) {
        throw new Error(
          response.message || "Неуспешно създаване на потребител."
        );
      }

      toast.success(
        response.message || "Потребителят беше създаден и изпратен имейл."
      );
      setIsCreateModalOpen(false);
      await fetchUsers(debouncedSearch);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Неуспешно създаване на потребител.";
      toast.error(message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (!canManageUsers) {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">
          Нямате достъп до управление на потребители
        </h2>
        <p className="text-sm text-slate-600">
          Само администратори могат да управляват потребителите в акаунта.
          Свържете се с администратор, ако смятате, че това е грешка.
        </p>
      </div>
    );
  }

  const blockedCount = users.filter((user) => user.blocked).length;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500 uppercase tracking-wide">
              Акаунт: <span className="text-slate-900">{username}</span>
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              Управление на потребители
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Преглеждайте и управлявайте правата на всички потребители във
              вашия акаунт.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon
                className={`h-5 w-5 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Обнови
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
            >
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Нов потребител
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase text-slate-500">Общо потребители</p>
            <p className="text-2xl font-semibold text-slate-900">
              {users.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase text-slate-500">Администратори</p>
            <p className="text-2xl font-semibold text-slate-900">
              {users.filter((user) => user.admin).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase text-slate-500">Moderator</p>
            <p className="text-2xl font-semibold text-slate-900">
              {users.filter((user) => user.moderator).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase text-slate-500">Блокирани</p>
            <p className="text-2xl font-semibold text-slate-900">
              {blockedCount}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex-1">
            <label
              htmlFor="searchUsers"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Търси потребители
            </label>
            <input
              id="searchUsers"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Потърси по потребителско име или акаунт"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-16">
            <Loader text="Зареждане на потребители..." />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            Няма намерени потребители. Създайте нов акаунт, за да започнете.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Потребител
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Акаунт
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Роли
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Създаден
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Обновен
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {users.map((user) => {
                  const isBusy = mutationUserId === user.id;
                  const isSelfUser =
                    currentLogin &&
                    user.username.toLowerCase() === currentLogin;
                  const canManageTarget = canManageModerator || !user.moderator;
                  const dangerDisabled =
                    Boolean(isSelfUser) || isBusy || !canManageTarget;
                  return (
                    <tr key={user.id}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {user.username}
                        </p>
                        <p className="text-xs text-slate-500 break-all">
                          {user.id}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          <ShieldCheckIcon className="h-4 w-4 text-indigo-500" />
                          {user.account}
                        </span>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            user.admin
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          Администратор
                        </span>
                        <span
                          className={`ml-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            user.moderator
                              ? "bg-purple-100 text-purple-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          Moderator
                        </span>
                        {user.blocked && (
                          <span className="ml-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-rose-100 text-rose-700">
                            Блокиран
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDateTime(user.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleToggleRole(user, "admin")}
                            disabled={isBusy || !canManageTarget}
                            title={
                              !canManageTarget
                                ? "Само Admin акаунт може да управлява този потребител."
                                : undefined
                            }
                            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              user.admin
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            } ${
                              isBusy || !canManageTarget
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <ShieldCheckIcon className="h-4 w-4 mr-1" />
                            {user.admin ? "Премахни Админ" : "Направи Админ"}
                          </button>
                          <button
                            onClick={() => handleToggleRole(user, "moderator")}
                            disabled={isBusy || !canManageModerator}
                            title={
                              !canManageModerator
                                ? "Само Admin акаунт може да управлява този потребител."
                                : undefined
                            }
                            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              user.moderator
                                ? "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            } ${
                              isBusy || !canManageModerator
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <SparklesIcon className="h-4 w-4 mr-1" />
                            {user.moderator
                              ? "Изключи Moderator"
                              : "Активирай Moderator"}
                          </button>
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={isBusy}
                            className={`inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 ${
                              isBusy ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          >
                            <KeyIcon className="h-4 w-4 mr-1" />
                            Нова парола
                          </button>
                          <button
                            onClick={() => handleToggleBlocked(user)}
                            disabled={dangerDisabled}
                            title={
                              !canManageTarget
                                ? "Само Admin акаунт може да управлява този потребител."
                                : isSelfUser
                                ? "Не можете да блокирате собствения си акаунт."
                                : undefined
                            }
                            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              user.blocked
                                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            } ${
                              dangerDisabled
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            {user.blocked ? (
                              <LockOpenIcon className="h-4 w-4 mr-1" />
                            ) : (
                              <LockClosedIcon className="h-4 w-4 mr-1" />
                            )}
                            {user.blocked
                              ? "Активирай достъп"
                              : "Блокирай достъп"}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={dangerDisabled}
                            title={
                              !canManageTarget
                                ? "Само Admin акаунт може да управлява този потребител."
                                : isSelfUser
                                ? "Не можете да изтриете собствения си акаунт."
                                : undefined
                            }
                            className={`inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 ${
                              dangerDisabled
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />
                            Изтрий
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !isCreatingUser && setIsCreateModalOpen(false)}
        title="Създаване на нов потребител"
        size="lg"
      >
        <form className="space-y-5" onSubmit={handleCreateUser}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Имейл / Потребителско име
            </label>
            <input
              type="email"
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Акаунт / Организация
            </label>
            <input
              type="text"
              value={newUserAlias}
              onChange={(event) => setNewUserAlias(event.target.value)}
              disabled={!canManageModerator}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="account"
            />
            {!canManageModerator && (
              <p className="text-xs text-slate-500 mt-1">
                Само Admin акаунт може да променя общото име на акаунта.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newUserAdmin}
                onChange={(event) => setNewUserAdmin(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Администратор
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newUserModerator}
                onChange={(event) => setNewUserModerator(event.target.checked)}
                disabled={!canManageModerator}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:text-slate-400 disabled:bg-slate-100"
              />
              <span className="text-sm font-medium text-slate-700">
                Moderator
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => !isCreatingUser && setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              disabled={isCreatingUser}
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={isCreatingUser}
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-60"
            >
              {isCreatingUser ? "Създаване..." : "Създай потребител"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <UsersPageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
