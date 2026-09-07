import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshPortfolioMarketData } from "@/lib/market-data/refresh";

function authorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (!authorization) return false;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  if (process.env.PORTFOLIO_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.PORTFOLIO_REFRESH_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Portfolio refresh is not configured." },
      { status: 503 }
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await refreshPortfolioMarketData();
    return NextResponse.json({
      complete: summary.failures.length === 0,
      quotes: summary.quotes,
      rates: summary.rates,
      failures: summary.failures,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Market data could not be refreshed. Cached values were kept.",
      },
      { status: 503 }
    );
  }
}
