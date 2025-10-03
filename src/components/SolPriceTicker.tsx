"use client";

import { useEffect, useMemo, useState } from "react";

const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v3";
const POLL_INTERVAL_MS = 15000;

type TokenConfig = {
  symbol: string;
  mint: string;
};

type LitePriceEntry = {
  usdPrice?: number;
};

type LitePriceResponse = Record<string, LitePriceEntry | undefined>;

const TOKENS: TokenConfig[] = [
  { symbol: "$SOL", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "$LEGION", mint: "So11111111111111111111111111111111111111112" },
];

const INITIAL_PRICES: Record<string, number | null> = Object.fromEntries(
  TOKENS.map(({ mint }) => [mint, null])
) as Record<string, number | null>;

async function fetchTokenPrices(mints: string[]): Promise<Record<string, number | null>> {
  const uniqueMints = Array.from(new Set(mints.filter(Boolean)));
  if (uniqueMints.length === 0) return {};

  try {
    const url = new URL(JUPITER_PRICE_URL);
    url.searchParams.set("ids", uniqueMints.join(","));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`Jupiter price request failed (${response.status})`);
      return Object.fromEntries(uniqueMints.map((mint) => [mint, null]));
    }

    const payload = (await response.json()) as LitePriceResponse;
    return Object.fromEntries(
      uniqueMints.map((mint) => {
        const entry = payload?.[mint];
        return [mint, typeof entry?.usdPrice === "number" ? entry.usdPrice : null];
      })
    );
  } catch (error) {
    console.warn("Failed to fetch token price:", error);
    return Object.fromEntries(uniqueMints.map((mint) => [mint, null]));
  }
}

function formatUsdPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(2)}`;
}

export default function SolPriceTicker() {
  const [prices, setPrices] = useState<Record<string, number | null>>(INITIAL_PRICES);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const nextPrices = await fetchTokenPrices(TOKENS.map(({ mint }) => mint));
      if (!cancelled) {
        setPrices((prev) => ({ ...prev, ...nextPrices }));
      }
      timer = setTimeout(load, POLL_INTERVAL_MS);
    };

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const lines = useMemo(
    () =>
      TOKENS.map(({ symbol, mint }) => `${symbol} - ${formatUsdPrice(prices[mint] ?? null)}`),
    [prices]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
        fontSize: "0.8rem",
        color: "rgba(255,255,255,0.78)",
      }}
    >
      {lines.map((line, idx) => (
        <span key={idx}>{line}</span>
      ))}
    </div>
  );
}