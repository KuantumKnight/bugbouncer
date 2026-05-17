import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BugBouncer | Research-as-a-Service QA Pipeline",
  description: "High-signal deterministic stability engine for modern SaaS.",
};

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#10b981', // emerald-500
          colorBackground: '#09090b', // zinc-950
          colorText: '#f4f4f5', // zinc-100
        }
      }}
    >
      <html lang="en" className="h-full">
        <body
          className={`${inter.variable} ${firaCode.variable} font-sans antialiased bg-zinc-950 text-zinc-200 min-h-screen flex flex-col`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
