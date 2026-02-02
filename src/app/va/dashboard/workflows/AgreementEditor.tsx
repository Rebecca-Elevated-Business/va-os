"use client";

import { X } from "lucide-react";
import { usePrompt } from "@/components/ui/PromptProvider";

export type AgreementItem = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "checkbox" | "checkbox_group";
  options?: string[];
  placeholder?: string;
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

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const newStructure = cloneStructure(agreement.custom_structure);
    newStructure.sections[sectionIndex].items.splice(itemIndex, 1);
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

  const removeOption = (
    sectionIndex: number,
    itemIndex: number,
    optionIndex: number
  ) => {
    const newStructure = cloneStructure(agreement.custom_structure);
    const item = newStructure.sections[sectionIndex].items[itemIndex];
    if (item.options) {
      item.options.splice(optionIndex, 1);
      onChange({ ...agreement, custom_structure: newStructure });
    }
  };

  return (
    <div className="space-y-8">
      {agreement.custom_structure.sections.map((section, sIndex) => (
        <div
          key={section.id}
          className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 border-b pb-2">
            {section.title}
          </h2>

          <div className="space-y-6">
            {section.items.map((item, iIndex) => (
              <div
                key={item.id}
                className="group relative border-l-2 border-gray-100 pl-4 py-2 hover:border-[#9d4edd] transition-all"
              >
                <button
                  onClick={() => removeItem(sIndex, iIndex)}
                  className="absolute -right-2 top-0 text-gray-300 hover:text-red-500 text-xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                >
                  Remove
                  <X className="h-3 w-3" />
                </button>

                {item.type !== "checkbox" && (
                  <label className="block text-sm font-bold mb-2">
                    {item.label}
                  </label>
                )}

                {item.type === "checkbox_group" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {item.options?.map((opt, oIndex) => (
                        <div
                          key={oIndex}
                          className="group/option flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="w-5 h-5 rounded border-2 border-gray-300" />
                          <span className="text-sm text-gray-600 flex-1">
                            {opt}
                          </span>
                          <button
                            onClick={() => removeOption(sIndex, iIndex, oIndex)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover/option:opacity-100 transition-opacity"
                            aria-label="Remove option"
                          >
                            <X className="h-4 w-4" />
                          </button>
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
                  <div className="bg-gray-50 rounded border border-gray-200 border-dashed w-full flex items-center px-4 py-3 text-gray-400 text-xs italic">
                    Input field for Client (Editable by VA in Client Portal view)
                  </div>
                )}

                {item.type === "checkbox" && (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-gray-200 rounded" />
                    <span className="text-sm font-bold text-gray-700">
                      {item.label}
                    </span>
                  </div>
                )}
              </div>
            ))}
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
