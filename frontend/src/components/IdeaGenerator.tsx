import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Check,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { cn, truncate } from "@/lib/utils";
import { generateIdeas, fetchSectors, saveIdea } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import ScoreIndicator from "@/components/ScoreIndicator";
import LoadingSkeleton from "@/components/LoadingSkeleton";

type Step = 1 | 2 | 3 | "results";

const SUGGESTED_SKILLS = [
  "Python",
  "JavaScript",
  "Machine Learning",
  "Product Management",
  "Data Science",
  "Design",
  "Marketing",
  "Finance",
] as const;

const PROGRESS_MESSAGES = [
  "Analyzing UK innovation trends...",
  "Searching funded projects database...",
  "Generating tailored ideas with Claude AI...",
  "Scoring and ranking results...",
] as const;

interface IdeaCard {
  id: string;
  title: string;
  description: string;
  overall_probability: number;
  sector_id: number;
  sector_name: string;
}

export default function IdeaGenerator() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<
    "Beginner" | "Intermediate" | "Expert"
  >("Intermediate");
  const [previousProjects, setPreviousProjects] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState<number[]>([]);
  const [constraints, setConstraints] = useState("");
  const [generatedIdeas, setGeneratedIdeas] = useState<IdeaCard[]>([]);
  const [progressIdx, setProgressIdx] = useState(0);

  const { data: sectors, isLoading: sectorsLoading } = useQuery({
    queryKey: ["sectors"],
    queryFn: fetchSectors,
  });

  const sectorById = useMemo(() => {
    const m = new Map<number, { id: number; name: string }>();
    (sectors ?? []).forEach((s: { id: number; name: string }) =>
      m.set(s.id, s)
    );
    return m;
  }, [sectors]);

  const toggleSector = useCallback((id: number) => {
    setSelectedSectorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const addSkill = useCallback((raw: string) => {
    const s = raw.trim();
    if (!s) return;
    setSkills((prev) => (prev.includes(s) ? prev : [...prev, s]));
    setSkillInput("");
  }, []);

  const generateMutation = useMutation({
    mutationFn: () => {
      const names = selectedSectorIds
        .map((id) => sectorById.get(id)?.name)
        .filter(Boolean) as string[];
      const constraintParts = [
        `Experience level: ${experienceLevel}`,
        previousProjects.trim()
          ? `Previous projects:\n${previousProjects.trim()}`
          : "",
        constraints.trim(),
      ].filter(Boolean);
      return generateIdeas({
        skills,
        interests: names,
        sector_id: selectedSectorIds[0],
        constraints: constraintParts.join("\n\n"),
      });
    },
    onSuccess: (data: IdeaCard[]) => {
      setGeneratedIdeas(Array.isArray(data) ? data : []);
      setCurrentStep("results");
    },
  });

  useEffect(() => {
    if (!generateMutation.isPending) {
      setProgressIdx(0);
      return;
    }
    setProgressIdx(0);
    const id = window.setInterval(() => {
      setProgressIdx((i) => (i + 1) % PROGRESS_MESSAGES.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [generateMutation.isPending]);

  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setSkillInput("");
    setSkills([]);
    setExperienceLevel("Intermediate");
    setPreviousProjects("");
    setSelectedSectorIds([]);
    setConstraints("");
    setGeneratedIdeas([]);
    generateMutation.reset();
  }, [generateMutation]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-10 flex items-center justify-center gap-0">
        {[1, 2, 3].map((n, idx) => {
          const completed =
            currentStep === "results" ||
            (typeof currentStep === "number" && currentStep > n);
          const active = currentStep === n;
          return (
            <div key={n} className="flex items-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  completed || active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900"
                )}
              >
                {completed && !active ? (
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                ) : (
                  n
                )}
              </div>
              {idx < 2 ? (
                <div
                  className={cn(
                    "mx-1 h-0.5 w-10 sm:w-16",
                    typeof currentStep === "number" && currentStep > n
                      ? "bg-blue-600"
                      : currentStep === "results"
                        ? "bg-blue-600"
                        : "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {currentStep === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Your Background
              </h1>
              {user?.full_name ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Signed in as {user.full_name}
                </p>
              ) : null}
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/40">
                <p className="flex flex-col gap-1 text-xs text-blue-800 dark:text-blue-200 sm:flex-row sm:items-center sm:gap-4">
                  <span className="inline-flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                    Ideas scored against real UK funded projects &amp; Innovate UK data
                  </span>
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  AI-generated suggestions for exploration only — consult an immigration advisor before applying
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Skills
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill(skillInput);
                    }
                  }}
                  placeholder="Add a skill"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => addSkill(skillInput)}
                  className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_SKILLS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => addSkill(chip)}
                    className="min-h-[44px] rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              {skills.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <li
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() =>
                          setSkills((prev) => prev.filter((x) => x !== s))
                        }
                        className="rounded p-2 hover:bg-blue-200 dark:hover:bg-blue-800"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Experience level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) =>
                  setExperienceLevel(
                    e.target.value as "Beginner" | "Intermediate" | "Expert"
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Previous projects{" "}
                <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                value={previousProjects}
                onChange={(e) => setPreviousProjects(e.target.value)}
                placeholder="Describe any relevant previous projects..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={skills.length === 0}
                onClick={() => setCurrentStep(2)}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white",
                  skills.length === 0
                    ? "cursor-not-allowed bg-gray-300 dark:bg-gray-600"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : null}

        {currentStep === 2 ? (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Preferences
            </h1>

            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sector interest
              </label>
              {sectorsLoading ? (
                <LoadingSkeleton variant="card" count={6} />
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(sectors ?? []).map((sec: { id: number; name: string }) => {
                    const checked = selectedSectorIds.includes(sec.id);
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => toggleSector(sec.id)}
                        className={cn(
                          "relative flex min-h-[4.5rem] items-center justify-center rounded-xl border-2 p-3 text-center text-sm font-medium transition-colors",
                          checked
                            ? "border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-100"
                            : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        )}
                      >
                        {checked ? (
                          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                        {sec.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Constraints
              </label>
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="Budget limitations, team size, timeline, etc."
                rows={4}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : null}

        {currentStep === 3 ? (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Generate
            </h1>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Review summary
              </h2>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Skills
                  </span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Sectors
                  </span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedSectorIds.length === 0 ? (
                      <span className="text-gray-500">None selected</span>
                    ) : (
                      selectedSectorIds.map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600"
                        >
                          {sectorById.get(id)?.name ?? id}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Constraints
                  </span>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {constraints.trim() || "—"}
                  </p>
                </div>
              </div>
            </div>

            {generateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center gap-4 py-10">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="animate-pulse text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  {PROGRESS_MESSAGES[progressIdx]}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => generateMutation.mutate()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-700"
              >
                <Sparkles className="h-6 w-6" />
                Generate Ideas
              </button>
            )}

            <div className="flex justify-start">
              <button
                type="button"
                disabled={generateMutation.isPending}
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          </motion.div>
        ) : null}

        {currentStep === "results" ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Generated Ideas
                <span className="ml-2 text-lg font-normal text-gray-500">
                  ({generatedIdeas.length})
                </span>
              </h1>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetWizard}
                  className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Generate More
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    let saved = 0;
                    for (const idea of generatedIdeas) {
                      try {
                        await saveIdea(idea.id);
                        saved++;
                      } catch { /* already saved or error -- skip */ }
                    }
                    toast.success(`${saved} idea${saved === 1 ? "" : "s"} saved to your dashboard`);
                  }}
                  className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Save All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {generatedIdeas.map((idea, i) => (
                <motion.div
                  key={String(idea.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {idea.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-100">
                      {idea.sector_name || `Sector ${idea.sector_id}`}
                    </span>
                    <ScoreIndicator
                      score={Math.round(idea.overall_probability)}
                      size="sm"
                      label="Probability"
                      animate={false}
                    />
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {truncate(idea.description, 150)}
                  </p>
                  <Link
                    to={`/ideas/${idea.id}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    View Full Analysis →
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
