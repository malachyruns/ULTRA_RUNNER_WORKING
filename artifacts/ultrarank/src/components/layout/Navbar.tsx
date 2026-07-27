import { Link, useLocation } from "wouter";
import { Activity, Trophy, Users, Calendar, BarChart3, UserCircle, type LucideIcon } from "lucide-react";
import { usePortalMe, getPortalMeQueryKey } from "@workspace/api-client-react";

export function Navbar() {
  const [location] = useLocation();
  const { data: organizer } = usePortalMe({ query: { retry: false, queryKey: getPortalMeQueryKey() } });

  const navItems = [
    { href: "/", label: "Dashboard", icon: BarChart3 },
    { href: "/rankings", label: "Rankings", icon: Trophy },
    { href: "/runners", label: "Runners", icon: Users },
    { href: "/races", label: "Races", icon: Calendar },
  ];

  return (
    <nav className="w-full border-b border-neutral-800 bg-[#09090b]/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
              <Activity className="h-6 w-6 text-[#FF5500]" />
              <span>ULTRARANK</span>
            </Link>
            
            <div className="hidden md:ml-10 md:flex md:items-center md:space-x-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navPillClass(location, item.href)}
                >
                  <NavIcon icon={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center">
            <Link
              href={organizer ? "/portal/dashboard" : "/portal/login"}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-all duration-200 hover:border-orange-500 hover:text-white hover:shadow-[0_0_0_1px_rgba(249,115,22,0.14),0_0_18px_rgba(249,115,22,0.12)] active:scale-95"
            >
              <NavIcon icon={UserCircle} />
              {organizer ? "Dashboard" : "Organiser Login"}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function navPillClass(location: string, href: string) {
  const isActive = location === href || (location.startsWith(href) && href !== "/");

  return [
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95",
    isActive
      ? "border-orange-500 bg-orange-500/10 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.16),0_0_20px_rgba(249,115,22,0.14)]"
      : "border-neutral-800 bg-neutral-900 text-zinc-400 hover:border-orange-500/60 hover:bg-orange-500/10 hover:text-white hover:shadow-[0_0_0_1px_rgba(249,115,22,0.08),0_0_16px_rgba(249,115,22,0.08)]",
  ].join(" ");
}

function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
}
