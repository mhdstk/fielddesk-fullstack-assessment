"use client";
import React from "react";
import { useToast, ToastItem } from "@/lib/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 w-full max-w-sm sm:max-w-md pointer-events-none px-4 sm:px-0 transition-all duration-200"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const isError = toast.type === "error";
  const isSuccess = toast.type === "success";
  const isWarning = toast.type === "warning";

  const borderColor = isError
    ? "border-red-200"
    : isSuccess
    ? "border-emerald-200"
    : isWarning
    ? "border-amber-200"
    : "border-blue-200";

  const bgColor = isError
    ? "bg-red-50/90 text-red-950"
    : isSuccess
    ? "bg-emerald-50/90 text-emerald-950"
    : isWarning
    ? "bg-amber-50/90 text-amber-950"
    : "bg-blue-50/90 text-blue-950";

  const iconBg = isError
    ? "bg-red-600 text-white"
    : isSuccess
    ? "bg-emerald-600 text-white"
    : isWarning
    ? "bg-amber-500 text-white"
    : "bg-blue-600 text-white";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${borderColor} ${bgColor} p-4 shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg} mt-0.5`}
        >
          {isError && (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {isSuccess && (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {isWarning && (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          )}
          {!isError && !isSuccess && !isWarning && (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          {toast.title && (
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 mb-0.5">
              {toast.title}
            </h3>
          )}
          <p className="text-sm font-normal text-zinc-700 leading-snug break-words">
            {toast.message}
          </p>
        </div>

        <button
          onClick={onDismiss}
          type="button"
          aria-label="Close notification"
          className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-black/5 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
