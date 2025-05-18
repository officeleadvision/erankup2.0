"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import { DeviceReference } from "@/components/questions/items/SortableQuestionItem"; // Reuse interface

interface ViewDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionName: string;
  devices: DeviceReference[];
}

export default function ViewDevicesModal({
  isOpen,
  onClose,
  questionName,
  devices,
}: ViewDevicesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Устройства за Въпрос: "${questionName}"`}
    >
      <p className="text-sm text-slate-600">
        Списък на устройствата, към които е присвоен този въпрос.
      </p>
      {devices.length > 0 ? (
        <ul className="mt-2 list-disc list-inside space-y-1">
          {devices.map((device) => (
            <li key={device._id} className="text-sm text-slate-700">
              {device.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Няма присвоени устройства към този въпрос.
        </p>
      )}
      <div className="mt-5 sm:mt-6">
        <button
          type="button"
          className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          onClick={onClose}
        >
          Затвори
        </button>
      </div>
    </Modal>
  );
}
