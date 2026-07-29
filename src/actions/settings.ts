"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { aggregateMoney } from "@/lib/money/conversion";
import {
  currencyCodeSchema,
  manualExchangeRateSchema,
} from "@/lib/money/validation";

const SETTINGS_ID = "singleton";

async function ensureSettings() {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      reportingCurrency: "PYG",
      timezone: "America/Asuncion",
    },
  });
}

function revalidateCurrencyViews() {
  revalidatePath("/");
  revalidatePath("/analytics");
}

export async function getCurrencyConfiguration() {
  const [settings, rates] = await Promise.all([
    ensureSettings(),
    prisma.exchangeRate.findMany({
      where: { source: "MANUAL" },
      orderBy: [{ active: "desc" }, { fromCurrency: "asc" }],
    }),
  ]);

  return {
    reportingCurrency: settings.reportingCurrency,
    timezone: settings.timezone,
    rates: rates.map((rate) => ({
      id: rate.id,
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate.toString(),
      active: rate.active,
      asOf: rate.asOf.toISOString(),
    })),
  };
}

export async function getBankBalanceSummary() {
  const settings = await ensureSettings();
  const [accounts, rates] = await Promise.all([
    prisma.bankAccount.findMany({
      select: { balance: true, currency: true },
    }),
    prisma.exchangeRate.findMany({
      where: {
        active: true,
        toCurrency: settings.reportingCurrency,
      },
      select: {
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        active: true,
        source: true,
      },
    }),
  ]);

  return aggregateMoney(
    accounts.map((account) => ({
      amount: account.balance.toString(),
      currency: account.currency,
    })),
    settings.reportingCurrency,
    rates.map((rate) => ({
      ...rate,
      rate: rate.rate.toString(),
    }))
  );
}

export async function updateReportingCurrency(formData: FormData) {
  const parsedCurrency = currencyCodeSchema.safeParse(
    formData.get("reportingCurrency")
  );

  if (!parsedCurrency.success) {
    return { error: parsedCurrency.error.issues[0]?.message ?? "Invalid currency" };
  }

  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { reportingCurrency: parsedCurrency.data },
    create: {
      id: SETTINGS_ID,
      reportingCurrency: parsedCurrency.data,
      timezone: "America/Asuncion",
    },
  });

  revalidateCurrencyViews();
  return { success: true as const };
}

export async function upsertManualExchangeRate(formData: FormData) {
  const parsedRate = manualExchangeRateSchema.safeParse({
    fromCurrency: formData.get("fromCurrency"),
    toCurrency: formData.get("toCurrency"),
    rate: formData.get("rate"),
  });

  if (!parsedRate.success) {
    return {
      error: parsedRate.error.issues[0]?.message ?? "Invalid exchange rate",
    };
  }

  const now = new Date();
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency_source: {
        fromCurrency: parsedRate.data.fromCurrency,
        toCurrency: parsedRate.data.toCurrency,
        source: "MANUAL",
      },
    },
    update: {
      rate: parsedRate.data.rate,
      active: true,
      asOf: now,
      fetchedAt: now,
    },
    create: {
      fromCurrency: parsedRate.data.fromCurrency,
      toCurrency: parsedRate.data.toCurrency,
      source: "MANUAL",
      rate: parsedRate.data.rate,
      active: true,
      asOf: now,
      fetchedAt: now,
    },
  });

  revalidateCurrencyViews();
  return { success: true as const };
}

export async function deactivateManualExchangeRate(id: string) {
  const rate = await prisma.exchangeRate.findFirst({
    where: { id, source: "MANUAL" },
    select: { id: true },
  });

  if (!rate) {
    return { error: "Exchange rate not found" };
  }

  await prisma.exchangeRate.update({
    where: { id: rate.id },
    data: { active: false },
  });

  revalidateCurrencyViews();
  return { success: true as const };
}
