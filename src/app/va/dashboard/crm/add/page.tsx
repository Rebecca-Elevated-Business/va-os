"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";

export default function AddClientPage() {
  const router = useRouter();
  const { alert } = usePrompt();
  const [loading, setLoading] = useState(false);
  const [websiteLinks, setWebsiteLinks] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    first_name: "",
    surname: "",
    business_name: "",
    email: "",
    phone: "",
    address: "",
    source: "Referral",
    status: "Enquiry",
    work_type: "Ad-hoc",
    initial_notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // 1. Insert Client Record
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert([
        {
          va_id: userData.user.id,
          first_name: formData.first_name,
          surname: formData.surname,
          business_name: formData.business_name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          source: formData.source,
          status: formData.status,
          work_type: formData.work_type,
          website_links: websiteLinks.filter((link) => link.trim().length > 0),
        },
      ])
      .select()
      .single();

    if (clientError) {
      await alert({
        title: "Error saving client",
        message: `Error saving client: ${clientError.message}`,
        tone: "danger",
      });
      setLoading(false);
      return;
    }

    // 2. If there are initial notes, save them to the notes table
    if (formData.initial_notes && client) {
      await supabase.from("client_notes").insert([
        {
          client_id: client.id,
          va_id: userData.user.id,
          content: formData.initial_notes,
        },
      ]);
    }

    // 3. Redirect to the profile page
    router.push(`/va/dashboard/crm/profile/${client.id}`);
  };

  return (
    <div className="max-w-2xl text-black">
      <h1 className="text-3xl font-bold mb-8">Add New Client</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              First Name *
            </label>
            <input
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Surname *
            </label>
            <input
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={formData.surname}
              onChange={(e) =>
                setFormData({ ...formData, surname: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Phone
            </label>
            <input
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Address
          </label>
          <textarea
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
            placeholder="Street, City, Postcode, Country"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Source *
            </label>
            <select
              className="w-full px-4 py-2 border rounded-lg outline-none bg-white"
              value={formData.source}
              onChange={(e) =>
                setFormData({ ...formData, source: e.target.value })
              }
            >
              {[
                "Referral",
                "Social Media",
                "Networking",
                "Cold Outreach",
                "Affiliate",
                "Other",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Work Type
            </label>
            <select
              className="w-full px-4 py-2 border rounded-lg outline-none bg-white"
              value={formData.work_type}
              onChange={(e) =>
                setFormData({ ...formData, work_type: e.target.value })
              }
            >
              <option value="Ad-hoc">Ad-hoc</option>
              <option value="Retainer">Retainer</option>
              <option value="Hourly">Hourly</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Business Name
          </label>
          <input
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
            value={formData.business_name}
            onChange={(e) =>
              setFormData({ ...formData, business_name: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Websites & Social Links
          </label>
          <div className="space-y-3">
            {websiteLinks.length === 0 && (
              <button
                type="button"
                onClick={() => setWebsiteLinks([""])}
                className="text-sm font-semibold text-[#9d4edd] hover:underline"
              >
                + Add website address
              </button>
            )}
            {websiteLinks.map((link, index) => (
              <div key={`website-${index}`} className="flex flex-col gap-2">
                <input
                  type="url"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
                  placeholder="Web page URL"
                  value={link}
                  onChange={(event) => {
                    const next = [...websiteLinks];
                    next[index] = event.target.value;
                    setWebsiteLinks(next);
                  }}
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const next = websiteLinks.filter((_, i) => i !== index);
                      setWebsiteLinks(next);
                    }}
                    className="text-xs font-semibold text-gray-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                  {index === websiteLinks.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setWebsiteLinks([...websiteLinks, ""])}
                      className="text-sm font-semibold text-[#9d4edd] hover:underline"
                    >
                      + Add another website address
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Summary of scope of work & rates
          </label>
          <textarea
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
            placeholder="Summarize the scope of work and agreed rates..."
            value={formData.initial_notes}
            onChange={(e) =>
              setFormData({ ...formData, initial_notes: e.target.value })
            }
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#9d4edd] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#7b2cbf] disabled:opacity-50 transition-all"
          >
            {loading ? "Saving..." : "Save and Open Profile"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-8 py-3 text-gray-500 hover:text-gray-700 font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
