"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type PromptTone = "default" | "danger";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: PromptTone;
};

type AlertOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: PromptTone;
};

type PromptState = {
  open: boolean;
  type: "confirm" | "alert";
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: PromptTone;
};

type PromptContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

const PromptContext = createContext<PromptContextValue | undefined>(undefined);

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [state, setState] = useState<PromptState | null>(null);

  const closePrompt = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        type: "confirm",
        title: options.title || "Please confirm",
        message: options.message,
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setState({
        open: true,
        type: "alert",
        title: options.title || "Notice",
        message: options.message,
        confirmLabel: options.confirmLabel || "OK",
        tone: options.tone || "default",
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  return (
    <PromptContext.Provider value={value}>
      {children}
      {state?.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {state.title}
              </h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                {state.message}
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                {state.type === "confirm" && (
                  <button
                    type="button"
                    onClick={() => closePrompt(false)}
                    className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-black"
                  >
                    {state.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => closePrompt(true)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${
                    state.tone === "danger"
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
                  }`}
                >
                  {state.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PromptContext.Provider>
  );
}

export function usePrompt() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error("usePrompt must be used within PromptProvider");
  }
  return context;
}
