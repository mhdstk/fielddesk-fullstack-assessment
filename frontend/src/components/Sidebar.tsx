"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

type NavItem = { href: string; label: string; roles?: string[] };

const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/work-orders", label: "Work Orders", roles: ["owner", "dispatcher"] },
    {
        href: "/work-orders?assigned=me",
        label: "My Work",
        roles: ["technician"],
    },
    { href: "/users", label: "Users", roles: ["owner"] },
];

function getVisibleNav(role?: string) {
    if (!role) return nav.filter((n) => !n.roles);
    return nav.filter((n) => !n.roles || n.roles.includes(role));
}

function SidebarInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const visibleNav = getVisibleNav(user?.role);
    const assigned = searchParams.get("assigned");
    return (
        <aside className="w-[240px] shrink-0 hidden md:flex flex-col h-screen sticky top-0 bg-white border-r border-zinc-200">
            <div className="px-6 py-7 border-b border-zinc-100 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-semibold text-xs tracking-wider">
                        FD
                    </div>
                    <div>
                        <div className="font-semibold text-sm leading-none tracking-tight">
                            FieldDesk
                        </div>
                        <div className="text-xs text-zinc-500 font-light">
                            Field Service
                        </div>
                    </div>
                </div>
                {user && (
                    <div className="mt-5 text-xs">
                        <div className="font-medium capitalize text-zinc-900">
                            {user.role}
                        </div>
                        <div className="text-zinc-500 font-light truncate">
                            {user.organisation.name}
                        </div>
                    </div>
                )}
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                <div className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 px-3 mb-4">
                    Menu
                </div>
                {visibleNav.map((n) => {
                    const isMyWork = n.href.includes("assigned=me");
                    const isWorkOrders = n.href === "/work-orders";
                    let active = false;
                    if (n.href === "/dashboard") active = pathname === "/dashboard";
                    else if (isMyWork) active = pathname === "/work-orders" && assigned === "me";
                    else if (isWorkOrders) active = (pathname === "/work-orders" && assigned !== "me") || pathname.startsWith("/work-orders/");
                    else active = pathname === n.href || (pathname.startsWith(n.href.split("?")[0]) && n.href !== "/dashboard");
                    return (
                        <Link
                            key={n.href}
                            href={n.href}
                            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}
                        >
                            {n.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="shrink-0 px-4 py-4 border-t border-zinc-100">
                {user && (
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-700">
                            {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate leading-none">
                                {user.username}
                            </div>
                            <div className="text-xs text-zinc-500 truncate font-light">
                                {user.email}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

import { Suspense } from "react";
export function Sidebar() {
    return (
        <Suspense fallback={<aside className="w-[240px] shrink-0 hidden md:flex" />}>
            <SidebarInner />
        </Suspense>
    );
}
