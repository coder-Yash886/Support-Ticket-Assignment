import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Support Desk | Operations & Triage",
  description: "Fast, focused support ticket workspace with real-time SLA tracking and AI triage review",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
        <Providers>
          <div className="flex flex-col min-h-screen">
            <React.Suspense fallback={<header className="h-14 border-b border-slate-200 bg-white" />}>
              <Header />
            </React.Suspense>
            <main className="flex-1 pb-16">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
