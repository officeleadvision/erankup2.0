"use client";

import React, { useState, FormEvent, useEffect } from "react";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Select, { MultiValue } from "react-select";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";

interface DeviceOption {
  _id: string;
  label: string;
}

interface DevicesApiResponse {
  success: boolean;
  devices: DeviceOption[];
  message?: string;
}

interface Question {
  _id: string;
  question: string;
  devices: { _id: string; label: string }[];
  hidden: boolean;
  order: number;
  date: string;
  username: string;
}

interface EditQuestionFormProps {
  questionToEdit: Question;
  onSuccess: (updatedQuestion: Question) => void;
  onCancel: () => void;
}

export default function EditQuestionForm({
  questionToEdit,
  onSuccess,
  onCancel,
}: EditQuestionFormProps) {
  const [currentQuestionText, setCurrentQuestionText] = useState(
    questionToEdit.question
  );
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(
    questionToEdit.devices.map((d) => d._id)
  );
  const [isHidden, setIsHidden] = useState(questionToEdit.hidden);
  const [availableDevices, setAvailableDevices] = useState<DeviceOption[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    token,
    isLoading: isLoadingAuth,
    isInitialized: isAuthInitialized,
  } = useAuth();

  useEffect(() => {
    setCurrentQuestionText(questionToEdit.question);
    setSelectedDeviceIds(questionToEdit.devices.map((d) => d._id));
    setIsHidden(questionToEdit.hidden);
  }, [questionToEdit]);

  useEffect(() => {
    if (!isAuthInitialized || isLoadingAuth) {
      setIsLoadingDevices(true);
      return;
    }

    if (token) {
      setIsLoadingDevices(true);
      apiClient<DevicesApiResponse>("/devices", { token })
        .then((data) => {
          if (data && data.devices) {
            setAvailableDevices(data.devices);
          } else {
            setAvailableDevices([]);
          }
        })
        .catch((err) => {
          toast.error(
            err.message ||
              "Неуспешно зареждане на устройства. Моля, опитайте отново."
          );
          setAvailableDevices([]);
        })
        .finally(() => setIsLoadingDevices(false));
    } else {
      toast.warn("Необходима е автентикация за зареждане на устройства.");
      setAvailableDevices([]);
      setIsLoadingDevices(false);
    }
  }, [token, isLoadingAuth, isAuthInitialized, questionToEdit._id]);

  const handleDeviceSelectionChange = (
    selectedOptions: MultiValue<{ value: string; label: string }>
  ) => {
    setSelectedDeviceIds(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isAuthInitialized || isLoadingAuth) {
      toast.warn(
        "Статусът на автентикацията се зарежда. Моля, опитайте отново след малко."
      );
      return;
    }
    if (!token) {
      toast.error(
        "Необходима е автентикация. Сесията ви може да е невалидна. Моля, опитайте да излезете и да влезете отново."
      );
      return;
    }

    if (!currentQuestionText.trim()) {
      toast.error("Текстът на въпроса е задължителен.");
      return;
    }
    if (selectedDeviceIds.length === 0) {
      toast.error("Трябва да бъде избрано поне едно устройство.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedQuestionData = {
        question: currentQuestionText,
        deviceIds: selectedDeviceIds,
        hidden: isHidden,
      };

      const response = await apiClient<{
        success: boolean;
        question: Question;
        message?: string;
      }>(`/questions/${questionToEdit._id}`, {
        method: "PUT",
        body: updatedQuestionData,
        token,
      });

      if (response.success && response.question) {
        onSuccess(response.question);
        toast.success("Въпросът е актуализиран успешно!");
      } else {
        const message =
          response.message ||
          "Неуспешно актуализиране на въпроса. Моля, опитайте отново.";
        toast.error(message);
      }
    } catch (err) {
      let errorMessage = "Възникна неочаквана грешка.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err && "message" in err) {
        errorMessage = (err as { message: string }).message;
      }

      const status = (err as any)?.response?.status || (err as any)?.status;
      if (status === 401) {
        toast.error("Неуспешна автентикация. Моля, влезте отново.");
      } else {
        toast.error(errorMessage);
      }
    }
    setIsSubmitting(false);
  };

  if (!isAuthInitialized || isLoadingAuth) {
    return <Loader text="Зареждане на формуляр..." />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <div>
        <label
          htmlFor="editQuestionText"
          className="block text-sm font-medium text-gray-700"
        >
          Текст на въпроса <span className="text-red-500">*</span>
        </label>
        <textarea
          id="editQuestionText"
          name="editQuestionText"
          rows={3}
          required
          value={currentQuestionText}
          onChange={(e) => setCurrentQuestionText(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          disabled={isLoadingAuth || !isAuthInitialized}
        />
      </div>

      <div>
        <label
          htmlFor="editDevices"
          className="block text-sm font-medium text-gray-700"
        >
          Прикачи към устройства <span className="text-red-500">*</span>
        </label>
        {isLoadingAuth || !isAuthInitialized ? (
          <p className="text-sm text-slate-500">Автентикация...</p>
        ) : isLoadingDevices ? (
          <Loader size="sm" text="Зареждане на устройства..." />
        ) : availableDevices.length === 0 && !token ? (
          <p className="text-sm text-red-500">
            Необходима е автентикация за зареждане на устройства.
          </p>
        ) : availableDevices.length === 0 ? (
          <p className="text-sm text-slate-500">
            Няма налични устройства. Моля, първо добавете устройства.
          </p>
        ) : (
          <Select
            id="editDevices"
            name="editDevices"
            isMulti
            value={availableDevices
              .filter((device) => selectedDeviceIds.includes(device._id))
              .map((d) => ({ value: d._id, label: d.label }))}
            onChange={handleDeviceSelectionChange}
            options={availableDevices.map((device) => ({
              value: device._id,
              label: device.label,
            }))}
            className="mt-1 block w-full sm:text-sm react-select-container"
            classNamePrefix="react-select"
            isDisabled={isLoadingDevices || availableDevices.length === 0}
            placeholder="Изберете устройства..."
            noOptionsMessage={() => "Няма налични устройства"}
          />
        )}
        <p className="mt-1 text-xs text-gray-500">
          Задръжте Ctrl (или Cmd на Mac), за да изберете няколко устройства.
        </p>
      </div>

      <div className="flex items-center">
        <input
          id="editIsHidden"
          name="editIsHidden"
          type="checkbox"
          checked={isHidden}
          onChange={(e) => setIsHidden(e.target.checked)}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          disabled={isLoadingAuth || !isAuthInitialized}
        />
        <label
          htmlFor="editIsHidden"
          className="ml-2 block text-sm text-gray-900"
        >
          Скрий този въпрос (няма да се показва на устройствата)
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <XCircleIcon className="h-5 w-5 mr-2" />
          Отказ
        </button>
        <button
          type="submit"
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          disabled={isSubmitting || isLoadingAuth || isLoadingDevices}
        >
          {isSubmitting ? <Loader size="sm" /> : "Запази промените"}
        </button>
      </div>
    </form>
  );
}
