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

type PromptOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: PromptTone;
  placeholder?: string;
  defaultValue?: string;
};

type PromptState = {
  open: boolean;
  type: "confirm" | "alert" | "prompt";
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: PromptTone;
  placeholder?: string;
  defaultValue?: string;
};

type PromptContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const PromptContext = createContext<PromptContextValue | undefined>(undefined);

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<
    ((value: boolean | string | null) => void) | null
  >(null);
  const [state, setState] = useState<PromptState | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const closePrompt = useCallback((result: boolean | string | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
    setPromptValue("");
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

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setPromptValue(options.defaultValue || "");
      setState({
        open: true,
        type: "prompt",
        title: options.title || "Enter a value",
        message: options.message,
        confirmLabel: options.confirmLabel || "Add",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
        placeholder: options.placeholder,
        defaultValue: options.defaultValue,
      });
    });
  }, []);

  const value = useMemo(
    () => ({ confirm, alert, prompt }),
    [confirm, alert, prompt]
  );

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
              {state.type === "prompt" && (
                <input
                  autoFocus
                  type="text"
                  className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-[#9d4edd]/20"
                  placeholder={state.placeholder}
                  value={promptValue}
                  onChange={(event) => setPromptValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      closePrompt(promptValue);
                    }
                  }}
                />
              )}
              <div className="mt-6 flex items-center justify-end gap-3">
                {(state.type === "confirm" || state.type === "prompt") && (
                  <button
                    type="button"
                    onClick={() =>
                      closePrompt(state.type === "prompt" ? null : false)
                    }
                    className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-black"
                  >
                    {state.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    closePrompt(state.type === "prompt" ? promptValue : true)
                  }
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
