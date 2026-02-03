import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PromptProvider } from "@/components/ui/PromptProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VA Operating System",
  description: "Professional management portal for Virtual Assistants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <PromptProvider>{children}</PromptProvider>
      </body>
    </html>
  );
}
