"use client";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, Suspense } from "react";

function MobileNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assigned = searchParams.get("assigned");
  const { user } = useAuth();
  const isTech = user?.role === "technician";
  const items = [
    { href: "/dashboard", label: "Dash", icon: "◧" },
    // Technician sees only My Work, not generic Work list (same bug as Sidebar)
    ...(isTech ? [] : [{ href: "/work-orders", label: "Work", icon: "≡" }]),
    ...(user?.role === "owner" ? [{ href: "/users", label: "Users", icon: "◐" }] : []),
    ...(isTech ? [{ href: "/work-orders?assigned=me", label: "My Work", icon: "◎" }] : []),
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex items-center justify-around px-2 py-2 z-40">
      {items.map((n) => {
        const isMyWork = n.href.includes("assigned=me");
        let active = false;
        if (n.href === "/dashboard") active = pathname === "/dashboard";
        else if (isMyWork) active = pathname === "/work-orders" && assigned === "me";
        else active = pathname === n.href || pathname.startsWith(n.href.split("?")[0]);
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
function MobileNav() {
  return (
    <Suspense fallback={null}>
      <MobileNavInner />
    </Suspense>
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
