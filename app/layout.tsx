import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBP Slides - AI Slide Generator",
  description: "Generate professional slide decks using Nano Banana Pro / Gemini AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background">
        {/* Background gradient effect */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%]"
            style={{
              background: `
                radial-gradient(circle at 30% 20%, rgba(0, 122, 255, 0.08) 0%, transparent 40%),
                radial-gradient(circle at 70% 60%, rgba(88, 86, 214, 0.06) 0%, transparent 40%),
                radial-gradient(circle at 50% 80%, rgba(0, 122, 255, 0.04) 0%, transparent 30%)
              `,
            }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}

