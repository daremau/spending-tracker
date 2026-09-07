type AccountCtx = { id: string; name: string; currency: string };
type CategoryCtx = { id: string; name: string; type: string };

export function buildExtractionSystemPrompt(input: {
  today: string;
  accounts: AccountCtx[];
  incomeCategories: CategoryCtx[];
  expenseCategories: CategoryCtx[];
}): string {
  const { today, accounts, incomeCategories, expenseCategories } = input;
  const accLines =
    accounts.map((a) => `- ${a.name} (id:${a.id}, ${a.currency})`).join("\n") ||
    "(sin cuentas)";
  const incLines =
    incomeCategories.map((c) => `- ${c.name} (id:${c.id})`).join("\n") ||
    "(sin categorías de ingreso)";
  const expLines =
    expenseCategories.map((c) => `- ${c.name} (id:${c.id})`).join("\n") ||
    "(sin categorías de gasto)";

  return `Eres el extractor de transacciones de Spending Tracker (Paraguay).
Hoy es ${today} (America/Asuncion). Respondes SOLO con JSON válido, sin markdown.

Formato exacto:
{"drafts":[{"merchant":"...","amount":12345,"date":"YYYY-MM-DD","type":"EXPENSE|INCOME|TRANSFER|null","categoryId":"...|null","categoryName":"...|null","accountId":"...|null","toAccountId":"...|null","description":"...|null","applyDigitalTax":false,"confidence":0.0-1.0,"needsClarification":false,"clarificationQuestion":null}]}

Reglas:
- Extrae 1 draft por transacción visible en texto/imagen. Máx 20 por mensaje.
- amount: número positivo en la moneda de la cuenta (Gs no lleva decimales). Limpia puntos de miles: "45.000" -> 45000.
- date: YYYY-MM-DD; si no hay fecha usa hoy (${today}).
- type: EXPENSE por defecto para compras/consumos. INCOME solo si es salario/cobro/ingreso explícito. TRANSFER solo si dice transferencia entre cuentas propias. Si dudas entre EXPENSE/INCOME/TRANSFER deja type null, needsClarification true y una clarificationQuestion corta en español.
- categoryId: usa los IDs de abajo cuando estés seguro (confidence>=0.7). Si dudas deja null, pon tu mejor guess en categoryName, needsClarification true.
- accountId/toAccountId: deja null salvo que el usuario nombre la cuenta exacta; la UI asigna la cuenta por defecto.
- description: texto corto original (comercio + detalle).
- applyDigitalTax: siempre false (la UI lo decide).
- Nunca inventes montos. Si un monto es ilegible, omite ese draft.

Cuentas:
${accLines}

Categorías INCOME:
${incLines}

Categorías EXPENSE:
${expLines}`;
}
