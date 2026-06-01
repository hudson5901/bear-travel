import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { I18nProvider } from "@/i18n/context";
import { CurrencyProvider } from "@/lib/currency";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Bear Tour - Discover Japan's Best Experiences",
    template: "%s | Bear Tour",
  },
  description:
    "Discover the best tours and experiences across Japan. Curated from top providers, guided by our friendly bear mascot.",
  metadataBase: new URL("https://bear-travel.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Bear Tour",
    title: "Bear Tour - Discover Japan's Best Experiences",
    description:
      "Discover the best tours and experiences across Japan. Curated from top providers.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bear Tour - Discover Japan's Best Experiences",
    description:
      "Discover the best tours and experiences across Japan. Curated from top providers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col bg-cream text-navy antialiased">
        <I18nProvider>
          <CurrencyProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </CurrencyProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
