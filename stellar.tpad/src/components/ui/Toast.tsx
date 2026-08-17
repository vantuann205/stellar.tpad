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
const EXIT_ANIMATION_MS = 300;
const SHAKE_ANIMATION_MS = 500;

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [hovered, setHovered] = useState(false);
  const remainingRef = useRef(DURATION);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevShakeCount = useRef(toast.shakeCount ?? 0);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => onClose(toast.id), EXIT_ANIMATION_MS);
  }, [toast.id, onClose]);

  // Fresh countdown whenever a new toast takes this slot.
  useEffect(() => {
    remainingRef.current = DURATION;
  }, [toast.id]);

  // Slide-in animation.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [toast.id]);

  // Auto-dismiss countdown — pauses while hovered, resumes with the time left.
  useEffect(() => {
    if (toast.type === 'processing' || hovered) return;

    startRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startRef.current !== null) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
        startRef.current = null;
      }
    };
  }, [toast.id, toast.type, hovered, dismiss]);

  // Repeated toasts shake instead of stacking, and restart the countdown.
  useEffect(() => {
    const shakeCount = toast.shakeCount ?? 0;
    if (shakeCount <= prevShakeCount.current) return;

    prevShakeCount.current = shakeCount;
    remainingRef.current = DURATION;
    setShaking(true);

    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShaking(false), SHAKE_ANIMATION_MS);
  }, [toast.shakeCount]);

  // Every pending timer is dropped when the toast leaves the screen.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
  }, []);

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
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
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
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={dismiss}
          className="shrink-0 flex text-gray-400 hover:text-white cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-pump-green"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Static progress bar — không animate, chỉ hiện màu */}
      {toast.type !== 'processing' && isVisible && (
        <div className={`h-0.5 w-full ${toast.type === 'success' ? 'bg-pump-green' : 'bg-pump-red'} opacity-40`} />
      )}
    </div>
  );
};

export default Toast;
