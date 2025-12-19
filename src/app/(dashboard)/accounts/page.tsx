export const dynamic = 'force-dynamic';

import { getAccounts } from "@/actions/accounts";
import { AccountForm } from "@/components/forms/account-form";
import { AccountCard } from "./account-card";

export default async function AccountsPage() {
  const accounts = await getAccounts();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bank Accounts</h2>
        <AccountForm />
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No accounts yet</p>
          <p className="text-sm">Add your first bank account to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
