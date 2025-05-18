"use client";

import React, { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import AddQuestionForm from "@/components/questions/AddQuestionForm";
import EditQuestionForm from "@/components/questions/EditQuestionForm";
import SortableQuestionItem, {
  Question,
  DeviceReference,
} from "@/components/questions/items/SortableQuestionItem";
import QuestionItem from "@/components/questions/items/QuestionItem";
import ConfirmHideQuestionModal from "@/components/questions/modals/ConfirmHideQuestionModal";
import ViewDevicesModal from "@/components/questions/modals/ViewDevicesModal";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ListBulletIcon,
  BarsArrowUpIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Loader from "@/components/ui/Loader";
import { toast } from "react-toastify";

interface QuestionsApiResponse {
  success: boolean;
  questions: Question[];
  message?: string;
}

interface Device {
  _id: string;
  label: string;
}

interface QuestionUpdateData {
  hidden?: boolean;
  order?: number;
  reorder?: { questionId: string; newOrder: number }[];
}

interface UpdateResponse {
  success: boolean;
  question: Question;
  message?: string;
}

const formatDateBG = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function QuestionsPageContent() {
  const { token, isInitialized, isLoading: isLoadingAuth } = useAuth();
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewDevicesModalOpen, setIsViewDevicesModalOpen] = useState(false);
  const [devicesForQuestion, setDevicesForQuestion] = useState<
    DeviceReference[]
  >([]);
  const [currentQuestionForDevices, setCurrentQuestionForDevices] =
    useState<Question | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchQuestions = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      toast.warn("Необходима е автентикация за преглед на въпросите.");
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiClient<QuestionsApiResponse>("/questions", {
        token,
      });
      if (data.success && data.questions) {
        setAllQuestions(data.questions.sort((a, b) => a.order - b.order));
      } else {
        toast.error(data.message || "Неуспешно зареждане на въпросите.");
        setAllQuestions([]);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Възникна грешка при зареждане на въпросите."
      );
      setAllQuestions([]);
    }
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    if (isInitialized && !isLoadingAuth) {
      fetchQuestions();
    }
  }, [isInitialized, isLoadingAuth, fetchQuestions]);

  const handleAddQuestionClick = () => {
    setIsAddModalOpen(true);
  };

  const handleQuestionAdded = () => {
    fetchQuestions();
    setIsAddModalOpen(false);
  };

  const handleEditQuestionClick = (question: Question) => {
    setEditingQuestion(question);
    setIsEditModalOpen(true);
  };

  const handleQuestionUpdated = () => {
    fetchQuestions();
    setIsEditModalOpen(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestionClick = (question: Question) => {
    setDeletingQuestion(question);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmHideQuestion = async () => {
    if (!deletingQuestion || !token) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient<UpdateResponse>(
        `/questions/${deletingQuestion._id}`,
        {
          method: "PUT",
          body: { hidden: true },
          token,
        }
      );
      if (response.success) {
        toast.success(
          `Въпрос "${deletingQuestion.question.substring(
            0,
            30
          )}..." е скрит успешно.`
        );
        fetchQuestions();
        handleCloseModals();
      } else {
        toast.error(response.message || "Неуспешно скриване на въпрос.");
      }
    } catch (err: any) {
      toast.error(err.message || "Грешка при скриване на въпроса.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleHidden = async (question: Question) => {
    if (!token) {
      toast.error("Необходима е автентикация.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await apiClient<UpdateResponse>(
        `/questions/${question._id}`,
        {
          method: "PUT",
          body: { hidden: !question.hidden },
          token,
        }
      );
      if (response.success) {
        toast.success(
          ` видимостта на въпроса е ${
            !question.hidden ? "показана" : "скрита"
          } успешно.`
        );
        fetchQuestions();
      } else {
        toast.error(response.message || "Грешка при промяна на видимостта.");
      }
    } catch (err: any) {
      toast.error(err.message || "Грешка при промяна на видимостта.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDevicesClick = (question: Question) => {
    setCurrentQuestionForDevices(question);
    setDevicesForQuestion(question.devices || []);
    setIsViewDevicesModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setEditingQuestion(null);
    setIsDeleteModalOpen(false);
    setDeletingQuestion(null);
    setIsViewDevicesModalOpen(false);
    setCurrentQuestionForDevices(null);
    setDevicesForQuestion([]);
  };

  const visibleQuestions = allQuestions
    .filter((q) => !q.hidden)
    .sort((a, b) => a.order - b.order);
  const hiddenQuestions = allQuestions
    .filter((q) => q.hidden)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = visibleQuestions.findIndex((q) => q._id === active.id);
    const newIndex = visibleQuestions.findIndex((q) => q._id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newVisibleQuestions = arrayMove(visibleQuestions, oldIndex, newIndex);

    const updatedAllQuestions = allQuestions.map((q) => {
      if (q.hidden) return q;
      const newQuestion = newVisibleQuestions.find(
        (newQ) => newQ._id === q._id
      );
      return newQuestion || q;
    });

    setAllQuestions(updatedAllQuestions);

    const reorderPayload = newVisibleQuestions.map((question, index) => ({
      questionId: question._id,
      newOrder: index,
    }));

    if (!token) {
      toast.error("Authentication required to reorder questions.");
      fetchQuestions();
      return;
    }

    try {
      const response = await apiClient<UpdateResponse>(`/questions/reorder`, {
        method: "PUT",
        body: { reorder: reorderPayload },
        token,
      });

      if (!response.success) {
        toast.error(
          response.message || "Грешка при пренареждане на въпросите."
        );
        fetchQuestions();
      } else {
        toast.success("Поредността на въпросите е актуализирана.");
        fetchQuestions();
      }
    } catch (err: any) {
      toast.error(
        "Грешка при пренареждане на въпросите. Възстановяване на предишната подредба."
      );
      fetchQuestions();
    }
  };

  if (isLoadingAuth || !isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader text="Зареждане на автентикация..." />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader text="Зареждане на въпроси..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">
          Управление на Въпроси
        </h1>
        <button
          onClick={handleAddQuestionClick}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
        >
          <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
          Добави Нов Въпрос
        </button>
      </div>

      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        <h2 className="text-xl font-semibold text-slate-700 px-6 py-4 border-b border-slate-200">
          Активни Въпроси
        </h2>
        {visibleQuestions.length > 0 ? (
          <div className="overflow-hidden">
            <div className="hidden md:flex w-full bg-slate-50 border-b border-slate-200">
              <div className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-2/5">
                Въпрос (Плъзнете за пренареждане)
              </div>
              <div className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider flex-1 md:flex md:justify-between">
                <span className="w-1/5">Дата</span>
                <span className="w-1/5 text-center">Поредност</span>
                <span className="w-1/5 text-center">Видимост</span>
                <span className="w-1/5">Устройства</span>
                <span className="w-1/5 text-right">Действия</span>
              </div>
            </div>

            <div className="md:hidden w-full bg-slate-50 border-b border-slate-200 px-3 py-2">
              <div className="text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                Въпроси (Плъзнете за пренареждане)
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleQuestions.map((q) => q._id)}
                strategy={verticalListSortingStrategy}
              >
                <div>
                  {visibleQuestions.map((question) => (
                    <SortableQuestionItem
                      key={question._id}
                      question={question}
                      handleToggleHidden={handleToggleHidden}
                      handleViewDevicesClick={handleViewDevicesClick}
                      handleEditQuestionClick={handleEditQuestionClick}
                      handleDeleteQuestionClick={handleDeleteQuestionClick}
                      isSubmitting={isSubmitting}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <p className="px-6 py-4 text-sm text-slate-700">
            Няма активни въпроси.
          </p>
        )}
      </div>

      {hiddenQuestions.length > 0 && (
        <div className="mt-12 bg-white shadow-xl rounded-lg overflow-hidden">
          <h2 className="text-xl font-semibold text-slate-700 px-6 py-4 border-b border-slate-200">
            Скрити Въпроси
          </h2>
          <div className="overflow-hidden">
            <div className="hidden md:flex w-full bg-slate-50 border-b border-slate-200">
              <div className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-2/5">
                Въпрос
              </div>
              <div className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider flex-1 md:flex md:justify-between">
                <span className="w-1/5">Дата на скриване</span>
                <span className="w-1/5 text-center">Поредност (бивша)</span>
                <span className="w-1/5 text-center">Видимост</span>
                <span className="w-1/5">Устройства</span>
                <span className="w-1/5 text-right">Действия</span>
              </div>
            </div>

            <div className="md:hidden w-full bg-slate-50 border-b border-slate-200 px-3 py-2">
              <div className="text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                Скрити Въпроси
              </div>
            </div>

            <div>
              {hiddenQuestions.map((question) => (
                <QuestionItem
                  key={question._id}
                  question={question}
                  handleToggleHidden={handleToggleHidden}
                  handleViewDevicesClick={handleViewDevicesClick}
                  handleEditQuestionClick={handleEditQuestionClick}
                  handleDeleteQuestionClick={handleDeleteQuestionClick}
                  isSubmitting={isSubmitting}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={handleCloseModals}
          title="Добави Нов Въпрос"
          size="xl"
        >
          <AddQuestionForm
            onSuccess={() => {
              handleQuestionAdded();
            }}
            onCancel={handleCloseModals}
          />
        </Modal>
      )}

      {editingQuestion && isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={handleCloseModals}
          title="Редактирай Въпрос"
          size="xl"
        >
          <EditQuestionForm
            questionToEdit={editingQuestion}
            onSuccess={() => {
              handleQuestionUpdated();
            }}
            onCancel={handleCloseModals}
          />
        </Modal>
      )}

      {deletingQuestion && (
        <ConfirmHideQuestionModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseModals}
          onConfirm={handleConfirmHideQuestion}
          questionName={deletingQuestion.question}
          isSubmitting={isSubmitting}
        />
      )}
      {currentQuestionForDevices && (
        <ViewDevicesModal
          isOpen={isViewDevicesModalOpen}
          onClose={handleCloseModals}
          questionName={currentQuestionForDevices.question}
          devices={devicesForQuestion}
        />
      )}
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <QuestionsPageContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
