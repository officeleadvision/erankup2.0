"use client";

import React, { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import AddDeviceForm from "@/components/devices/AddDeviceForm";
import EditDeviceForm from "@/components/devices/EditDeviceForm";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
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

const formatDateBG = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function DevicesPageContent() {
  const { token, godmode } = useAuth();
  const isGodMode = Boolean(godmode);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] =
    useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const fetchDevices = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await apiClient<{ devices: Device[] }>("/devices", {
        token,
      });
      setDevices(data.devices);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Неуспешно зареждане на устройства";
      toast.error(message);
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleAddDeviceClick = () => {
    if (!isGodMode) {
      toast.warning("Свържете се с вашия администратор");
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleDeviceAdded = () => {
    fetchDevices();
    setIsAddModalOpen(false);
  };

  const handleEditDeviceClick = (device: Device) => {
    setCurrentDevice(device);
    setIsEditModalOpen(true);
  };

  const handleDeviceUpdated = () => {
    fetchDevices();
    setIsEditModalOpen(false);
    setCurrentDevice(null);
  };

  const handleDeleteDeviceClick = (device: Device) => {
    if (!isGodMode) {
      toast.warning("Свържете се с вашия администратор");
      return;
    }
    setDeviceToDelete(device);
    setIsConfirmDeleteModalOpen(true);
  };

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete || !token) return;
    setIsSubmittingDelete(true);
    try {
      await apiClient(`/devices/${deviceToDelete._id}`, {
        method: "DELETE",
        token,
      });
      toast.success(
        `Устройството "${deviceToDelete.label}" беше изтрито успешно.`
      );
      setDevices(devices.filter((d) => d._id !== deviceToDelete._id));
      setIsConfirmDeleteModalOpen(false);
      setDeviceToDelete(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Неуспешно изтриване на устройство";
      toast.error(message);
    }
    setIsSubmittingDelete(false);
  };

  if (isLoading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader text="Зареждане на устройства..." />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">
          Управление на устройства
        </h2>
        <button
          onClick={handleAddDeviceClick}
          className={`flex items-center ${
            isGodMode
              ? "bg-indigo-600 hover:bg-indigo-700"
              : "bg-gray-400 cursor-not-allowed"
          } text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out`}
          title={
            isGodMode
              ? "Добави ново устройство"
              : "Свържете с вашия администратор"
          }
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Добави ново устройство
        </button>
      </div>

      {devices.length === 0 && !isLoading ? (
        <p className="text-slate-500 text-center py-10">
          Няма намерени устройства. Добавете първото си устройство!
        </p>
      ) : (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Етикет
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Местоположение
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Токен
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Добавено на
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {devices.map((device) => (
                <tr key={device._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {device.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {device.location || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                    {device.token}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {formatDateBG(device.dateOfPlacement)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center space-x-2">
                    <button
                      onClick={() => handleEditDeviceClick(device)}
                      className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-slate-100 transition-colors"
                      title="Редактирай"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDeviceClick(device)}
                      className={`${
                        isGodMode
                          ? "text-red-600 hover:text-red-900 hover:bg-slate-100"
                          : "text-gray-400 cursor-not-allowed"
                      } p-1 rounded-full transition-colors`}
                      title={
                        isGodMode ? "Изтрий" : "Свържете с вашия администратор"
                      }
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
        }}
        title="Добавяне на ново устройство"
      >
        <AddDeviceForm
          onSuccess={handleDeviceAdded}
          onCancel={() => {
            setIsAddModalOpen(false);
          }}
        />
      </Modal>

      {currentDevice && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setCurrentDevice(null);
          }}
          title={`Редактиране на устройство: ${currentDevice.label}`}
        >
          <EditDeviceForm
            device={currentDevice}
            onSuccess={handleDeviceUpdated}
            onCancel={() => {
              setIsEditModalOpen(false);
              setCurrentDevice(null);
            }}
          />
        </Modal>
      )}

      {deviceToDelete && (
        <Modal
          isOpen={isConfirmDeleteModalOpen}
          onClose={() => {
            setIsConfirmDeleteModalOpen(false);
            setDeviceToDelete(null);
          }}
          title="Потвърждение за изтриване"
        >
          <div className="p-4">
            <p className="text-sm text-gray-700 mb-4">
              Сигурни ли сте, че искате да изтриете устройството „
              <strong>{deviceToDelete.label}</strong>“? Това действие не може да
              бъде отменено.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsConfirmDeleteModalOpen(false);
                  setDeviceToDelete(null);
                }}
                disabled={isSubmittingDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Отказ
              </button>
              <button
                onClick={confirmDeleteDevice}
                disabled={isSubmittingDelete}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSubmittingDelete ? (
                  <Loader size="sm" />
                ) : (
                  <>
                    <TrashIcon className="h-5 w-5 mr-2" />
                    Изтрий
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function DevicesPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <DevicesPageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
