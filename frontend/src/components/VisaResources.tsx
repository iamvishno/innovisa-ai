import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Landmark,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ENDORSING_BODIES = [
  {
    name: "Tech Nation (now part of Barclays Eagle Labs)",
    focus: "Digital technology businesses",
    url: "https://technation.io/",
    criteria: [
      "Genuine, innovative venture with growth potential",
      "Product or business model must be new or significantly improved",
      "Must demonstrate viability and scalability",
      "Must show potential for UK economic benefit",
    ],
  },
  {
    name: "The Startup Coalition",
    focus: "Technology startups across all sectors",
    url: "https://startupcoalition.io/",
    criteria: [
      "Technology-led innovation",
      "Scalable business model",
      "Evidence of market research and validation",
      "Clear UK growth strategy",
    ],
  },
  {
    name: "Envestors",
    focus: "Investment-ready businesses",
    url: "https://envestors.io/",
    criteria: [
      "Innovation in products, services, or processes",
      "Viable and commercially sustainable",
      "Scalable within and beyond the UK",
      "Positive economic contribution to the UK",
    ],
  },
];

const VISA_TIMELINE = [
  {
    phase: "Preparation",
    duration: "2-4 months",
    steps: [
      "Research endorsing bodies and their criteria",
      "Develop a strong business plan with UK focus",
      "Build a prototype or MVP to demonstrate innovation",
      "Gather evidence of market research and validation",
    ],
  },
  {
    phase: "Endorsement Application",
    duration: "4-8 weeks",
    steps: [
      "Choose and apply to an endorsing body",
      "Submit business plan, financials, and supporting docs",
      "Attend interview or pitch session",
      "Receive endorsement decision",
    ],
  },
  {
    phase: "Visa Application",
    duration: "3-8 weeks",
    steps: [
      "Apply online via UK Visas and Immigration (UKVI)",
      "Pay visa fee and healthcare surcharge (IHS)",
      "Provide biometric information at a visa centre",
      "Receive visa decision (usually within 3 weeks)",
    ],
  },
  {
    phase: "Post-Arrival",
    duration: "First 6 months",
    steps: [
      "Register with an endorsing body for monitoring",
      "Set up business operations in the UK",
      "Open a UK business bank account",
      "Begin executing your business plan",
    ],
  },
];

const CRITERIA_DETAILS = [
  {
    title: "Innovation",
    icon: GraduationCap,
    description: "Your business must have a genuine, innovative idea that is new or significantly different from anything else on the market.",
    tips: [
      "Show how your product or service differs from existing solutions",
      "Highlight any proprietary technology or intellectual property",
      "Demonstrate research into the competitive landscape",
      "Reference any patents, publications, or industry recognition",
    ],
  },
  {
    title: "Viability",
    icon: FileText,
    description: "You must demonstrate that your business idea is viable and you have the skills, knowledge, and market awareness to run it successfully.",
    tips: [
      "Present a realistic financial forecast (3-5 years)",
      "Show evidence of customer interest or early traction",
      "Demonstrate relevant industry expertise or partnerships",
      "Include a clear go-to-market strategy",
    ],
  },
  {
    title: "Scalability",
    icon: Globe,
    description: "Your business plan must show structured planning and potential for growth in the UK and internationally.",
    tips: [
      "Outline a clear plan for scaling operations",
      "Show addressable market size and growth potential",
      "Describe plans for hiring and team expansion",
      "Discuss international expansion strategy",
    ],
  },
];

const USEFUL_LINKS = [
  {
    category: "Official Government",
    links: [
      { label: "UK Gov: Innovator Founder Visa", url: "https://www.gov.uk/innovator-founder-visa" },
      { label: "Endorsed Funding Programmes", url: "https://www.gov.uk/government/publications/endorsing-bodies-innovator-founder" },
      { label: "Immigration Rules - Appendix Innovator Founder", url: "https://www.gov.uk/guidance/immigration-rules/appendix-innovator-founder" },
    ],
  },
  {
    category: "Funding & Support",
    links: [
      { label: "Innovate UK", url: "https://www.gov.uk/government/organisations/innovate-uk" },
      { label: "UKRI Funding Finder", url: "https://www.ukri.org/opportunity/" },
      { label: "British Business Bank - Start Up Loans", url: "https://www.startuploans.co.uk/" },
      { label: "Innovate UK KTN - Innovation Network", url: "https://iuk.ktn-uk.org/" },
    ],
  },
  {
    category: "Business Setup",
    links: [
      { label: "Companies House - Register a company", url: "https://www.gov.uk/set-up-limited-company" },
      { label: "HMRC - Tax registration", url: "https://www.gov.uk/register-for-self-assessment" },
      { label: "Intellectual Property Office", url: "https://www.gov.uk/government/organisations/intellectual-property-office" },
    ],
  },
];

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full min-h-[44px] items-center justify-between gap-3 px-5 py-4 text-left text-base font-semibold text-gray-900 dark:text-gray-100"
      >
        {title}
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-gray-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VisaResources() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Visa Resources</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
          UK Innovator Founder Visa Guide
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          Everything you need to know about applying for the UK Innovator Founder Visa, including endorsing bodies,
          assessment criteria, timeline, and useful resources.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This guide is for informational purposes only and does not constitute legal or immigration advice.
            Always consult a qualified immigration solicitor before making application decisions.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        <CollapsibleSection title="Assessment Criteria" defaultOpen>
          <div className="space-y-6">
            {CRITERIA_DETAILS.map((c) => (
              <div key={c.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{c.title}</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{c.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {c.tips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Endorsing Bodies">
          <div className="space-y-6">
            {ENDORSING_BODIES.map((body) => (
              <div key={body.name} className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{body.name}</h3>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{body.focus}</p>
                  </div>
                  <a
                    href={body.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Visit
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {body.criteria.map((criterion) => (
                    <li key={criterion} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
                      {criterion}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Application Timeline">
          <div className="relative space-y-8 pl-8 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-blue-200 dark:before:bg-blue-800">
            {VISA_TIMELINE.map((phase, i) => (
              <div key={phase.phase} className="relative">
                <div className="absolute -left-8 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                  {i + 1}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{phase.phase}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <Clock className="h-3 w-3" aria-hidden />
                      {phase.duration}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {phase.steps.map((step) => (
                      <li key={step} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Useful Links & Resources">
          <div className="space-y-6">
            {USEFUL_LINKS.map((group) => (
              <div key={group.category}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Landmark className="h-4 w-4" aria-hidden />
                  {group.category}
                </h3>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-200"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <div className="mt-10 rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
            <BookOpen className="h-5 w-5" aria-hidden />
            Ready to get started?
          </h2>
          <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
            Use our AI-powered tools to discover innovative project ideas that align with UK Innovator Founder Visa criteria,
            check your idea's compliance, and find matching funding opportunities.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/generate"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Generate Ideas
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/visa-check"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-blue-300 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
            >
              Check Visa Compliance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
