import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Import Inter from Google Fonts
import "./globals.css";

// Configure Inter with the weights you specified (400, 500, 600)
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter", // Optional: allows use via CSS variable
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
      {/* Apply inter.className to the body to make it the global default */}
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
