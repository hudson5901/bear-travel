"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export const CURRENCIES = ["JPY", "USD", "EUR", "GBP", "AUD", "KRW", "CNY", "THB"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Approximate exchange rates relative to JPY (1 JPY = X foreign currency)
// These are rough rates for display purposes only
const RATES_FROM_JPY: Record<Currency, number> = {
  JPY: 1,
  USD: 0.0067,
  EUR: 0.0061,
  GBP: 0.0053,
  AUD: 0.0103,
  KRW: 9.2,
  CNY: 0.049,
  THB: 0.23,
};

const RATES_FROM_USD: Record<Currency, number> = {
  JPY: 150,
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.54,
  KRW: 1380,
  CNY: 7.3,
  THB: 35,
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  JPY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  KRW: "₩",
  CNY: "¥",
  THB: "฿",
};

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (amount: number, from: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("currency") as Currency | null;
    if (saved && CURRENCIES.includes(saved)) {
      setCurrencyState(saved);
    }
    setMounted(true);
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("currency", c);
  }, []);

  const convert = useCallback(
    (amount: number, from: string): string => {
      if (!amount || amount <= 0) return `${CURRENCY_SYMBOLS[currency]}0`;

      const fromCurrency = from.toUpperCase() as Currency;
      const target = mounted ? currency : "USD";

      if (fromCurrency === target) {
        return formatCurrency(amount, target);
      }

      // Convert to USD first, then to target
      let inUsd: number;
      if (fromCurrency === "USD") {
        inUsd = amount;
      } else if (fromCurrency === "JPY") {
        inUsd = amount * RATES_FROM_JPY.USD;
      } else {
        // Convert from foreign to USD
        const rate = RATES_FROM_USD[fromCurrency];
        inUsd = rate ? amount / rate : amount;
      }

      // Convert from USD to target
      let result: number;
      if (target === "USD") {
        result = inUsd;
      } else {
        result = inUsd * RATES_FROM_USD[target];
      }

      return formatCurrency(result, target);
    },
    [currency, mounted]
  );

  return (
    <CurrencyContext.Provider value={{ currency: mounted ? currency : "USD", setCurrency, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}

function formatCurrency(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency];
  if (currency === "JPY" || currency === "KRW") {
    return `${sym}${Math.round(amount).toLocaleString()}`;
  }
  return `${sym}${amount.toFixed(2)}`;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
