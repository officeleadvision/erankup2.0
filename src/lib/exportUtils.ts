import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { decrypt } from "@/lib/cryptoUtils";

export type ExportFormat = "csv" | "xlsx";

export type DeviceLike = {
  _id?: unknown;
  id?: unknown;
  label?: string | null;
  location?: string | null;
  token?: string | null;
};

/** UTF-8 BOM so Excel opens Cyrillic CSV correctly. */
const CSV_BOM = "﻿";

export function parseExportFormat(value: string | null): ExportFormat | null {
  const normalized = (value || "csv").toLowerCase();
  return normalized === "csv" || normalized === "xlsx" ? normalized : null;
}

export function escapeCsvField(field: unknown): string {
  if (field === null || typeof field === "undefined") {
    return "";
  }
  let stringField = String(field);
  if (
    stringField.includes(",") ||
    stringField.includes("\n") ||
    stringField.includes("\r") ||
    stringField.includes('"')
  ) {
    stringField = '"' + stringField.replace(/"/g, '""') + '"';
  }
  return stringField;
}

export function buildCsv(rows: Array<Array<string | number>>): string {
  return (
    CSV_BOM +
    rows.map((row) => row.map(escapeCsvField).join(",") + "\r\n").join("")
  );
}

/**
 * Decrypt a stored field, tolerating legacy plaintext values and blanks.
 */
export function safeDecrypt(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value !== "string") return String(value);
  if (value === "") return "";
  const decrypted = decrypt(value);
  if (decrypted === null || decrypted === "[Decryption Error]") {
    return value;
  }
  return decrypted;
}

/**
 * Devices on feedback documents come in several historical shapes: a full
 * embedded device object, a populated document, a `{ device: {...} }` wrapper,
 * a `_doc` wrapper or a bare id/token string. Normalise all of them.
 */
export function extractDeviceField(
  deviceEntry: unknown,
  field: "label" | "location" | "token"
): string | undefined {
  if (!deviceEntry || typeof deviceEntry !== "object") return undefined;
  const entry = deviceEntry as Record<string, unknown>;
  const candidates: unknown[] = [entry, entry.device, entry._doc, entry.data];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const value = (candidate as Record<string, unknown>)[field];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
  }
  return undefined;
}

export function extractDeviceId(deviceEntry: unknown): string | undefined {
  if (typeof deviceEntry === "string") return deviceEntry;
  if (!deviceEntry || typeof deviceEntry !== "object") return undefined;
  const entry = deviceEntry as Record<string, unknown>;
  const candidates: unknown[] = [
    entry._id,
    entry.id,
    (entry._doc as Record<string, unknown> | undefined)?._id,
    (entry.device as Record<string, unknown> | undefined)?._id,
  ];
  for (const candidate of candidates) {
    if (candidate) return String(candidate);
  }
  return undefined;
}

export function toDevicesArray(devices: unknown): unknown[] {
  if (Array.isArray(devices)) return devices;
  if (devices) return [devices];
  return [];
}

export function buildExportResponse(
  format: ExportFormat,
  rows: Array<Array<string | number>>,
  baseFilename: string,
  sheetName: string
): NextResponse {
  const responseHeaders = new Headers();
  responseHeaders.set("Cache-Control", "no-store");

  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer;

    responseHeaders.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    responseHeaders.set(
      "Content-Disposition",
      `attachment; filename="${baseFilename}.xlsx"`
    );
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: responseHeaders,
    });
  }

  responseHeaders.set("Content-Type", "text/csv; charset=utf-8");
  responseHeaders.set(
    "Content-Disposition",
    `attachment; filename="${baseFilename}.csv"`
  );
  return new NextResponse(buildCsv(rows), {
    status: 200,
    headers: responseHeaders,
  });
}
