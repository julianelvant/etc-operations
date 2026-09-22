import type { Metadata } from "next";
import { AccountsClient } from "./accounts-client";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AdminAccountsPage() {
  return <AccountsClient />;
}
