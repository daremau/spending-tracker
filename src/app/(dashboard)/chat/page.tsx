export const dynamic = "force-dynamic";

import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getChatbotStatus } from "@/actions/chatbot-settings";
import { Chatbot } from "@/components/chat/chatbot";
import { ChatbotSettingsForm } from "@/components/chat/chatbot-settings-form";
import { prisma } from "@/lib/prisma";

export default async function ChatPage() {
  const [accounts, incomeCategories, expenseCategories, status, memoryCount] =
    await Promise.all([
      getAccounts(),
      getCategories("INCOME"),
      getCategories("EXPENSE"),
      getChatbotStatus(),
      prisma.chatbotMemoryRule.count(),
    ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Bot de transacciones</h1>
        <p className="text-sm text-muted-foreground">
          Screenshot o texto → revisás → confirmás. Todo lo cargado acá lleva
          etiqueta Bot.
        </p>
      </div>
      <ChatbotSettingsForm status={status} />
      {accounts.length === 0 ? (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">
          Creá primero una cuenta bancaria para poder cargar transacciones.
        </p>
      ) : (
        <Chatbot
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          incomeCategories={incomeCategories.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
          }))}
          expenseCategories={expenseCategories.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
          }))}
          defaultAccountId={accounts[0]?.id ?? null}
          memoryCount={memoryCount}
        />
      )}
    </div>
  );
}
