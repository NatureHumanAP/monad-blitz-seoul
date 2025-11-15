"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { removeToast } from "@/slices/uiSlice";

export function ToastHost() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts
      .map((t) => {
        if (!t.id) return null;
        return setTimeout(() => dispatch(removeToast(t.id as string)), 3000);
      })
      .filter((v): v is ReturnType<typeof setTimeout> => v !== null);
    return () => timers.forEach((timerId) => clearTimeout(timerId));
  }, [toasts, dispatch]);

  if (!toasts.length) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="w-full max-w-md rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
