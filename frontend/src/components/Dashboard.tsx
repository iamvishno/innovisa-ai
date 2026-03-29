import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Cpu,
  Heart,
  Leaf,
  Shield,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wifi,
} from "lucide-react";

import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { fetchSectors } from "@/lib/api";
import { cn, formatGBP, trendArrow, trendColor } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Health: Heart,
  IT: Cpu,
  Ecommerce: ShoppingCart,
  Agriculture: Leaf,
  IoT: Wifi,
  Business: Briefcase,
};

interface SectorSummary {
  id: number;
  name: string;
  icon_name: string | null;
  priority_score: number;
  trend_direction: string;
  funding_available_gbp: number;
  top_ideas_count: number;
}

function sectorIcon(iconName: string | null): LucideIcon {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  return BarChart3;
}

function priorityBadge(score: number): { label: string; className: string } {
  if (score >= 8) return { label: "High Priority", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
  if (score >= 6) return { label: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
  return { label: "Standard", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
}

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: sectors, isPending } = useQuery({
    queryKey: ["sectors"],
    queryFn: fetchSectors as () => Promise<SectorSummary[]>,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-2 flex items-center gap-2 text-blue-100">
            <TrendingUp className="h-5 w-5" aria-hidden />
            {isAuthenticated && user ? (
              <span className="text-sm">Welcome back, {user.full_name.split(" ")[0]}</span>
            ) : null}
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Find Your UK Innovation Visa Project
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-blue-100">
            AI-powered discovery of fundable innovation ideas backed by real UK funding data
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/generate"
              className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-blue-50"
            >
              Generate Custom Idea
            </Link>
            <Link
              to="/visa-check"
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/80 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Check Visa Compliance
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Explore Innovation Sectors</h2>
          <p className="mt-2 text-muted-foreground">
            Browse sectors by funding momentum, priority, and idea volume to find where your innovation fits best.
          </p>
        </div>

        {isPending ? (
          <LoadingSkeleton variant="card" count={6} />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(sectors ?? []).map((sector) => {
              const Icon = sectorIcon(sector.icon_name);
              const pri = priorityBadge(sector.priority_score);
              return (
                <motion.div
                  key={sector.id}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <div
                    className={cn(
                      "bg-card flex h-full flex-col rounded-lg border p-6 shadow-sm transition-shadow hover:shadow-md"
                    )}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Icon className="h-8 w-8" aria-hidden />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{sector.name}</h3>
                          <span
                            className={cn(
                              "mt-1 inline-flex items-center gap-1 text-sm font-medium",
                              trendColor(sector.trend_direction)
                            )}
                          >
                            <span aria-hidden>{trendArrow(sector.trend_direction)}</span>
                            <span className="capitalize">{sector.trend_direction}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", pri.className)}>
                        {pri.label}
                      </span>
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {sector.top_ideas_count} Ideas
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Funding available:{" "}
                      <span className="font-semibold text-foreground">{formatGBP(sector.funding_available_gbp)}</span>
                    </p>

                    <div className="mt-auto pt-6">
                      <Link
                        to={`/sectors/${sector.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                      >
                        Explore Sector
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <section className="mt-16">
          <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Jump straight into the tools founders use most.</p>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { to: "/generate", icon: Sparkles, title: "Generate Custom Idea" },
              { to: "/visa-check", icon: Shield, title: "Check Visa Compliance" },
              { to: "/funding", icon: BarChart3, title: "Active Funding" },
            ].map(({ to, icon: ActionIcon, title }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "bg-card group flex flex-col rounded-lg border p-6 shadow-sm transition-shadow hover:shadow-md"
                )}
              >
                <ActionIcon className="mb-3 h-8 w-8 text-primary" aria-hidden />
                <span className="font-semibold text-foreground">{title}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
