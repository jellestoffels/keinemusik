export interface ShowDTO {
  id: string;
  systemId: string;
  date: string;
  artists: string[];
  city: string;
  country: string;
  venue: string;
  venueUrl: string;
  formattedName: string;
  ticketsLink: string;
  capacity: number | null;
  stageTime: string;
  setpiece: string;
  status: string;
  ld: string[];
  lo: string[];
  pm: string[];
  se: string[];
  checklistChecked: number;
  checklistTotal: number;
  folderUrl: string;
  fileCount: number;
  lat: number | null;
  lng: number | null;
}

export interface ChecklistItemDTO {
  id: string;
  checked: boolean;
  name: string;
  category: string | null;
  details: string | null;
  deadlineDays: number;
}

export interface LogDTO {
  id: string;
  date: string;
  type: string;
  desc: string;
}

export interface DashboardDataDTO {
  shows: ShowDTO[];
  crewOptions: Record<string, string[]>;
  artistOptions: string[];
  emailTemplates: Record<string, string>;
}

export const SHOW_FIELD_MAP = {
  artists: "artists",
  ld: "lightDesigners",
  lo: "lightOperators",
  pm: "productionManagers",
  se: "soundEngineers",
  capacity: "capacity",
  stageTime: "stageTime",
  setpiece: "setpiece",
  status: "statusPhase",
} as const;

export type ShowEditableField = keyof typeof SHOW_FIELD_MAP;
