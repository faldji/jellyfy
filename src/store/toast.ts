import { create } from 'zustand';

type ToastState = {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastState>((set) => ({
  message: null,
  show(message) {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message });
    hideTimer = setTimeout(() => set({ message: null }), 2800);
  },
  hide() {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null });
  },
}));
