"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, LOCALES, type Locale, type TranslationKey } from "./translations";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("th")) return "th";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("es")) return "es";
  if (lang.startsWith("de")) return "de";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    const detected = saved && LOCALES.includes(saved) ? saved : detectBrowserLocale();
    setLocaleState(detected);
    document.documentElement.lang = detected;
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>): string => {
      let value: string = translations[locale]?.[key] || translations.en[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, v);
        }
      }
      return value;
    },
    [locale]
  );

  // Prevent hydration mismatch by rendering English until client hydrates
  const contextValue: I18nContextType = {
    locale: mounted ? locale : "en",
    setLocale,
    t: mounted ? t : (key: TranslationKey) => translations.en[key] || key,
  };

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
