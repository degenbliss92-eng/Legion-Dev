import { NextRequest, NextResponse } from "next/server";

type HeliusTransaction = Record<string, any>;

type ActivityItem = {
  signature: string;
  timestamp: number | null;
  summary: string;
  direction: "in" | "out" | "neutral";
  amount: number | null;
  symbol: string | null;
  rawType: string;
  from: string | null;
  to: string | null;
};

type ApiResponse = {
  address: string;
  items: ActivityItem[];
};

type CacheEntry = {
  timestamp: number;
  payload: ApiResponse;
};

const HELIUS_API_BASE = process.env.HELIUS_API_BASE ?? "https://api.helius.xyz/v0";
const DEFAULT_LIMIT = 20;
const CACHE_TTL_MS = Number(process.env.HELIUS_CACHE_TTL_MS ?? 15_000);

const cache = new Map<string, CacheEntry>();

function cacheKey(address: string, limit: number) {
  return `${address.toLowerCase()}::${limit}`;
}

function shortAddress(address: string | null | undefined) {
  if (!address) return "unknown";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatTokenAmount(
  raw: string | number | null | undefined,
  decimals: number | string | null | undefined
) {
  if (raw === null || raw === undefined) return null;
  const amount = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(amount)) return null;
  const decimalsNumber = typeof decimals === "string" ? Number(decimals) : decimals ?? 0;
  const divisor = decimalsNumber ? Math.pow(10, decimalsNumber) : 1;
  return amount / divisor;
}

function summarizeTransaction(tx: HeliusTransaction, monitoredAddress: string): ActivityItem {
  const signature = tx?.signature ?? tx?.transactionSignature ?? "unknown";
  const timestampSeconds = tx?.timestamp ?? tx?.blockTime ?? null;
  const tokenTransfers: any[] = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];
  const nativeTransfers: any[] = Array.isArray(tx?.nativeTransfers) ? tx.nativeTransfers : [];

  let summary = tx?.description ?? tx?.type ?? "Transaction";
  let direction: "in" | "out" | "neutral" = "neutral";
  let amount: number | null = null;
  let symbol: string | null = null;

  const tokenPerspective = tokenTransfers.find((transfer) =>
    transfer?.fromUserAccount === monitoredAddress || transfer?.toUserAccount === monitoredAddress
  );

  if (tokenPerspective) {
    const value = formatTokenAmount(tokenPerspective.tokenAmount, tokenPerspective.decimals);
    if (value !== null) {
      amount = value;
      symbol = tokenPerspective.tokenSymbol ?? shortAddress(tokenPerspective.mint);
      direction = tokenPerspective.toUserAccount === monitoredAddress ? "in" : "out";
      summary = `${direction === "in" ? "Received" : "Sent"} ${value.toFixed(4)} ${symbol}`;
    }
  } else {
    const nativePerspective = nativeTransfers.find((transfer) =>
      transfer?.fromUserAccount === monitoredAddress || transfer?.toUserAccount === monitoredAddress
    );

    if (nativePerspective) {
      const lamports = Number(nativePerspective.lamports ?? nativePerspective.amount ?? 0);
      if (Number.isFinite(lamports) && lamports !== 0) {
        amount = lamports / 1_000_000_000;
        symbol = "SOL";
        direction = nativePerspective.toUserAccount === monitoredAddress ? "in" : "out";
        summary = `${direction === "in" ? "Deposited" : "Withdrew"} ${amount.toFixed(4)} SOL`;
      }
    }
  }

  const participants = tokenPerspective ?? nativeTransfers[0] ?? null;
  const fromLabel = participants?.fromUserAccount ? shortAddress(participants.fromUserAccount) : null;
  const toLabel = participants?.toUserAccount ? shortAddress(participants.toUserAccount) : null;

  return {
    signature,
    timestamp: timestampSeconds ? timestampSeconds * 1000 : null,
    summary,
    direction,
    amount,
    symbol,
    rawType: tx?.type ?? tx?.events?.type ?? "unknown",
    from: fromLabel,
    to: toLabel,
  };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.HELIUS_API_KEY;
  const defaultAddress = process.env.HELIUS_MONITORED_ADDRESS;

  if (!apiKey) {
    return NextResponse.json(
      { error: "HELIUS_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const addressParam = searchParams.get("address");
  const address = addressParam ?? defaultAddress;

  if (!address) {
    return NextResponse.json(
      { error: "No address provided. Set HELIUS_MONITORED_ADDRESS or supply ?address=.", items: [] },
      { status: 400 }
    );
  }

  const limitParam = searchParams.get("limit");
  const limit = Math.max(1, Math.min(Number(limitParam ?? DEFAULT_LIMIT), 100));
  const key = cacheKey(address, limit);

  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }

  const endpoint = `${HELIUS_API_BASE}/addresses/${address}/transactions?api-key=${apiKey}&limit=${limit}`;

  try {
    const heliusResponse = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!heliusResponse.ok) {
      const errorText = await heliusResponse.text();
      if (cached) {
        return NextResponse.json({ ...cached.payload, cached: true, stale: true });
      }
      return NextResponse.json(
        { error: `Helius request failed (${heliusResponse.status})`, detail: errorText },
        { status: heliusResponse.status }
      );
    }

    const payload = await heliusResponse.json();
    const transactions: HeliusTransaction[] = Array.isArray(payload) ? payload : [];
    const items = transactions.map((tx) => summarizeTransaction(tx, address));

    const responsePayload: ApiResponse = { address, items };
    cache.set(key, { timestamp: now, payload: responsePayload });

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    if (cached) {
      return NextResponse.json({ ...cached.payload, cached: true, stale: true });
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
