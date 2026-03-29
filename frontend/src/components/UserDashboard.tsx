import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  BarChart3,
  ChevronRight,
  FileText,
  Heart,
  Settings,
  Trash2,
  User,
} from "lucide-react";

import LoadingSkeleton from "@/components/LoadingSkeleton";
import ScoreIndicator from "@/components/ScoreIndicator";
import { useAuth } from "@/hooks/useAuth";
import { fetchSavedIdeas, unsaveIdea, authOnboarding } from "@/lib/api";
import { cn, formatDate, daysUntil, formatGBP, scoreBg } from "@/lib/utils";

type TabId = "saved" | "analyses" | "account";

interface IdeaCardShape {
  id: string;
  title: string;
  description: string;
  overall_probability: number;
  sector_id: number;
  sector_name: string;
}

interface SavedIdeaRow {
  id: string;
  idea: IdeaCardShape;
  user_notes: string | null;
  saved_at: string;
}

type OnboardingPayload = {
  skills?: string[];
  interests?: string[];
  background?: string;
  timeline?: string;
};

function parseOnboarding(raw: Record<string, unknown> | null): OnboardingPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const skills = raw.skills;
  const interests = raw.interests;
  return {
    skills: Array.isArray(skills) ? skills.map(String) : [],
    interests: Array.isArray(interests) ? interests.map(String) : [],
    background: typeof raw.background === "string" ? raw.background : "",
    timeline: typeof raw.timeline === "string" ? raw.timeline : "",
  };
}

function notesPreview(notes: string | null, max = 120): string | null {
  if (!notes?.trim()) return null;
  const t = notes.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("saved");
  const queryClient = useQueryClient();

  const { data: savedList, isPending: savedLoading } = useQuery({
    queryKey: ["savedIdeas"],
    queryFn: fetchSavedIdeas as () => Promise<SavedIdeaRow[]>,
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: (savedId: string) => unsaveIdea(savedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedIdeas"] });
      toast.success("Removed from saved");
    },
  });

  const onboarding = useMemo(() => parseOnboarding(user?.onboarding_data ?? null), [user?.onboarding_data]);

  const tierLabel = user?.subscription_tier
    ? user.subscription_tier.replace(/_/g, " ")
    : "—";

  const tabs: { id: TabId; label: string; icon: typeof Heart }[] = [
    { id: "saved", label: "Saved Ideas", icon: Heart },
    { id: "analyses", label: "Recent Analyses", icon: BarChart3 },
    { id: "account", label: "Account Settings", icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            My Dashboard
          </h1>
          {user ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4" aria-hidden />
                <span className="font-medium text-foreground">{user.full_name}</span>
              </span>
              <span aria-hidden className="text-border">
                ·
              </span>
              <span>{user.email}</span>
            </div>
          ) : null}
        </div>
        {user ? (
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {tierLabel}
          </span>
        ) : null}
      </header>

      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-border scrollbar-hide" aria-label="Dashboard sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        {tab === "saved" ? (
          <motion.section
            key="saved"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {savedLoading ? (
              <LoadingSkeleton variant="card" count={4} />
            ) : !savedList?.length ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="mt-4 text-lg font-medium text-foreground">
                  No saved ideas yet. Start exploring sectors to find ideas worth saving.
                </p>
                <Link
                  to="/"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Browse sectors
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {savedList.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 break-words font-semibold leading-snug text-foreground">
                        {row.idea.title}
                      </h2>
                      <ScoreIndicator
                        score={Math.round(row.idea.overall_probability)}
                        size="sm"
                        animate={false}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          scoreBg(Math.round(row.idea.overall_probability)),
                        )}
                      >
                        {row.idea.sector_name || `Sector ${row.idea.sector_id}`}
                      </span>
                    </div>
                    {notesPreview(row.user_notes) ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {notesPreview(row.user_notes)}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Saved {formatDate(row.saved_at)}
                      {(() => {
                        const d = daysUntil(row.saved_at);
                        if (d === null || d >= 0) return null;
                        const ago = Math.abs(d);
                        return (
                          <span className="block text-muted-foreground/80">
                            ({ago} day{ago === 1 ? "" : "s"} ago)
                          </span>
                        );
                      })()}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={`/ideas/${row.idea.id}`}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
                      >
                        View analysis
                      </Link>
                      <button
                        type="button"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(row.id)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        aria-label="Remove saved idea"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        {removeMutation.isPending ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        ) : null}

        {tab === "analyses" ? (
          <motion.section
            key="analyses"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center"
          >
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-4 text-lg font-medium text-foreground">
              Your recent idea analyses will appear here.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              UK innovation programmes often start around {formatGBP(50_000)} — generate an idea to see matches.
            </p>
            <Link
              to="/generate"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Generate your first idea
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </motion.section>
        ) : null}

        {tab === "account" ? (
          <motion.section
            key="account"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="space-y-8"
          >
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Profile</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Name
                  </label>
                  <p className="mt-1 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {user?.full_name ?? "—"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Email
                  </label>
                  <p className="mt-1 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {user?.email ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Onboarding</h2>
              {!onboarding ||
              (!onboarding.skills?.length &&
                !onboarding.interests?.length &&
                !onboarding.background &&
                !onboarding.timeline) ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete your profile to get better recommendations.
                </p>
              ) : null}

              <div className="mt-4 space-y-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Skills
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(onboarding?.skills?.length ? onboarding.skills : []).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {s}
                      </span>
                    ))}
                    {!onboarding?.skills?.length ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Interests
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(onboarding?.interests?.length ? onboarding.interests : []).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {s}
                      </span>
                    ))}
                    {!onboarding?.interests?.length ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Background
                  </span>
                  <p className="mt-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {onboarding?.background?.trim() ? onboarding.background : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Timeline
                  </span>
                  <p className="mt-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {onboarding?.timeline?.trim() ? onboarding.timeline : "—"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!onboarding) return;
                  try {
                    await authOnboarding({
                      skills: onboarding.skills ?? [],
                      interests: onboarding.interests ?? [],
                      background: onboarding.background ?? "",
                      timeline: onboarding.timeline ?? "",
                    });
                    toast.success("Profile updated");
                  } catch {
                    toast.error("Failed to update profile");
                  }
                }}
                className="mt-6 min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Update profile
              </button>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your plan controls access to premium features and limits.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
                  Current plan: {tierLabel}
                </span>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
