"use client";

import { useState } from "react";
import { usePrompt } from "@/components/ui/PromptProvider";

export type AgreementItem = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "checkbox" | "checkbox_group";
  options?: string[];
  placeholder?: string;
  hidden?: boolean;
  hidden_options?: string[];
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
              if (item.hidden) return null;
              return (
                <div key={item.id} className="group relative py-2">
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
                        <div
                          key={opt}
                          className="group/option flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="w-5 h-5 rounded border-2 border-[#333333]" />
                          <span className="text-sm text-[#333333] font-normal flex-1">
                            {opt}
                          </span>
                        </div>
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

                {(item.type === "text" ||
                  item.type === "date" ||
                  item.type === "textarea") && (
                  <div className="bg-gray-50 rounded border border-gray-200 border-dashed w-full h-10" />
                )}

                {item.type === "checkbox" && (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-[#333333] rounded" />
                    <span className="text-sm font-normal text-[#333333]">
                      {item.label}
                    </span>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ))}

      {showFooterNote && (
        <div className="mt-8 text-center text-gray-400 text-xs italic">
          Changes saved here update the workflow structure. To fill in client
          details yourself, you can access the document via the Client List.
        </div>
      )}
    </div>
  );
}
