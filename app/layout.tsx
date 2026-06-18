import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeadFinder Console",
  description: "Advanced OpenStreetMap Lead-Gen Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} antialiased`}
    >
      <body className="bg-[#f5f5ee] text-[#1c1c1c] min-h-screen flex flex-col overflow-y-auto overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}


