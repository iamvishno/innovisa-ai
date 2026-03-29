import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Clock,
  ExternalLink,
  Filter,
  PoundSterling as Pound,
  Search,
} from "lucide-react";

import LoadingSkeleton from "@/components/LoadingSkeleton";
import { fetchActiveCompetitions, fetchSectors } from "@/lib/api";
import {
  cn,
  daysUntil,
  formatDate,
  formatGBP,
  scoreBg,
} from "@/lib/utils";

interface Competition {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  deadline: string | null;
  sector_id: number | null;
  sector_name: string;
  funding_amount_gbp: number;
  applicant_requirements: string | null;
  status: string;
  days_until_deadline: number | null;
}

interface SectorRow {
  id: number;
  name: string;
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "open")
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  if (s === "upcoming")
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function countdownScore(daysLeft: number | null): number {
  if (daysLeft === null) return 80;
  if (daysLeft < 0) return 20;
  if (daysLeft <= 7) return 20;
  if (daysLeft <= 30) return 50;
  return 80;
}

function CompetitionCard({ comp }: { comp: Competition }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const desc = comp.description ?? "";
  const shortDesc = truncateText(desc, 200);
  const daysLeft = daysUntil(comp.deadline);

  return (
    <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {comp.url ? (
            <a
              href={comp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
            >
              {comp.title}
              <ExternalLink className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            </a>
          ) : (
            comp.title
          )}
        </h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
            statusBadgeClass(comp.status),
          )}
        >
          {comp.status}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{shortDesc}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {comp.sector_name ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {comp.sector_name}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Pound className="h-3.5 w-3.5" aria-hidden />
          {formatGBP(comp.funding_amount_gbp)}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          {comp.deadline ? formatDate(comp.deadline) : "No deadline"}
        </span>
        {daysLeft !== null && daysLeft >= 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              scoreBg(countdownScore(daysLeft)),
            )}
          >
            <Clock className="h-3 w-3" aria-hidden />
            {daysLeft === 0 ? "Due today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
          </span>
        ) : comp.deadline ? (
          <span className="text-xs text-muted-foreground">Deadline passed</span>
        ) : null}
      </div>

      {comp.applicant_requirements ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Requirements: </span>
          {truncateText(comp.applicant_requirements, 160)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setDetailsOpen((o) => !o)}
        className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline"
      >
        {detailsOpen ? "Hide Details" : "View Details"}
      </button>

      <AnimatePresence initial={false}>
        {detailsOpen ? (
          <motion.div
            key="full"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-muted-foreground">
              {desc || "No full description available."}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function FundingTracker() {
  const [search, setSearch] = useState("");
  const [sectorId, setSectorId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: competitions, isPending: compsLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: fetchActiveCompetitions as () => Promise<Competition[]>,
  });

  const { data: sectors, isPending: sectorsLoading } = useQuery({
    queryKey: ["sectors"],
    queryFn: fetchSectors as () => Promise<SectorRow[]>,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const list = competitions ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (q) {
        const hay = `${c.title} ${c.description ?? ""} ${c.sector_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sectorId) {
        if (String(c.sector_id ?? "") !== sectorId) return false;
      }
      if (statusFilter !== "all") {
        if (c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [competitions, search, sectorId, statusFilter]);

  const loading = compsLoading || sectorsLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Active Funding Competitions
        </h1>
        <p className="mt-2 text-muted-foreground">
          Find UK innovation funding opportunities that match your project
        </p>
      </header>

      <div className="mb-8 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search competitions..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search competitions"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground md:hidden" aria-hidden />
          <select
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filter by sector"
          >
            <option value="">All Sectors</option>
            {(sectors ?? []).map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="upcoming">Upcoming</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={4} />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <p className="text-lg font-medium text-foreground">No competitions found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search or filters, or{" "}
            <Link to="/" className="font-medium text-primary hover:underline">
              browse sectors
            </Link>{" "}
            for inspiration.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-6">
          {filtered.map((c) => (
            <li key={c.id}>
              <CompetitionCard comp={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
