import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Heart,
  Shield,
  X,
} from "lucide-react";

import ScoreIndicator from "@/components/ScoreIndicator";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  checkVisaCompliance,
  fetchIdea,
  fetchSuccessStories,
  saveIdea,
} from "@/lib/api";
import {
  cn,
  formatDate,
  formatGBP,
  scoreBg,
  scoreColor,
  truncate,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (API may include optional analysis_result on idea payloads)
// ---------------------------------------------------------------------------

interface MarketAnalysisBlock {
  growth_rate?: string;
  competitors?: string[];
  competitive_advantage?: string;
  target_segments?: string[];
  segment_sizes?: Record<string, number>;
}

interface CitationItem {
  title: string;
  url?: string;
  relevance?: string;
  doc_type?: string;
}

interface AnalysisResult {
  market_analysis?: MarketAnalysisBlock;
  citations?: CitationItem[];
}

interface IdeaDetail {
  id: string;
  title: string;
  description: string;
  overall_probability: number;
  innovation_score: number;
  viability_score: number;
  scalability_score: number;
  uk_benefit_score: number;
  tech_stack: string[];
  market_size_gbp: number | null;
  job_creation_potential: Record<string, number> | null;
  sector_id: number;
  sector_name: string;
  created_at: string | null;
  view_count: number;
  is_saved: boolean;
  related_ideas: Array<{
    id: string;
    title: string;
    description: string;
    overall_probability: number;
    sector_name?: string;
  }>;
  analysis_result?: AnalysisResult;
}

type TabId =
  | "overview"
  | "market"
  | "compliance"
  | "similar"
  | "citations";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "market", label: "Market Analysis" },
  { id: "compliance", label: "Compliance Check" },
  { id: "similar", label: "Similar Projects" },
  { id: "citations", label: "Citations" },
];

const SUB_SCORE_COPY: Record<
  "innovation" | "viability" | "scalability" | "uk_benefit",
  string
> = {
  innovation:
    "Novelty, differentiation, and IP potential relative to existing solutions.",
  viability: "Market fit, business model clarity, and traction signals.",
  scalability: "Room to grow users, revenue, and operations domestically and abroad.",
  uk_benefit:
    "Expected jobs, exports, productivity, or other UK economic contribution.",
};

const COMPLIANCE_STEPS = [
  "Analyzing innovation…",
  "Checking viability…",
  "Reviewing scalability…",
  "Assessing UK economic benefit…",
  "Evaluating founder fit…",
];

const RADIAL_COLORS = ["#22c55e", "#eab308", "#3b82f6", "#a855f7"];

function toScorePercent(score0to10: number): number {
  return Math.min(100, Math.max(0, score0to10 * 10));
}

function getMarketBarData(idea: IdeaDetail): { name: string; value: number }[] {
  const seg = idea.analysis_result?.market_analysis?.segment_sizes;
  if (seg && Object.keys(seg).length > 0) {
    return Object.entries(seg).map(([name, value]) => ({
      name: truncate(name, 24),
      value: Number(value) || 0,
    }));
  }
  if (idea.market_size_gbp != null && idea.market_size_gbp > 0) {
    return [{ name: "Est. market (TAM)", value: idea.market_size_gbp }];
  }
  return [];
}

function hasMarketInsights(idea: IdeaDetail): boolean {
  const ma = idea.analysis_result?.market_analysis;
  const bar = getMarketBarData(idea);
  return (
    bar.length > 0 ||
    (ma?.competitors?.length ?? 0) > 0 ||
    !!ma?.competitive_advantage ||
    (ma?.target_segments?.length ?? 0) > 0 ||
    !!ma?.growth_rate
  );
}

function verdictStyles(verdict: string): string {
  const v = verdict.toUpperCase().replace(/\s+/g, " ");
  if (v === "PASS")
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  if (v === "NOT READY")
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200";
}

function priorityBadgeClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "high")
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
  if (p === "low")
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200";
}

export default function IdeaReport() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");
  const [complianceResult, setComplianceResult] = useState<{
    overall_verdict: string;
    probability_score: number;
    criteria: Array<{
      name: string;
      passed: boolean;
      score: number;
      explanation: string;
      how_to_improve: string;
    }>;
    strengths: string[];
    weaknesses: string[];
    recommendations: Array<{ text: string; priority: string }>;
  } | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const ideaQuery = useQuery({
    queryKey: ["idea", id],
    queryFn: () => fetchIdea(id!) as Promise<IdeaDetail>,
    enabled: Boolean(id),
  });

  const idea = ideaQuery.data;

  const storiesQuery = useQuery({
    queryKey: ["success-stories", idea?.sector_id],
    queryFn: () =>
      fetchSuccessStories(idea?.sector_id, 12) as Promise<
        Array<{
          id: string;
          title: string;
          summary: string;
          url: string | null;
          published_at: string | null;
          sector_id: number | null;
          funding?: number;
        }>
      >,
    enabled: Boolean(idea?.sector_id),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveIdea(id!),
    onSuccess: () => {
      toast.success("Idea saved");
      queryClient.invalidateQueries({ queryKey: ["idea", id] });
    },
  });

  const complianceMutation = useMutation({
    mutationFn: () =>
      checkVisaCompliance({
        idea_description: idea!.description,
        sector_id: idea!.sector_id,
      }),
    onSuccess: (data) => {
      setComplianceResult(data);
      toast.success("Compliance check complete");
    },
  });

  useEffect(() => {
    if (!complianceMutation.isPending) {
      setStepIdx(0);
      return;
    }
    const t = window.setInterval(() => {
      setStepIdx((i) => (i + 1) % COMPLIANCE_STEPS.length);
    }, 1600);
    return () => window.clearInterval(t);
  }, [complianceMutation.isPending]);

  const marketBarData = useMemo(
    () => (idea ? getMarketBarData(idea) : []),
    [idea]
  );

  const radialData = useMemo(() => {
    if (!idea) return [];
    const keys = [
      { key: "innovation" as const, score: idea.innovation_score },
      { key: "viability" as const, score: idea.viability_score },
      { key: "scalability" as const, score: idea.scalability_score },
      { key: "uk_benefit" as const, score: idea.uk_benefit_score },
    ];
    return keys.map((k, i) => ({
      name: k.key.replace("_", " "),
      value: toScorePercent(k.score),
      fill: RADIAL_COLORS[i % RADIAL_COLORS.length],
    }));
  }, [idea]);

  const citations = idea?.analysis_result?.citations ?? [];

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  function handleSaveClick() {
    if (!isAuthenticated) {
      toast.error("Sign in to save ideas");
      return;
    }
    if (idea?.is_saved) {
      toast("Already in your saved ideas");
      return;
    }
    saveMutation.mutate();
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600 dark:text-gray-400">Missing idea id.</p>
        <Link to="/" className="mt-4 inline-flex items-center text-primary">
          <ChevronRight className="mr-1 h-4 w-4 rotate-180" />
          Back home
        </Link>
      </div>
    );
  }

  if (ideaQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <LoadingSkeleton variant="text" count={4} />
        <div className="mt-8">
          <LoadingSkeleton variant="chart" count={1} />
        </div>
      </div>
    );
  }

  if (ideaQuery.isError || !idea) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-red-600 dark:text-red-400">
          Could not load this idea.
        </p>
        <Link to="/" className="mt-4 inline-flex items-center text-primary">
          <ChevronRight className="mr-1 h-4 w-4 rotate-180" />
          Back home
        </Link>
      </div>
    );
  }

  const ma = idea.analysis_result?.market_analysis;
  const jobs = idea.job_creation_potential;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              to={`/sectors/${idea.sector_id}`}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
            >
              <ChevronRight className="mr-0.5 h-4 w-4 rotate-180" />
              {idea.sector_name || "Sector"}
            </Link>
            <h1 className="truncate text-lg font-semibold sm:text-xl">
              {idea.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Share
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saveMutation.isPending}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted",
                idea.is_saved && "border-primary/40 bg-primary/5"
              )}
              aria-pressed={idea.is_saved}
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  idea.is_saved && "fill-primary text-primary"
                )}
              />
              {idea.is_saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-transparent scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative min-h-[44px] shrink-0 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                tab === t.id && "text-foreground"
              )}
            >
              {t.label}
              {tab === t.id ? (
                <motion.span
                  layoutId="idea-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="bg-card rounded-lg border p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="break-words text-xl font-bold sm:text-2xl">{idea.title}</h2>
                    {idea.sector_name ? (
                      <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {idea.sector_name}
                      </span>
                    ) : null}
                  </div>
                  {idea.created_at ? (
                    <p className="text-sm text-muted-foreground">
                      Updated {formatDate(idea.created_at)}
                    </p>
                  ) : null}
                </div>

                <div className="mt-8 flex flex-col items-center justify-center gap-6">
                  <ScoreIndicator
                    score={idea.overall_probability}
                    size="lg"
                    label="Overall probability"
                  />
                  <div className="h-52 w-full max-w-md">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="20%"
                        outerRadius="90%"
                        data={radialData}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <RadialBar
                          background
                          dataKey="value"
                          cornerRadius={4}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${Math.round(value)}`, "Score"]}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "innovation" as const,
                      label: "Innovation",
                      score: idea.innovation_score,
                    },
                    {
                      id: "viability" as const,
                      label: "Viability",
                      score: idea.viability_score,
                    },
                    {
                      id: "scalability" as const,
                      label: "Scalability",
                      score: idea.scalability_score,
                    },
                    {
                      id: "uk_benefit" as const,
                      label: "UK Benefit",
                      score: idea.uk_benefit_score,
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.id}
                    className="bg-card flex flex-col gap-3 rounded-lg border p-6"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.label}</span>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          scoreColor(toScorePercent(row.score))
                        )}
                      >
                        {row.score.toFixed(1)}/10
                      </span>
                    </div>
                    <div className="flex justify-center">
                      <ScoreIndicator score={row.score * 10} size="sm" />
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                      {SUB_SCORE_COPY[row.id]}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-card rounded-lg border p-6">
                <h3 className="mb-3 font-semibold">Tech stack</h3>
                <div className="flex flex-wrap gap-2">
                  {(idea.tech_stack ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                    >
                      {t}
                    </span>
                  ))}
                  {(!idea.tech_stack || idea.tech_stack.length === 0) && (
                    <span className="text-sm text-muted-foreground">
                      No technologies listed
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="bg-card rounded-lg border p-6">
                  <h3 className="mb-2 font-semibold">Market size</h3>
                  <p className="text-2xl font-bold text-primary">
                    {idea.market_size_gbp != null && idea.market_size_gbp > 0
                      ? formatGBP(idea.market_size_gbp)
                      : "—"}
                  </p>
                </div>
                <div className="bg-card rounded-lg border p-6">
                  <h3 className="mb-3 font-semibold">Job creation potential</h3>
                  {jobs &&
                  (jobs.year_1 != null ||
                    jobs.year_2 != null ||
                    jobs.year_3 != null) ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">Year 1</th>
                          <th className="py-2 pr-2 font-medium">Year 2</th>
                          <th className="py-2 font-medium">Year 3</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="tabular-nums">
                          <td className="py-2 pr-2">
                            {jobs.year_1 ?? "—"}
                          </td>
                          <td className="py-2 pr-2">
                            {jobs.year_2 ?? "—"}
                          </td>
                          <td className="py-2">{jobs.year_3 ?? "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No projection available
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-lg border p-6">
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4" />
                  Full description
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {idea.description}
                </p>
              </div>
            </div>
          )}

          {tab === "market" && (
            <div className="space-y-6">
              {hasMarketInsights(idea) ? (
                <>
                  {marketBarData.length > 0 ? (
                    <div className="bg-card rounded-lg border p-6">
                      <h3 className="mb-4 flex items-center gap-2 font-semibold">
                        <BarChart3 className="h-4 w-4" />
                        Market size
                      </h3>
                      <div className="h-72 w-full overflow-x-auto">
                        <div className="min-w-[320px] h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={marketBarData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis
                              tickFormatter={(v) =>
                                typeof v === "number" ? formatGBP(v) : String(v)
                              }
                            />
                            <Tooltip
                              formatter={(value: number) =>
                                formatGBP(Number(value))
                              }
                            />
                            <Bar
                              dataKey="value"
                              fill="hsl(var(--primary))"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </div>
                      {ma?.growth_rate ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Indicative growth:{" "}
                          <span className="font-medium text-foreground">
                            {ma.growth_rate}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {ma?.competitive_advantage ? (
                    <div className="bg-card rounded-lg border p-6">
                      <h3 className="mb-2 font-semibold">
                        Competitive advantage
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {ma.competitive_advantage}
                      </p>
                    </div>
                  ) : null}

                  {(ma?.competitors?.length ?? 0) > 0 ? (
                    <div className="bg-card rounded-lg border p-6">
                      <h3 className="mb-3 font-semibold">Competitors</h3>
                      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        {ma!.competitors!.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {(ma?.target_segments?.length ?? 0) > 0 ? (
                    <div className="bg-card rounded-lg border p-6">
                      <h3 className="mb-3 font-semibold">Target segments</h3>
                      <div className="flex flex-wrap gap-2">
                        {ma!.target_segments!.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="bg-card rounded-lg border p-10 text-center">
                  <BarChart3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Run an analysis to see market insights
                  </p>
                  <Link
                    to="/generate"
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Go to idea generator
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {tab === "compliance" && (
            <div className="space-y-6">
              <div className="bg-card rounded-lg border p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      UK Innovator Founder Visa
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={
                      complianceMutation.isPending || !isAuthenticated
                    }
                    onClick={() => complianceMutation.mutate()}
                    className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Run Visa Compliance Check
                  </button>
                </div>
                {!isAuthenticated ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <Link to="/login" className="text-primary underline">
                      Sign in
                    </Link>{" "}
                    to run a compliance check.
                  </p>
                ) : null}
              </div>

              {complianceMutation.isPending && (
                <div className="bg-card rounded-lg border p-6">
                  <ul className="space-y-3">
                    {COMPLIANCE_STEPS.map((label, i) => (
                      <li
                        key={label}
                        className={cn(
                          "flex items-center gap-3 text-sm transition-opacity",
                          i === stepIdx
                            ? "font-medium text-foreground"
                            : "text-muted-foreground opacity-60"
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {complianceResult && !complianceMutation.isPending && (
                <>
                  <div className="bg-card rounded-lg border p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                          verdictStyles(complianceResult.overall_verdict)
                        )}
                      >
                        {complianceResult.overall_verdict}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Model probability:{" "}
                        <span
                          className={cn(
                            "ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                            scoreBg(
                              Math.round(complianceResult.probability_score)
                            )
                          )}
                        >
                          {Math.round(complianceResult.probability_score)}%
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="bg-card rounded-lg border p-6">
                    <h4 className="mb-4 font-semibold">Criteria</h4>
                    <ul className="space-y-4">
                      {complianceResult.criteria.length === 0 ? (
                        <li className="text-sm text-muted-foreground">
                          No criteria returned. Try again.
                        </li>
                      ) : (
                        complianceResult.criteria.map((c) => (
                          <li
                            key={c.name}
                            className="flex gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                c.passed
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                              )}
                              aria-label={c.passed ? "Passed" : "Not passed"}
                            >
                              {c.passed ? "✓" : "✗"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium">{c.name}</span>
                                <span className="text-sm tabular-nums text-muted-foreground">
                                  Score: {c.score.toFixed(1)}/10
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {c.explanation}
                              </p>
                              {c.how_to_improve ? (
                                <p className="mt-2 text-xs text-foreground/80">
                                  <span className="font-semibold">
                                    Improve:{" "}
                                  </span>
                                  {c.how_to_improve}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="bg-card rounded-lg border p-6">
                      <h4 className="mb-3 font-semibold text-green-700 dark:text-green-400">
                        Strengths
                      </h4>
                      <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                        {complianceResult.strengths.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-card rounded-lg border p-6">
                      <h4 className="mb-3 font-semibold text-red-700 dark:text-red-400">
                        Weaknesses
                      </h4>
                      <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                        {complianceResult.weaknesses.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-card rounded-lg border p-6">
                    <h4 className="mb-4 font-semibold">Recommendations</h4>
                    <ul className="space-y-3">
                      {complianceResult.recommendations.map((r, i) => (
                        <li
                          key={`${r.text}-${i}`}
                          className="flex flex-wrap items-start gap-2 text-sm"
                        >
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                              priorityBadgeClass(r.priority || "Medium")
                            )}
                          >
                            {r.priority || "Medium"}
                          </span>
                          <span className="text-muted-foreground">
                            {r.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "similar" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <BookOpen className="h-5 w-5" />
                Funded UK projects
              </div>
              {storiesQuery.isLoading ? (
                <LoadingSkeleton variant="text" count={5} />
              ) : storiesQuery.isError ? (
                <p className="text-sm text-red-600">Could not load stories.</p>
              ) : (
                <ul className="space-y-4">
                  {(storiesQuery.data ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="bg-card rounded-lg border p-6 transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold">{s.title}</h3>
                        {s.funding != null && s.funding > 0 ? (
                          <span className="text-sm font-medium text-primary">
                            {formatGBP(s.funding)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {truncate(s.summary, 220)}
                      </p>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Open source
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "citations" && (
            <div className="space-y-4">
              {citations.length > 0 ? (
                <ul className="space-y-4">
                  {citations.map((c, i) => (
                    <li key={`${c.title}-${i}`} className="bg-card rounded-lg border p-6">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-medium">{c.title}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                          <Download className="h-3 w-3" />
                          {c.doc_type || "Reference"}
                        </span>
                      </div>
                      {c.relevance ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {c.relevance}
                        </p>
                      ) : null}
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex min-w-0 items-center gap-1 break-all text-sm text-primary hover:underline"
                        >
                          {c.url}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bg-card rounded-lg border p-8 text-center text-sm text-muted-foreground">
                  No citations yet. Run a full analysis to attach sources.
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
