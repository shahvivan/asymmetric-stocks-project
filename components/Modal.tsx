"use client";

import { useEffect, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

const modalTransition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] };

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, handleKey]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
          />
          <motion.div
            className={cn(
              "relative bg-surface border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-lg mx-4",
              className
            )}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={modalTransition}
          >
            {title && (
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-bold">{title}</h2>
                <button
                  onClick={onClose}
                  className="text-muted hover:text-white transition-colors text-xl leading-none"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="p-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
