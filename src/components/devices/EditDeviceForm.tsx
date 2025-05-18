"use client";

import React, { useState, FormEvent, useEffect } from "react";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";

interface Device {
  _id: string;
  label: string;
  location?: string;
  token: string;
  dateOfPlacement: string;
  owner: string;
}

interface EditDeviceFormProps {
  device: Device;
  onSuccess: (updatedDevice: Device) => void;
  onCancel: () => void;
}

export default function EditDeviceForm({
  device,
  onSuccess,
  onCancel,
}: EditDeviceFormProps) {
  const [label, setLabel] = useState(device.label);
  const [location, setLocation] = useState(device.location || "");
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    setLabel(device.label);
    setLocation(device.location || "");
  }, [device]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (!label.trim()) {
      toast.error("Етикетът на устройството е задължителен.");
      setIsLoading(false);
      return;
    }

    try {
      const updatedData = { label, location };
      const response = await apiClient<{
        success: boolean;
        device: Device;
        message?: string;
      }>(`/devices/${device._id}`, {
        method: "PUT",
        body: updatedData,
        token,
      });

      if (response.success && response.device) {
        toast.success(`Устройството "${label}" беше актуализирано успешно.`);
        onSuccess(response.device);
      } else {
        const message =
          response.message ||
          "Неуспешно актуализиране на устройство или получаване на пълни данни за устройството.";
        toast.error(message);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Възникна неочаквана грешка.";
      toast.error(message);
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <div>
        <label
          htmlFor="editDeviceLabel"
          className="block text-sm font-medium text-gray-700"
        >
          Етикет на устройството <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="editDeviceLabel"
          id="editDeviceLabel"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="editDeviceLocation"
          className="block text-sm font-medium text-gray-700"
        >
          Местоположение (опционално)
        </label>
        <input
          type="text"
          name="editDeviceLocation"
          id="editDeviceLocation"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <XCircleIcon className="h-5 w-5 mr-2" />
          Отказ
        </button>
        <button
          type="submit"
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader size="sm" />
          ) : (
            <>
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              Запази промените
            </>
          )}
        </button>
      </div>
    </form>
  );
}
