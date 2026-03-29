import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Shield,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { checkVisaCompliance, fetchSectors } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import ScoreIndicator from "@/components/ScoreIndicator";
import LoadingSkeleton from "@/components/LoadingSkeleton";

const MIN_DESC = 200;
const MAX_DESC = 2000;

const CHECKLIST_STEPS = [
  "Analyzing innovation potential...",
  "Evaluating market viability...",
  "Assessing scalability...",
  "Checking UK economic benefit...",
  "Comparing with funded projects...",
] as const;

interface CriterionRow {
  name: string;
  passed: boolean;
  score: number;
  explanation: string;
  how_to_improve: string;
}

interface CompliancePayload {
  overall_verdict: string;
  probability_score: number;
  criteria: CriterionRow[];
  strengths: string[];
  weaknesses: string[];
  recommendations: Array<{ text: string; priority?: string }>;
  similar_projects?: Array<Record<string, unknown>>;
}

function priorityBadgeClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "high")
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (p === "low")
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200";
}

function verdictVisual(verdict: string): {
  className: string;
  icon: ReactNode;
} {
  const v = verdict.toUpperCase();
  if (v === "PASS") {
    return {
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
      icon: <CheckCircle2 className="h-8 w-8 shrink-0" aria-hidden />,
    };
  }
  if (v === "NOT READY") {
    return {
      className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      icon: <Shield className="h-8 w-8 shrink-0" aria-hidden />,
    };
  }
  return {
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    icon: <AlertTriangle className="h-8 w-8 shrink-0" aria-hidden />,
  };
}

function projectTitle(p: Record<string, unknown>): string {
  const t = p.title;
  return typeof t === "string" ? t : "Untitled project";
}

function projectSummary(p: Record<string, unknown>): string {
  const s = p.summary;
  return typeof s === "string" ? s : "";
}

export default function VisaCompliance() {
  const { user } = useAuth();
  const [ideaDescription, setIdeaDescription] = useState("");
  const [sectorId, setSectorId] = useState<number>(0);
  const [result, setResult] = useState<CompliancePayload | null>(null);
  const [checklistPhase, setChecklistPhase] = useState(0);
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(
    null
  );

  const { data: sectors, isLoading: sectorsLoading } = useQuery({
    queryKey: ["sectors"],
    queryFn: fetchSectors,
  });

  const complianceMutation = useMutation({
    mutationFn: () =>
      checkVisaCompliance({
        idea_description: ideaDescription.trim(),
        sector_id: sectorId,
      }) as Promise<CompliancePayload>,
    onSuccess: (data) => {
      setResult(data);
      toast.success("Compliance check complete");
    },
  });

  useEffect(() => {
    if (!complianceMutation.isPending) {
      setChecklistPhase(0);
      return;
    }
    setChecklistPhase(0);
    const id = window.setInterval(() => {
      setChecklistPhase((p) => (p >= 5 ? 5 : p + 1));
    }, 2500);
    return () => window.clearInterval(id);
  }, [complianceMutation.isPending]);

  const len = ideaDescription.length;
  const validLength = len >= MIN_DESC && len <= MAX_DESC;
  const canSubmit =
    validLength && sectorId > 0 && !complianceMutation.isPending;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setResult(null);
    complianceMutation.mutate();
  }, [canSubmit, complianceMutation]);

  const handleRevise = useCallback(() => {
    setResult(null);
    complianceMutation.reset();
  }, [complianceMutation]);

  const verdict = result ? verdictVisual(result.overall_verdict) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Visa compliance check
        </h1>
        {user?.full_name ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Signed in as {user.full_name}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Describe your innovation idea in detail. Our AI analyses it against UK Innovator Founder Visa
          endorsement criteria using real data from funded projects and Innovate UK programmes.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This is an AI-powered assessment tool for research purposes. It does not constitute legal,
              immigration, or professional advice. Always consult a qualified immigration advisor or endorsing
              body before making visa application decisions.
            </span>
          </p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-6">
          <div>
            <label
              htmlFor="idea-description"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Idea description
            </label>
            <textarea
              id="idea-description"
              value={ideaDescription}
              onChange={(e) => setIdeaDescription(e.target.value)}
              rows={10}
              placeholder={`Enter at least ${MIN_DESC} characters describing your idea, market, and differentiation…`}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {len < MIN_DESC
                  ? `${MIN_DESC - len} more characters needed`
                  : len > MAX_DESC
                    ? `${len - MAX_DESC} characters over limit`
                    : "Within range"}
              </span>
              <span className="tabular-nums">
                {len} / {MAX_DESC}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="sector"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Sector
            </label>
            {sectorsLoading ? (
              <LoadingSkeleton variant="text" count={2} />
            ) : (
              <select
                id="sector"
                value={sectorId || ""}
                onChange={(e) =>
                  setSectorId(Number(e.target.value) || 0)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">Select a sector</option>
                {(sectors ?? []).map((s: { id: number; name: string }) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {complianceMutation.isPending ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <p className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                Running compliance analysis
              </p>
              <ul className="space-y-4">
                {CHECKLIST_STEPS.map((label, i) => {
                  const done = checklistPhase > i;
                  const active = checklistPhase === i && checklistPhase < 5;
                  const pending = checklistPhase < i;
                  return (
                    <li key={label} className="flex items-center gap-3 text-sm">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                        {done ? (
                          <CheckCircle2
                            className="h-6 w-6 text-green-600 dark:text-green-400"
                            aria-hidden
                          />
                        ) : active ? (
                          <Loader2
                            className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400"
                            aria-hidden
                          />
                        ) : (
                          <Circle
                            className="h-6 w-6 text-gray-300 dark:text-gray-600"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span
                        className={cn(
                          pending && "text-gray-400 dark:text-gray-500",
                          active &&
                            "font-medium text-gray-900 dark:text-gray-100",
                          done && "text-gray-700 dark:text-gray-300"
                        )}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={cn(
                "w-full rounded-xl py-3 text-sm font-semibold text-white shadow-sm",
                canSubmit
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-300 dark:bg-gray-600"
              )}
            >
              Check compliance
            </button>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {verdict ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  "inline-flex items-center gap-3 rounded-2xl px-6 py-4 text-lg font-bold uppercase tracking-wide",
                  verdict.className
                )}
              >
                {verdict.icon}
                {result.overall_verdict}
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Probability score
                </span>
                <ScoreIndicator
                  score={Math.round(result.probability_score)}
                  size="lg"
                  label="Model estimate (0–100)"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Criteria breakdown
            </h2>
            <div className="flex flex-col gap-4">
              {result.criteria.map((c) => {
                const open = expandedCriterion === c.name;
                const pct = Math.min(100, Math.max(0, (c.score / 10) * 100));
                return (
                  <div
                    key={c.name}
                    className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {c.name}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          c.passed
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        )}
                      >
                        {c.passed ? "Pass" : "Needs work"}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Score</span>
                        <span className="tabular-nums">
                          {c.score.toFixed(1)} / 10
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      {c.explanation}
                    </p>
                    {c.how_to_improve ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCriterion(open ? null : c.name)
                          }
                          className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          How to Improve
                          {open ? " ▲" : " ▼"}
                        </button>
                        <AnimatePresence initial={false}>
                          {open ? (
                            <motion.div
                              key="how"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <p className="pt-2 text-sm text-gray-700 dark:text-gray-300">
                                {c.how_to_improve}
                              </p>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold text-green-700 dark:text-green-400">
                Strengths
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {result.strengths.map((s) => (
                  <li key={s} className="flex gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                      aria-hidden
                    />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold text-red-700 dark:text-red-400">
                Weaknesses
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {result.weaknesses.map((w) => (
                  <li key={w} className="flex gap-2">
                    <X
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                      aria-hidden
                    />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
              Recommendations
            </h3>
            <ol className="space-y-3">
              {result.recommendations.map((r, i) => (
                <li
                  key={`${r.text}-${i}`}
                  className="flex flex-wrap items-start gap-2 text-sm"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      priorityBadgeClass(r.priority || "Medium")
                    )}
                  >
                    {r.priority || "Medium"}
                  </span>
                  <span className="min-w-0 flex-1 text-gray-700 dark:text-gray-300">
                    {r.text}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {result.similar_projects && result.similar_projects.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                Similar projects
              </h3>
              <ul className="space-y-4">
                {result.similar_projects.map((p, i) => (
                  <li
                    key={i}
                    className="border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-gray-800"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {projectTitle(p)}
                    </p>
                    {projectSummary(p) ? (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {projectSummary(p)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleRevise}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Revise and Recheck
            </button>
            <button
              type="button"
              onClick={() => {
                const text = [
                  `Verdict: ${result.overall_verdict}`,
                  `Score: ${result.probability_score}`,
                  "",
                  "Criteria:",
                  ...result.criteria.map((c) => `  ${c.name}: ${c.score}/10 (${c.passed ? "Pass" : "Needs work"})`),
                  "",
                  "Strengths:",
                  ...result.strengths.map((s) => `  - ${s}`),
                  "",
                  "Weaknesses:",
                  ...result.weaknesses.map((w) => `  - ${w}`),
                  "",
                  "Recommendations:",
                  ...result.recommendations.map((r, i) => `  ${i + 1}. [${r.priority || "Medium"}] ${r.text}`),
                ].join("\n");
                navigator.clipboard.writeText(text).then(
                  () => toast.success("Analysis copied to clipboard"),
                  () => toast.error("Failed to copy"),
                );
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Copy Analysis
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
