import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans, Special_Elite } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "700", "800"] });
const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"] });
// Typewriter face for the vintage train tickets.
const typewriter = Special_Elite({ variable: "--font-typewriter", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Tripsy — plan one trip, zero chasing",
  description: "Collect everyone's dates and wishes, find common days, swipe on plans, and lock the trip — without anyone chasing anyone.",
};

export const viewport: Viewport = {
  themeColor: "#ff6b4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${typewriter.variable} antialiased`}>
      <body className="font-sans">
        <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-24">{children}</div>
      </body>
    </html>
  );
}
