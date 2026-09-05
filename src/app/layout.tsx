import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toronto Academy | French Language Assessment",
  description:
    "French language diagnostic assessment for Toronto Academy of Education students.",
};

/**
 * The document shell only. The student facing header and footer live in the
 * (public) route group layout, and the administration area supplies its own
 * internal shell, so /admin never renders the student marketing chrome.
 *
 * Neither route group changes any URL: (public) still serves / and /assessment.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
