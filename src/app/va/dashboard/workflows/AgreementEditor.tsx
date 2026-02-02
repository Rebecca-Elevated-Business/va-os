"use client";

import { useMemo, useState } from "react";
import { usePrompt } from "@/components/ui/PromptProvider";

type AgreementValue = string | string[] | boolean | undefined;

export type AgreementItem = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "checkbox" | "checkbox_group";
  options?: string[];
  placeholder?: string;
  value?: AgreementValue;
  hidden?: boolean;
  hidden_options?: string[];
};

type ExtraQuestionType = AgreementItem["type"];

type ExtraQuestionState = {
  open: boolean;
  sectionIndex: number | null;
  label: string;
  type: ExtraQuestionType;
  optionsText: string;
};

export type AgreementSection = {
  id: string;
  title: string;
  items: AgreementItem[];
};

export type AgreementStructure = {
  sections: AgreementSection[];
};

export type Agreement = {
  id: string;
  title: string;
  custom_structure: AgreementStructure;
  status: string;
};

type AgreementEditorProps = {
  agreement: Agreement;
  onChange: (nextAgreement: Agreement) => void;
  showFooterNote?: boolean;
};

const cloneStructure = (structure: AgreementStructure): AgreementStructure => ({
  sections: structure.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      options: item.options ? [...item.options] : undefined,
    })),
  })),
});

export default function AgreementEditor({
  agreement,
  onChange,
  showFooterNote = true,
}: AgreementEditorProps) {
  const { prompt } = usePrompt();
  const [customiseOpen, setCustomiseOpen] = useState<Record<string, boolean>>(
    {}
  );
  const [extraQuestion, setExtraQuestion] = useState<ExtraQuestionState>({
    open: false,
    sectionIndex: null,
    label: "",
    type: "text",
    optionsText: "",
  });

  const notesIndexBySection = useMemo(
    () =>
      agreement.custom_structure.sections.map((section) => {
        const index = section.items.findIndex((item) =>
          item.label?.toLowerCase().includes("notes")
        );
        return index;
      }),
    [agreement.custom_structure.sections]
  );

  const toggleItemHidden = (sectionIndex: number, itemIndex: number) => {
    const newStructure = cloneStructure(agreement.custom_structure);
    const item = newStructure.sections[sectionIndex].items[itemIndex];
    item.hidden = !item.hidden;
    onChange({ ...agreement, custom_structure: newStructure });
  };

  const reinstateSection = (sectionIndex: number) => {
    const newStructure = cloneStructure(agreement.custom_structure);
    newStructure.sections[sectionIndex].items.forEach((item) => {
      item.hidden = false;
      if (item.hidden_options) {
        item.hidden_options = [];
      }
    });
    onChange({ ...agreement, custom_structure: newStructure });
  };

  const addOption = async (sectionIndex: number, itemIndex: number) => {
    const option = await prompt({
      title: "Add option",
      message: "Enter new option:",
      placeholder: "Option label",
      confirmLabel: "Add",
    });
    if (!option?.trim()) return;

    const newStructure = cloneStructure(agreement.custom_structure);
    const item = newStructure.sections[sectionIndex].items[itemIndex];
    if (item.options) {
      item.options.push(option.trim());
    } else {
      item.options = [option.trim()];
    }
    onChange({ ...agreement, custom_structure: newStructure });
  };

  const openExtraQuestionModal = (sectionIndex: number) => {
    setExtraQuestion({
      open: true,
      sectionIndex,
      label: "",
      type: "text",
      optionsText: "",
    });
  };

  const closeExtraQuestionModal = () => {
    setExtraQuestion((prev) => ({ ...prev, open: false }));
  };

  const addExtraQuestion = () => {
    if (extraQuestion.sectionIndex === null) return;
    const label = extraQuestion.label.trim();
    if (!label) return;

    const newStructure = cloneStructure(agreement.custom_structure);
    const section = newStructure.sections[extraQuestion.sectionIndex];
    const notesIndex = section.items.findIndex((item) =>
      item.label?.toLowerCase().includes("notes")
    );
    const insertIndex = notesIndex === -1 ? section.items.length : notesIndex;

    const newItem: AgreementItem = {
      id: crypto.randomUUID(),
      label,
      type: extraQuestion.type,
    };

    if (extraQuestion.type === "checkbox_group") {
      const options = extraQuestion.optionsText
        .split(",")
        .map((opt) => opt.trim())
        .filter(Boolean);
      newItem.options = options.length ? options : ["Option 1"];
    }

    section.items.splice(insertIndex, 0, newItem);
    onChange({ ...agreement, custom_structure: newStructure });
    closeExtraQuestionModal();
  };

  const toggleOptionHidden = (
    sectionIndex: number,
    itemIndex: number,
    optionIndex: number
  ) => {
    const newStructure = cloneStructure(agreement.custom_structure);
    const item = newStructure.sections[sectionIndex].items[itemIndex];
    if (!item.options) return;
    const option = item.options[optionIndex];
    const hiddenOptions = new Set(item.hidden_options ?? []);
    if (hiddenOptions.has(option)) {
      hiddenOptions.delete(option);
    } else {
      hiddenOptions.add(option);
    }
    item.hidden_options = Array.from(hiddenOptions);
    onChange({ ...agreement, custom_structure: newStructure });
  };

  const updateItemValue = (
    sectionIndex: number,
    itemIndex: number,
    value: AgreementValue
  ) => {
    const newStructure = cloneStructure(agreement.custom_structure);
    const item = newStructure.sections[sectionIndex].items[itemIndex];
    item.value = value;
    onChange({ ...agreement, custom_structure: newStructure });
  };

  return (
    <div className="space-y-8">
      {agreement.custom_structure.sections.map((section, sIndex) => (
        <div
          key={section.id}
          className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6 border-b pb-2">
            <h2 className="text-base font-normal text-[#333333]">
              {section.title.replace(/^\s*\d+\.\s*/, "")}
            </h2>
            <button
              type="button"
              onClick={() =>
                setCustomiseOpen((prev) => ({
                  ...prev,
                  [section.id]: !prev[section.id],
                }))
              }
              className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-[#9d4edd]"
            >
              Customise section
            </button>
          </div>

          {customiseOpen[section.id] && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Show or hide fields
                </p>
                <button
                  type="button"
                  onClick={() => reinstateSection(sIndex)}
                  className="text-xs font-bold text-gray-400 hover:text-[#9d4edd]"
                >
                  Reinstate all
                </button>
              </div>
              <div className="space-y-3 text-xs text-gray-600">
                {section.items.map((item, iIndex) => (
                  <div key={item.id} className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!item.hidden}
                        onChange={() => toggleItemHidden(sIndex, iIndex)}
                        className="accent-[#333333]"
                      />
                      {item.label}
                    </label>
                    {item.type === "checkbox_group" && item.options && (
                      <div className="grid gap-2 sm:grid-cols-2 pl-6 text-xs text-gray-500">
                        {item.options.map((opt, oIndex) => (
                          <label key={opt} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={
                                !item.hidden_options?.includes(opt)
                              }
                              onChange={() =>
                                toggleOptionHidden(sIndex, iIndex, oIndex)
                              }
                              className="accent-[#333333]"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {section.items.map((item, iIndex) => {
              const notesIndex = notesIndexBySection[sIndex] ?? -1;
              const shouldInsertAddButton = notesIndex === iIndex;
              if (item.hidden && !shouldInsertAddButton) return null;
              return (
                <div key={item.id} className="group relative py-2">
                  {shouldInsertAddButton && (
                    <button
                      type="button"
                      onClick={() => openExtraQuestionModal(sIndex)}
                      className="mb-3 w-full text-left p-4 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-bold text-gray-400 hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all"
                    >
                      + Add extra question
                    </button>
                  )}
                  {!item.hidden && (
                    <>
                      {item.type !== "checkbox" && (
                        <label className="block text-sm font-normal text-[#333333] mb-2">
                          {item.label}
                        </label>
                      )}

                      {item.type === "checkbox_group" && (
                        <div className="space-y-2">
                          <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {item.options
                              ?.filter(
                                (opt) => !item.hidden_options?.includes(opt)
                              )
                              .map((opt) => (
                                <label
                                  key={opt}
                                  className="group/option flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-[#333333] text-[#333333] accent-[#333333] ml-[3px]"
                                    checked={
                                      Array.isArray(item.value)
                                        ? item.value.includes(opt)
                                        : false
                                    }
                                    onChange={(event) => {
                                      const currentValues = Array.isArray(
                                        item.value
                                      )
                                        ? item.value
                                        : [];
                                      const nextValues = event.target.checked
                                        ? [...currentValues, opt]
                                        : currentValues.filter((v) => v !== opt);
                                      updateItemValue(
                                        sIndex,
                                        iIndex,
                                        nextValues
                                      );
                                    }}
                                  />
                                  <span className="text-sm text-[#333333] font-normal flex-1">
                                    {opt}
                                  </span>
                                </label>
                              ))}
                          </div>
                          <button
                            onClick={() => void addOption(sIndex, iIndex)}
                            className="bg-purple-50 text-[#9d4edd] border border-purple-100 px-3 py-1 rounded-full text-xs font-bold hover:bg-purple-100"
                          >
                            + Add Option
                          </button>
                        </div>
                      )}

                      {(item.type === "text" || item.type === "date") && (
                        <input
                          type={item.type}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#333333] outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-[#9d4edd]/20"
                          value={(item.value as string) || ""}
                          onChange={(event) =>
                            updateItemValue(sIndex, iIndex, event.target.value)
                          }
                        />
                      )}

                      {item.type === "textarea" && (
                        <textarea
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#333333] outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-[#9d4edd]/20 min-h-24"
                          value={(item.value as string) || ""}
                          onChange={(event) =>
                            updateItemValue(sIndex, iIndex, event.target.value)
                          }
                        />
                      )}

                      {item.type === "checkbox" && (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-[#333333] text-[#333333] accent-[#333333] ml-[3px]"
                            checked={Boolean(item.value)}
                            onChange={(event) =>
                              updateItemValue(
                                sIndex,
                                iIndex,
                                event.target.checked
                              )
                            }
                          />
                          <span className="text-sm font-normal text-[#333333]">
                            {item.label}
                          </span>
                        </label>
                      )}
                    </>
                  )}
              </div>
              );
            })}
            {notesIndexBySection[sIndex] === -1 && (
              <button
                type="button"
                onClick={() => openExtraQuestionModal(sIndex)}
                className="w-full text-left p-4 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-bold text-gray-400 hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all"
              >
                + Add extra question
              </button>
            )}
          </div>
        </div>
      ))}

      {showFooterNote && (
        <div className="mt-8 text-center text-gray-400 text-xs italic">
          Changes saved here update the workflow structure. To fill in client
          details yourself, you can access the document via the Client List.
        </div>
      )}

      {extraQuestion.open && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Add extra question
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  Question label
                </label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-[#9d4edd]/20"
                  value={extraQuestion.label}
                  onChange={(event) =>
                    setExtraQuestion((prev) => ({
                      ...prev,
                      label: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  Question type
                </label>
                <select
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-[#9d4edd]/20"
                  value={extraQuestion.type}
                  onChange={(event) =>
                    setExtraQuestion((prev) => ({
                      ...prev,
                      type: event.target.value as ExtraQuestionType,
                    }))
                  }
                >
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="checkbox_group">Multiple choice</option>
                  <option value="date">Date</option>
                </select>
              </div>
              {extraQuestion.type === "checkbox_group" && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Options (comma separated)
                  </label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-[#9d4edd]/20"
                    placeholder="Option 1, Option 2"
                    value={extraQuestion.optionsText}
                    onChange={(event) =>
                      setExtraQuestion((prev) => ({
                        ...prev,
                        optionsText: event.target.value,
                      }))
                    }
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeExtraQuestionModal}
                  className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addExtraQuestion}
                  className="px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
                >
                  Add question
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
