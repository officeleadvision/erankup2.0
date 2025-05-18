export const formatDateBG = (dateString: string | Date): string => {
  if (!dateString) return "";
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatDateTimeBG = (dateString: string | Date): string => {
  if (!dateString) return "";
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "";

  const datePart = date.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
};
