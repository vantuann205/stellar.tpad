'use client';

import React from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0f172a] p-4" onClick={(e) => e.stopPropagation()}>
        {title ? <h3 className="mb-3 text-lg font-semibold">{title}</h3> : null}
        {children}
      </div>
    </div>
  );
}