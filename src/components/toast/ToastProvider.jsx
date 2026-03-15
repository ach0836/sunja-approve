"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(undefined);

const VARIANT_CLASS_MAP = {
  success: "alert-success",
  error: "alert-error",
  warning: "alert-warning",
  info: "alert-info",
};

function ToastViewport({ toasts, removeToast }) {
  return (
    <aside className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-end px-4 sm:px-6">
      <div className="flex max-h-[80vh] w-full flex-col items-end gap-3 overflow-y-auto">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <div className={`alert w-full max-w-sm shadow-lg ${VARIANT_CLASS_MAP[toast.variant] ?? "alert-info"}`}>
              <div className="flex flex-1 flex-col gap-1">
                {toast.title ? <span className="font-semibold">{toast.title}</span> : null}
                {toast.description ? <span className="text-sm leading-snug">{toast.description}</span> : null}
                {toast.content ? toast.content : null}
              </div>
              <div className="flex shrink-0 gap-2">
                {toast.actions?.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={`btn btn-sm ${action.variant ?? "btn-outline"}`}
                    onClick={() => {
                      action.onClick?.();
                      removeToast(toast.id);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
                {toast.dismissible !== false ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-circle btn-ghost"
                    aria-label="닫기"
                    onClick={() => removeToast(toast.id)}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const callbacks = [];
    setToasts((prev) => {
      const next = prev.filter((toast) => {
        const shouldKeep = toast.id !== id;
        if (!shouldKeep && toast.onClose) {
          callbacks.push(toast.onClose);
        }
        return shouldKeep;
      });
      return next;
    });
    if (callbacks.length) {
      queueMicrotask(() => {
        callbacks.forEach((fn) => {
          try {
            fn();
          } catch (error) {
            console.error("Toast onClose callback failed", error);
          }
        });
      });
    }
    const timeoutId = timersRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    ({ id, duration = 3000, ...rest }) => {
      const toastId =
        id ?? (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      setToasts((prev) => [...prev, { id: toastId, ...rest }]);

      if (duration && duration > 0 && !(rest.actions?.length)) {
        const timeoutId = setTimeout(() => removeToast(toastId), duration);
        timersRef.current.set(toastId, timeoutId);
      }

      return toastId;
    },
    [removeToast]
  );

  const updateToast = useCallback(
    (id, updates) => {
      setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, ...updates } : toast)));
      if (typeof updates?.duration === "number") {
        const timeoutId = timersRef.current.get(id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timersRef.current.delete(id);
        }
        if (updates.duration > 0) {
          const newTimer = setTimeout(() => removeToast(id), updates.duration);
          timersRef.current.set(id, newTimer);
        }
      }
    },
    [removeToast]
  );

  const api = useMemo(() => {
    const makeVariant = (variant) => (description, options = {}) =>
      addToast({ description, variant, ...options });
    return {
      addToast,
      updateToast,
      dismissToast: removeToast,
      success: makeVariant("success"),
      error: makeVariant("error"),
      warning: makeVariant("warning"),
      info: makeVariant("info"),
    };
  }, [addToast, updateToast, removeToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    console.warn("useToast must be used within a ToastProvider");
    // 기본적인 toast 구현 반환 (폴백)
    return {
      addToast: () => null,
      updateToast: () => null,
      dismissToast: () => null,
      success: (msg) => console.log("Toast Success:", msg),
      error: (msg) => console.error("Toast Error:", msg),
      warning: (msg) => console.warn("Toast Warning:", msg),
      info: (msg) => console.info("Toast Info:", msg),
    };
  }
  return context;
}
