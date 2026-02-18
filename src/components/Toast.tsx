"use client";

import { useEffect, useState } from "react";

type ToastType = "error" | "info" | "success";

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type, duration = 4000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = type === "error" ? "rgba(239,68,68,0.95)" : type === "success" ? "rgba(34,197,94,0.95)" : "rgba(59,130,246,0.95)";

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        background: bgColor,
        color: "white",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 10000,
        maxWidth: "400px",
        animation: "slideIn 0.3s ease-out",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <span style={{ flex: 1 }}>{message}</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: "18px",
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

interface ToastManagerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onDismiss: (id: string) => void;
}

export function ToastManager({ toasts, onDismiss }: ToastManagerProps) {
  return (
    <>
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => onDismiss(toast.id)} />
      ))}
    </>
  );
}
