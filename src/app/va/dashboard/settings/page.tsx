"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User, Building2, Bell, Shield, Palette } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("profile");
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
  });

  useEffect(() => {
    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile({
            full_name: data.full_name || "",
            email: user.email || "",
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
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

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
                className={`w-full flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                  activeSection === section.id
                    ? "bg-[#9d4edd] text-white shadow-lg shadow-purple-100"
                    : "text-gray-400 hover:bg-white hover:text-[#333333]"
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
                <div>
                  <h2 className="text-xl font-black mb-1">Public Profile</h2>
                  <p className="text-sm text-gray-400 font-medium">
                    How your name appears to clients.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Full Name
                    </label>
                    <input
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-purple-100 focus:bg-white transition-all font-bold"
                      value={profile.full_name}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Email Address
                    </label>
                    <input
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none text-gray-400 font-medium"
                      value={profile.email}
                      disabled
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50">
                  <button className="bg-[#9d4edd] text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-[#7b2cbf] transition-all">
                    Update Profile
                  </button>
                </div>
              </div>
            )}

            {activeSection !== "profile" && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                  ⚙️
                </div>
                <p className="text-sm font-bold uppercase tracking-widest">
                  {activeSection.replace("_", " ")} module coming soon
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
