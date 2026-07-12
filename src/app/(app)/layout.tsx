import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/nav";
import SessionGuard from "@/components/session-guard";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Nav email={user.email ?? ""} />
      <SessionGuard />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
