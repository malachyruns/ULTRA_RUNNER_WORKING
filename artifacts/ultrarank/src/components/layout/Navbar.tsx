import { Link, useLocation } from "wouter";
import { Activity, Trophy, Users, Calendar, BarChart3, Settings } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();

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
            
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                    location === item.href || (location.startsWith(item.href) && item.href !== "/")
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
