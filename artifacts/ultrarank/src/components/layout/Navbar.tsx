import { Link, useLocation } from "wouter";
import { Activity, Trophy, Users, Calendar, BarChart3, Settings, UserCircle } from "lucide-react";
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
    <nav className="w-full border-b border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
              <Activity className="h-6 w-6" />
              <span>ULTRARANK</span>
            </Link>
            
            <div className="hidden md:ml-10 md:flex md:items-center md:space-x-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    location === item.href || (location.startsWith(item.href) && item.href !== "/")
                      ? "bg-primary text-black shadow-lg shadow-primary/20"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center">
            <Link
              href={organizer ? "/portal/dashboard" : "/portal/login"}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors border border-border/50 rounded-full px-3 py-1.5 hover:border-primary/30"
            >
              <UserCircle className="h-4 w-4" />
              {organizer ? "Dashboard" : "Organiser Login"}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
