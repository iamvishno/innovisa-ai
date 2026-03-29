import { Link } from "react-router-dom";
import { Globe, ExternalLink } from "lucide-react";

const productLinks = [
  { to: "/generate", label: "Generate Ideas" },
  { to: "/visa-check", label: "Visa Compliance" },
  { to: "/funding", label: "Funding Tracker" },
];

const resourceLinks = [
  { href: "https://www.gov.uk/innovator-founder-visa", label: "UK Gov: Innovator Founder Visa", external: true },
  { href: "https://www.ukri.org/", label: "UKRI - UK Research & Innovation", external: true },
  { href: "https://iuk.ktn-uk.org/", label: "Innovate UK KTN", external: true },
  { href: "https://www.gov.uk/government/organisations/innovate-uk", label: "Innovate UK", external: true },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">Product</h3>
            <ul className="mt-4 space-y-2">
              {productLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">Visa Resources</h3>
            <ul className="mt-4 space-y-2">
              {resourceLinks.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    {label}
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">About</h3>
            <p className="mt-4 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              AI-powered platform helping international founders discover fundable UK innovation ideas and navigate the Innovator Founder Visa process.
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
          <p className="text-center text-xs text-gray-500 dark:text-gray-500 sm:text-left">
            © {new Date().getFullYear()} InnoVisa AI. All rights reserved. This tool provides AI-generated insights for research purposes only and does not constitute legal or immigration advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
