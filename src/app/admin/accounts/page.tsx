import type { Metadata } from "next";
import { AccountsClient } from "./accounts-client";

export const metadata: Metadata = {
  title: "Administrative assistants",
};

export default function AdminAccountsPage() {
  return <AccountsClient />;
}
