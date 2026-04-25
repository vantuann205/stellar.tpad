import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'processing';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  shakeCount?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const DURATION = 3000;

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [hovered, setHovered] = useState(false);
  const remainingRef = useRef(DURATION);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevShakeCount = useRef(toast.shakeCount ?? 0);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  }, [toast.id, onClose]);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, remainingRef.current);
  }, [dismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (startRef.current !== null) {
      remainingRef.current -= Date.now() - startRef.current;
      startRef.current = null;
    }
  }, []);

  // Init
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    if (toast.type !== 'processing') {
      remainingRef.current = DURATION;
      startTimer();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id]);

  // Reset timer on shake (spam)
  useEffect(() => {
    if ((toast.shakeCount ?? 0) > prevShakeCount.current) {
      prevShakeCount.current = toast.shakeCount ?? 0;
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      // Reset countdown
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingRef.current = DURATION;
      if (!hovered) startTimer();
    }
  }, [toast.shakeCount]);

  // Hover pause/resume
  useEffect(() => {
    if (toast.type === 'processing') return;
    if (hovered) pauseTimer();
    else startTimer();
  }, [hovered]);

  const getStyles = () => {
    switch (toast.type) {
      case 'success':    return { icon: <CheckCircle2 className="w-6 h-6 text-pump-green" />, titleColor: 'text-pump-green' };
      case 'error':      return { icon: <XCircle className="w-6 h-6 text-pump-red" />,        titleColor: 'text-pump-red'   };
      case 'processing': return { icon: <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />, titleColor: 'text-blue-400' };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-[#0d1117] border border-gray-800 shadow-xl transition-all duration-300 transform mb-3 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} ${shaking ? 'animate-shake' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="shrink-0 pt-0.5">{styles.icon}</div>
        <div className="flex-1 w-0">
          <p className={`text-xs font-black uppercase tracking-wider ${styles.titleColor}`}>{toast.title}</p>
          <p className="mt-1 text-sm text-gray-300 leading-snug">{toast.message}</p>
        </div>
        <div className="shrink-0 flex text-gray-400 hover:text-white cursor-pointer" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); setIsVisible(false); setTimeout(() => onClose(toast.id), 300); }}>
          <X className="w-4 h-4" />
        </div>
      </div>
      {/* Static progress bar — không animate, chỉ hiện màu */}
      {toast.type !== 'processing' && isVisible && (
        <div className={`h-0.5 w-full ${toast.type === 'success' ? 'bg-pump-green' : 'bg-pump-red'} opacity-40`} />
      )}
    </div>
  );
};

export default Toast;
