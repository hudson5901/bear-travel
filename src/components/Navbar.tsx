"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Search, Globe, DollarSign } from "lucide-react";
import { BearLogo } from "./BearMascot";
import { useI18n } from "@/i18n/context";
import { LOCALES, LOCALE_NAMES } from "@/i18n/translations";
import { useCurrency, CURRENCIES } from "@/lib/currency";

const NAV_KEYS = [
  { href: "/experiences", key: "nav.experiences" as const },
  { href: "/destinations", key: "nav.destinations" as const },
  { href: "/themes", key: "nav.themes" as const },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [currOpen, setCurrOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const { currency, setCurrency } = useCurrency();

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <BearLogo className="w-9 h-9" />
            <span className="font-heading font-bold text-xl text-navy">
              Bear<span className="text-orange">Tour</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_KEYS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-navy/70 hover:text-orange transition-colors"
              >
                {t(link.key)}
              </Link>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/search"
              className="p-2 text-navy/60 hover:text-orange transition-colors"
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Currency Switcher */}
            <div className="relative">
              <button
                onClick={() => { setCurrOpen(!currOpen); setLangOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-navy/60 hover:text-orange rounded-lg hover:bg-cream transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>{currency}</span>
              </button>
              {currOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-cream-dark py-1 min-w-[100px] z-50">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCurrency(c); setCurrOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-cream transition-colors ${
                        c === currency ? "text-orange font-medium" : "text-navy/70"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => { setLangOpen(!langOpen); setCurrOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-navy/60 hover:text-orange rounded-lg hover:bg-cream transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span className="uppercase">{locale}</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-cream-dark py-1 min-w-[140px] z-50">
                  {LOCALES.map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setLocale(l);
                        setLangOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-cream transition-colors ${
                        l === locale ? "text-orange font-medium" : "text-navy/70"
                      }`}
                    >
                      {LOCALE_NAMES[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-navy"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-3 space-y-2">
            {NAV_KEYS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2 text-navy/70 hover:text-orange transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {t(link.key)}
              </Link>
            ))}
            <Link
              href="/search"
              className="block py-2 text-navy/70 hover:text-orange transition-colors"
              onClick={() => setIsOpen(false)}
            >
              {t("nav.search")}
            </Link>

            {/* Mobile language */}
            <div className="pt-2 border-t border-cream-dark">
              <div className="flex items-center gap-1.5 text-sm text-navy/50 mb-2">
                <Globe className="w-4 h-4" />
                Language
              </div>
              <div className="grid grid-cols-2 gap-1">
                {LOCALES.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLocale(l);
                      setIsOpen(false);
                    }}
                    className={`text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      l === locale ? "bg-orange/10 text-orange font-medium" : "text-navy/60 hover:bg-cream"
                    }`}
                  >
                    {LOCALE_NAMES[l]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
