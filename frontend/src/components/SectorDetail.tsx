import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight } from "lucide-react";

import LoadingSkeleton from "@/components/LoadingSkeleton";
import ScoreIndicator from "@/components/ScoreIndicator";
import { fetchSector, fetchSectorIdeas, fetchSectorTrends } from "@/lib/api";
import {
  cn,
  formatGBP,
  scoreBg,
  scoreColor,
  trendArrow,
  trendColor,
  truncate,
} from "@/lib/utils";

interface SectorDetailData {
  id: number;
  name: string;
  description: string | null;
  icon_name: string | null;
  priority_score: number;
  funding_available_gbp: number;
  trend_direction: string;
  last_updated: string | null;
}

interface SectorTrendPoint {
  month: string;
  funding: number;
  idea_count: number;
  avg_score: number;
}

interface IdeaCard {
  id: string;
  title: string;
  description: string;
  overall_probability: number;
  innovation_score: number;
  viability_score: number;
  scalability_score: number;
  uk_benefit_score: number;
  tech_stack: string[];
  sector_id: number;
  sector_name: string;
  view_count: number;
}

interface PaginatedSectorIdeas {
  items: IdeaCard[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

type SortKey = "probability" | "innovation" | "recent";

function priorityBadge(score: number): { label: string; className: string } {
  if (score >= 8) return { label: "High Priority", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
  if (score >= 6) return { label: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
  return { label: "Standard", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
}

function dotBg(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export default function SectorDetail() {
  const { id } = useParams();
  const sectorId = id ? parseInt(id, 10) : NaN;
  const valid = Number.isFinite(sectorId);

  const [sortBy, setSortBy] = useState<SortKey>("probability");

  const sectorQuery = useQuery({
    queryKey: ["sector", sectorId],
    queryFn: () => fetchSector(sectorId) as Promise<SectorDetailData>,
    enabled: valid,
  });

  const ideasQuery = useQuery({
    queryKey: ["sectorIdeas", sectorId, sortBy],
    queryFn: () => fetchSectorIdeas(sectorId, sortBy, 1, 24) as Promise<PaginatedSectorIdeas>,
    enabled: valid,
  });

  const trendsQuery = useQuery({
    queryKey: ["sectorTrends", sectorId],
    queryFn: () => fetchSectorTrends(sectorId) as Promise<SectorTrendPoint[]>,
    enabled: valid,
  });

  if (!valid) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Invalid sector link.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (sectorQuery.isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <LoadingSkeleton variant="text" count={4} />
        <LoadingSkeleton variant="chart" count={1} />
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (sectorQuery.isError || !sectorQuery.data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Sector not found.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const sector = sectorQuery.data;
  const pri = priorityBadge(sector.priority_score);
  const chartData = trendsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-8 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        <Link to="/" className="hover:text-foreground">
          Sectors
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium text-foreground">{sector.name}</span>
      </nav>

      <header className="border-b border-border pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{sector.name}</h1>
        {sector.description ? (
          <p className="mt-3 max-w-3xl text-muted-foreground">{sector.description}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            Funding available: {formatGBP(sector.funding_available_gbp)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-medium",
              trendColor(sector.trend_direction)
            )}
          >
            <span aria-hidden>{trendArrow(sector.trend_direction)}</span>
            Trend: <span className="capitalize">{sector.trend_direction}</span>
          </span>
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", pri.className)}>{pri.label}</span>
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <span className="text-xs text-muted-foreground">Priority score</span>
            <ScoreIndicator score={sector.priority_score * 10} size="sm" animate={false} />
          </div>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-foreground">12-Month Trends</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monthly funding (£M), average idea probability, and new ideas added.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border bg-card p-4">
          <div className="min-w-[480px]">
          {trendsQuery.isPending ? (
            <LoadingSkeleton variant="chart" count={1} />
          ) : trendsQuery.isError ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Failed to load trend data. Please try again later.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis
                  yAxisId="ideas"
                  orientation="left"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  label={{ value: "Idea count", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="funding"
                  orientation="right"
                  width={56}
                  tick={{ fontSize: 11, fill: "#2563eb" }}
                  tickFormatter={(v) => `£${v}M`}
                  label={{ value: "Funding (£M)", angle: 90, position: "insideRight", style: { fontSize: 11, fill: "#2563eb" } }}
                />
                <YAxis
                  yAxisId="score"
                  orientation="right"
                  width={48}
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#16a34a" }}
                  hide
                />
                <Tooltip
                  content={({ active, label, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as SectorTrendPoint;
                    return (
                      <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
                        <p className="font-semibold text-foreground">{label}</p>
                        <p className="text-muted-foreground">
                          Funding:{" "}
                          <span className="font-medium text-foreground">
                            £{row.funding}M
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Avg score:{" "}
                          <span className="font-medium text-foreground">{row.avg_score}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Ideas: <span className="font-medium text-foreground">{row.idea_count}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="ideas"
                  dataKey="idea_count"
                  name="Idea count"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="funding"
                  type="monotone"
                  dataKey="funding"
                  name="Funding (£M)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="score"
                  type="monotone"
                  dataKey="avg_score"
                  name="Avg score"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Top Ideas in {sector.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sorted by your selection below.</p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Sort by</span>
            <select
              className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-foreground sm:w-auto"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
            >
              <option value="probability">probability</option>
              <option value="innovation">innovation</option>
              <option value="recent">recent</option>
            </select>
          </label>
        </div>

        {ideasQuery.isPending ? (
          <div className="mt-6">
            <LoadingSkeleton variant="card" count={4} />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {(ideasQuery.data?.items ?? []).map((idea) => (
              <motion.div
                key={idea.id}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <div className="bg-card h-full rounded-lg border p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-semibold text-foreground">{truncate(idea.title, 60)}</h3>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        scoreBg(idea.overall_probability)
                      )}
                    >
                      {Math.round(idea.overall_probability)}%
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotBg(idea.innovation_score))} aria-hidden />
                      <span className="text-muted-foreground">Innovation</span>
                      <span className={cn("font-semibold tabular-nums", scoreColor(idea.innovation_score))}>
                        {Math.round(idea.innovation_score)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotBg(idea.viability_score))} aria-hidden />
                      <span className="text-muted-foreground">Viability</span>
                      <span className={cn("font-semibold tabular-nums", scoreColor(idea.viability_score))}>
                        {Math.round(idea.viability_score)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotBg(idea.scalability_score))} aria-hidden />
                      <span className="text-muted-foreground">Scalability</span>
                      <span className={cn("font-semibold tabular-nums", scoreColor(idea.scalability_score))}>
                        {Math.round(idea.scalability_score)}
                      </span>
                    </span>
                  </div>

                  {idea.tech_stack?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {idea.tech_stack.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <Link
                    to={`/ideas/${idea.id}`}
                    className="mt-5 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    View Analysis
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
