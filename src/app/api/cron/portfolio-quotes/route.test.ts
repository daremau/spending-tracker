import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshPortfolioMarketData } from "@/lib/market-data/refresh";
import { POST } from "./route";

vi.mock("@/lib/market-data/refresh", () => ({
  refreshPortfolioMarketData: vi.fn(),
}));

const originalEnvironment = {
  PORTFOLIO_ENABLED: process.env.PORTFOLIO_ENABLED,
  PORTFOLIO_REFRESH_SECRET: process.env.PORTFOLIO_REFRESH_SECRET,
};

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/portfolio-quotes", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("portfolio quote cron authorization", () => {
  beforeEach(() => {
    process.env.PORTFOLIO_ENABLED = "true";
    process.env.PORTFOLIO_REFRESH_SECRET = "refresh-secret";
    vi.mocked(refreshPortfolioMarketData).mockResolvedValue({
      quotes: {
        requested: 1,
        updated: 1,
        skippedManual: 0,
        skippedFresh: 0,
        skippedUnlinked: 0,
      },
      rates: {
        requested: 0,
        updated: 0,
        skippedManual: 0,
        skippedFresh: 0,
      },
      failures: [],
    });
  });

  afterEach(() => {
    if (originalEnvironment.PORTFOLIO_ENABLED === undefined) {
      delete process.env.PORTFOLIO_ENABLED;
    } else {
      process.env.PORTFOLIO_ENABLED =
        originalEnvironment.PORTFOLIO_ENABLED;
    }
    if (originalEnvironment.PORTFOLIO_REFRESH_SECRET === undefined) {
      delete process.env.PORTFOLIO_REFRESH_SECRET;
    } else {
      process.env.PORTFOLIO_REFRESH_SECRET =
        originalEnvironment.PORTFOLIO_REFRESH_SECRET;
    }
    vi.clearAllMocks();
  });

  it("returns 401 for missing and incorrect bearer credentials", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("Bearer wrong"))).status).toBe(401);
    expect(refreshPortfolioMarketData).not.toHaveBeenCalled();
  });

  it("runs the shared refresh service for the correct secret", async () => {
    const response = await POST(request("Bearer refresh-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      complete: true,
      quotes: { updated: 1 },
    });
    expect(refreshPortfolioMarketData).toHaveBeenCalledTimes(1);
  });

  it("does not expose a route when the portfolio is disabled", async () => {
    process.env.PORTFOLIO_ENABLED = "false";
    expect((await POST(request("Bearer refresh-secret"))).status).toBe(404);
  });

  it("reports missing server configuration without revealing values", async () => {
    delete process.env.PORTFOLIO_REFRESH_SECRET;
    const response = await POST(request("Bearer anything"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "refresh-secret"
    );
  });
});
