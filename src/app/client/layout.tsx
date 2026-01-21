"use client";

import ImpersonationBanner from "@/components/ImpersonationBanner";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ImpersonationBanner />
      {children}
    </>
  );
}
