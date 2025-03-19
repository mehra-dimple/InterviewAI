import "./globals.css";
import "@/styles/darkMode.css";
import { Inter } from "next/font/google";
import React from "react";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "InterviewAI",
  description: "An advanced AI system that conducts personalized interviews, provides targeted feedback, and optimizes performance over time based on user experience.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200`}>
        <div className="mx-auto flex flex-col space-y-4">
          <div>
            <main className="py-8 flex w-full flex-1 flex-col overflow-hidden">
              <div className="mx-auto flex flex-col gap-4">
                <div className="flex items-center justify-center gap-3">
                  <Image
                    src="/images/brain_image.jpg"
                    alt="AI Brain"
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                  <h1 className="text-4xl font-bold leading-[1.1] tracking-tighter">
                    InterviewAI
                  </h1>
                </div>
                <div className="flex flex-col gap-4">{children}</div>
              </div>
            </main>
          </div>
        </div>
        <ThemeToggle />
      </body>
    </html>
  );
}
