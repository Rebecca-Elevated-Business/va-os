"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User, Building2 } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("profile");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    legal_name: "",
    display_name: "",
    email: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [business, setBusiness] = useState({
    company_name: "",
    website_url: "",
    phone: "",
    email: "",
    facebook_url: "",
    linkedin_url: "",
    instagram_url: "",
    logo_url: "",
  });
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessMessage, setBusinessMessage] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMessage, setLogoMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase
          .from("profiles")
          .select("full_name, display_name")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile({
            legal_name: data.full_name || "",
            display_name: data.display_name || data.full_name || "",
            email: user.email || "",
          });
        }

        const { data: businessData } = await supabase
          .from("va_business_details")
          .select("*")
          .eq("va_id", user.id)
          .maybeSingle();

        if (businessData) {
          setBusiness({
            company_name: businessData.company_name || "",
            website_url: businessData.website_url || "",
            phone: businessData.phone || "",
            email: businessData.email || "",
            facebook_url: businessData.facebook_url || "",
            linkedin_url: businessData.linkedin_url || "",
            instagram_url: businessData.instagram_url || "",
            logo_url: businessData.logo_url || "",
          });
        }
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  if (loading)
    return <div className="p-10 text-gray-400 italic">Loading settings...</div>;

  const sections = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "business", label: "Business Details", icon: Building2 },
  ];

  const handleProfileSave = async () => {
    if (!userId) return;
    setSavingProfile(true);
    setProfileMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: profile.display_name })
      .eq("id", userId);

    if (error) {
      setProfileMessage("Could not save profile. Please try again.");
    } else {
      setProfileMessage("Profile updated.");
    }
    setSavingProfile(false);
  };

  const handleSendReset = async () => {
    if (!profile.email) return;
    setSendingReset(true);
    setProfileMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email);
    if (error) {
      setProfileMessage("Could not send reset email. Please try again.");
    } else {
      setProfileMessage("Password reset email sent.");
    }
    setSendingReset(false);
  };

  const handleBusinessSave = async () => {
    if (!userId) return;
    setSavingBusiness(true);
    setBusinessMessage("");
    const payload = {
      va_id: userId,
      company_name: business.company_name || null,
      website_url: business.website_url || null,
      phone: business.phone || null,
      email: business.email || null,
      facebook_url: business.facebook_url || null,
      linkedin_url: business.linkedin_url || null,
      instagram_url: business.instagram_url || null,
      logo_url: business.logo_url || null,
    };
    const { error } = await supabase
      .from("va_business_details")
      .upsert(payload, { onConflict: "va_id" });

    if (error) {
      setBusinessMessage("Could not save business details. Please try again.");
    } else {
      setBusinessMessage("Business details updated.");
    }
    setSavingBusiness(false);
  };

  const handleLogoUpload = async (file: File) => {
    if (!userId) return;
    setLogoUploading(true);
    setLogoMessage("");
    const extension = file.name.split(".").pop() || "png";
    const filePath = `${userId}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("va-logos")
      .upload(filePath, file, {
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      setLogoMessage("Logo upload failed. Please try again.");
      setLogoUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("va-logos")
      .getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("va_business_details")
      .upsert(
        { va_id: userId, logo_url: publicUrl },
        { onConflict: "va_id" }
      );

    if (updateError) {
      setLogoMessage("Logo saved but could not update the profile.");
    } else {
      setBusiness((prev) => ({
        ...prev,
        logo_url: publicUrl,
      }));
      setLogoMessage("Logo uploaded.");
    }
    setLogoUploading(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* 1. HEADER */}
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-[#333333]">
          Settings
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* 2. SIDE NAVIGATION */}
        <aside className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 rounded-2xl font-semibold text-sm transition-all ${
                  activeSection === section.id
                    ? "bg-[#f3e8ff] text-[#5b21b6] shadow-sm"
                    : "text-gray-500 hover:bg-white hover:text-[#333333]"
                }`}
              >
                <Icon size={18} />
                {section.label}
              </button>
            );
          })}
        </aside>

        {/* 3. CONTENT AREA */}
        <main className="md:col-span-3">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 min-h-125">
            {activeSection === "profile" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-black text-gray-800 mb-1">
                    Public Profile
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">
                    Manage how your name appears to clients.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                        Name shown to clients
                      </label>
                      <input
                        className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                        value={profile.display_name}
                        onChange={(event) => {
                          setProfile((prev) => ({
                            ...prev,
                            display_name: event.target.value,
                          }));
                          setProfileMessage("");
                        }}
                      />
                    </div>
                    <div className="space-y-2 pt-4 border-t border-gray-100">
                      <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                        Name on account
                      </label>
                      <input
                        className="w-full p-4 bg-gray-100/80 border border-gray-100 rounded-2xl outline-none font-semibold text-gray-600 cursor-not-allowed"
                        value={profile.legal_name}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                      Email address
                    </label>
                    <input
                      className="w-full p-4 bg-gray-100/80 border border-gray-100 rounded-2xl outline-none text-gray-500 font-medium cursor-not-allowed"
                      value={profile.email}
                      disabled
                    />
                    <p className="text-xs text-gray-500 ml-1">
                      Please email admin@elevatedbusiness.co.uk to update your
                      name on account and/or email address.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50 flex flex-wrap gap-4 items-center">
                  <button
                    type="button"
                    onClick={handleProfileSave}
                    disabled={savingProfile}
                    className="bg-[#9d4edd] text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-md hover:bg-[#7b2cbf] transition-all disabled:bg-gray-300"
                  >
                    {savingProfile ? "Saving..." : "Update profile"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReset}
                    disabled={sendingReset}
                    className="bg-gray-50 border border-gray-200 text-gray-500 px-6 py-3 rounded-xl font-semibold text-sm hover:border-gray-300 hover:text-[#333333] hover:bg-gray-100 transition-all disabled:text-gray-300"
                  >
                    {sendingReset
                      ? "Sending..."
                      : "Send password reset email"}
                  </button>
                  {profileMessage && (
                    <span className="text-xs text-gray-500">
                      {profileMessage}
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeSection === "business" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-xl font-black mb-1">Business Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                      Company name
                    </label>
                    <input
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                      value={business.company_name}
                      onChange={(event) =>
                        setBusiness((prev) => ({
                          ...prev,
                          company_name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                      Website url
                    </label>
                    <input
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                      value={business.website_url}
                      onChange={(event) =>
                        setBusiness((prev) => ({
                          ...prev,
                          website_url: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                      Phone number
                    </label>
                    <input
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                      value={business.phone}
                      onChange={(event) =>
                        setBusiness((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                      Business email
                    </label>
                    <input
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                      value={business.email}
                      onChange={(event) =>
                        setBusiness((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400 tracking-wide ml-1">
                        Facebook url
                      </label>
                      <input
                        className="w-full p-4 bg-white border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                        value={business.facebook_url}
                        onChange={(event) =>
                          setBusiness((prev) => ({
                            ...prev,
                            facebook_url: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400 tracking-wide ml-1">
                        LinkedIn url
                      </label>
                      <input
                        className="w-full p-4 bg-white border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                        value={business.linkedin_url}
                        onChange={(event) =>
                          setBusiness((prev) => ({
                            ...prev,
                            linkedin_url: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400 tracking-wide ml-1">
                        Instagram url
                      </label>
                      <input
                        className="w-full p-4 bg-white border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-semibold text-gray-800"
                        value={business.instagram_url}
                        onChange={(event) =>
                          setBusiness((prev) => ({
                            ...prev,
                            instagram_url: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2 bg-gray-50/70 border border-gray-100 rounded-2xl p-5">
                    <label className="text-xs font-semibold text-gray-500 tracking-wide ml-1">
                      Upload logo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={logoUploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                      className="w-full text-sm text-gray-500 file:mr-4 file:rounded-xl file:border-0 file:bg-gray-100 file:px-4 file:py-3 file:text-xs file:font-semibold file:text-gray-600 hover:file:bg-gray-200"
                    />
                    {logoMessage && (
                      <p className="text-xs text-gray-500 ml-1">
                        {logoMessage}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 ml-1">
                      Recommended logo size: 300px wide by 80px high.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50 flex flex-wrap gap-4 items-center">
                  <button
                    type="button"
                    onClick={handleBusinessSave}
                    disabled={savingBusiness}
                    className="bg-[#9d4edd] text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-md hover:bg-[#7b2cbf] transition-all disabled:bg-gray-300"
                  >
                    {savingBusiness ? "Saving..." : "Save business details"}
                  </button>
                  {businessMessage && (
                    <span className="text-xs text-gray-500">
                      {businessMessage}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
