"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  CreditCard,
  Brain,
  Briefcase,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

interface AdminSidebarProps {
  user: {
    email: string;
    nome?: string;
    role?: string;
  } | null;
}

const menuItems = [
  {
    label: "Clientes",
    href: "/central-saas/clientes",
    icon: Users,
  },
  {
    label: "Planos",
    href: "/central-saas/planos",
    icon: CreditCard,
  },
  {
    label: "Pacotes IA",
    href: "/central-saas/pacotes-ia",
    icon: Brain,
  },
  {
    label: "Equipa",
    href: "/central-saas/equipa",
    icon: Briefcase,
  },
];

export function AdminSidebar({ user }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-brand-border flex flex-col transition-all duration-300 z-50 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-brand-primary font-bold text-lg text-brand-midnight">
                Flowly
              </h1>
              <p className="text-xs text-brand-slate">Admin Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-brand-primary/10 text-brand-primary border-l-4 border-brand-primary"
                      : "text-brand-slate hover:bg-brand-light hover:text-brand-midnight"
                  } ${isCollapsed ? "justify-center" : ""}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-brand-secondary font-medium text-sm">
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-brand-border">
        {!isCollapsed && user && (
          <div className="mb-4 px-4 py-3 bg-brand-light rounded-lg">
            <p className="font-brand-primary font-semibold text-sm text-brand-midnight truncate">
              {user.nome || user.email}
            </p>
            <p className="text-xs text-brand-slate capitalize">{user.role}</p>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
