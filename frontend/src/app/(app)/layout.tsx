"use client";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = [
    { href: "/dashboard", label: "Dash", icon: "◧" },
    { href: "/work-orders", label: "Work", icon: "≡" },
    ...(user?.role === "owner" ? [{ href: "/users", label: "Users", icon: "◐" }] : []),
    ...(user?.role === "technician" ? [{ href: "/work-orders?assigned=me", label: "My Work", icon: "◎" }] : []),
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex items-center justify-around px-2 py-2 z-40">
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href.split("?")[0]);
        return (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium ${active ? "text-white bg-blue-600" : "text-slate-400"}`}>
            <span className="text-sm">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);
  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">Loading…</div>;
  if (!user) return null;
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9fb] overflow-y-auto">
        <div className="pb-16 md:pb-0 w-full">{children}</div>
        <MobileNav />
      </div>
    </div>
  );
}
