"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { formatApiError, ApiError } from "./api";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;

let memoryToasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((l) => l([...memoryToasts]));
}

function addToast(type: ToastType, messageOrError: unknown, options?: ToastOptions) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let message = "";
  let defaultTitle: string | undefined = undefined;

  if (type === "error") {
    message = formatApiError(messageOrError);
    if (messageOrError instanceof ApiError) {
      const code = messageOrError.data?.error?.code;
      if (code === "validation_error") defaultTitle = "Validation Error";
      else if (code === "conflict") defaultTitle = "Scheduling Conflict";
      else if (code === "permission_denied") defaultTitle = "Access Denied";
      else if (code === "bad_request") defaultTitle = "Bad Request";
      else defaultTitle = "Action Failed";
    } else {
      defaultTitle = "Action Failed";
    }
  } else {
    message = typeof messageOrError === "string" ? messageOrError : String(messageOrError);
    if (type === "success") defaultTitle = "Success";
    else if (type === "warning") defaultTitle = "Warning";
    else if (type === "info") defaultTitle = "Information";
  }

  const duration = options?.duration ?? (type === "error" ? 5500 : 3500);

  const toastItem: ToastItem = {
    id,
    type,
    title: options?.title || defaultTitle,
    message,
    duration,
  };

  memoryToasts = [toastItem, ...memoryToasts].slice(0, 5); // Keep max 5
  notifyListeners();

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

export function removeToast(id: string) {
  memoryToasts = memoryToasts.filter((t) => t.id !== id);
  notifyListeners();
}

export const toast = {
  error: (messageOrError: unknown, options?: ToastOptions) =>
    addToast("error", messageOrError, options),
  success: (message: string, options?: ToastOptions) =>
    addToast("success", message, options),
  warning: (message: string, options?: ToastOptions) =>
    addToast("warning", message, options),
  info: (message: string, options?: ToastOptions) =>
    addToast("info", message, options),
  dismiss: (id: string) => removeToast(id),
};

const ToastContext = createContext<{
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}>({
  toasts: [],
  dismiss: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>(memoryToasts);

  useEffect(() => {
    const listener: Listener = (updated) => setToasts(updated);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
