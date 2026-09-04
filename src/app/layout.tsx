import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AcademyHeader } from "@/components/brand/AcademyHeader";
import { AcademyFooter } from "@/components/brand/AcademyFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toronto Academy | French Language Assessment",
  description:
    "French language diagnostic assessment for Toronto Academy of Education students.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-academy-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>
        <AcademyHeader />
        {/* A column flex container so a page can opt into filling the
            viewport with flex-1. Pages that do not stay content sized. */}
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
        <AcademyFooter />
      </body>
    </html>
  );
}
