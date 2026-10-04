/**
 * ISO-3166 country code -> display name map, ported verbatim from the legacy
 * Apps Script COUNTRY_MAP constant. Used by the iCal parser to normalize
 * 2-letter country codes found in calendar descriptions.
 */
export const COUNTRY_MAP: Record<string, string> = {
  US: "United States",
  USA: "United States",
  GB: "United Kingdom",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  CH: "Switzerland",
  BE: "Belgium",
  AT: "Austria",
  PT: "Portugal",
  GR: "Greece",
  TR: "Turkey",
  PL: "Poland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  CZ: "Czech Republic",
  HU: "Hungary",
  RO: "Romania",
  HR: "Croatia",
  RS: "Serbia",
  SI: "Slovenia",
  SK: "Slovakia",
  RU: "Russia",
  UA: "Ukraine",
  GE: "Georgia",
  AZ: "Azerbaijan",
  BR: "Brazil",
  AR: "Argentina",
  MX: "Mexico",
  CO: "Colombia",
  CL: "Chile",
  PE: "Peru",
  UY: "Uruguay",
  DO: "Dominican Republic",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  TH: "Thailand",
  ID: "Indonesia",
  VN: "Vietnam",
  IN: "India",
  MY: "Malaysia",
  SG: "Singapore",
  PH: "Philippines",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  EG: "Egypt",
  MA: "Morocco",
  ZA: "South Africa",
  LB: "Lebanon",
  IL: "Israel",
  MC: "Monaco",
  KE: "Kenya",
};

/** Canonical crew role names used across the app (legacy COL_LD/LO/PM/SE columns). */
export const CREW_ROLES = [
  "Light Designer",
  "Light Operator",
  "Production Manager",
  "Sound Engineer",
] as const;

export type CrewRole = (typeof CREW_ROLES)[number];

export const SHOW_STATUSES = ["Option", "Confirmed", "ToDo", "Waiting", "Done", "Cancelled"] as const;

/** Maps the Prisma enum value back to the legacy display label (ToDo -> "To Do"). */
export const SHOW_STATUS_LABELS: Record<string, string> = {
  Option: "Option",
  Confirmed: "Confirmed",
  ToDo: "To Do",
  Waiting: "Waiting",
  Done: "Done",
  Cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<string, string> = {
  Option: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-100",
  Confirmed: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100",
  ToDo: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100",
  Waiting: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-100",
  Done: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-100",
  Cancelled: "bg-gray-500 text-white border-gray-600 dark:bg-gray-700 dark:text-gray-300",
  default: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300",
};
