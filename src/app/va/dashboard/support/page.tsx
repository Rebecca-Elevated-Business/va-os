"use client";

export default function SupportPage() {
  return (
    <div className="px-6 pb-12 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2f2a4a]">Support Request</h1>
        <p className="mt-2 text-sm text-[#5b5b5b]">
          Complete the form below and our team will get back to you.
        </p>
      </div>
      <div className="rounded-2xl border border-[#efe7fb] bg-white shadow-sm overflow-hidden">
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSdXBgLTf18NCcZkS14cZRAvb9Ne_Dhvn9bS4_fNQ3D9LQBFEw/viewform?embedded=true"
          title="Support request form"
          className="w-full h-[900px] min-h-[80vh]"
          frameBorder="0"
          marginHeight={0}
          marginWidth={0}
        >
          Loading…
        </iframe>
      </div>
    </div>
  );
}
