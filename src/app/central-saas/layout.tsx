import "@/app/globals.css";
import { AdminSidebar } from "./_components/AdminSidebar";
import { checkAdminAccess } from "./_actions/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Proteger a rota no servidor
  const { allowed, user } = await checkAdminAccess();

  if (!allowed) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-brand-background flex font-brand-secondary">
      <AdminSidebar user={user} />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
