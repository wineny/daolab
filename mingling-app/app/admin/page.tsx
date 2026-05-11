import { AdminConsole } from "../_components/AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  return <AdminConsole adminKey={key ?? ""} />;
}
