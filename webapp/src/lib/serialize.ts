import type { Show } from "@prisma/client";
import { SHOW_STATUS_LABELS } from "@/lib/constants";
import type { ShowDTO } from "@/types/dto";

type ShowWithChecklist = Show & { checklistItems: { checked: boolean }[] };

export function toShowDTO(show: ShowWithChecklist): ShowDTO {
  const checklistTotal = show.checklistItems.length;
  const checklistChecked = show.checklistItems.filter((i) => i.checked).length;

  return {
    id: show.id,
    systemId: show.systemId,
    date: show.date.toISOString().slice(0, 10),
    artists: show.artists,
    city: show.city ?? "",
    country: show.country ?? "",
    venue: show.venue ?? "",
    venueUrl: show.venueUrl ?? "",
    formattedName: show.formattedName ?? "",
    ticketsLink: show.ticketsLink ?? "",
    capacity: show.capacity,
    stageTime: show.stageTime ?? "",
    setpiece: show.setpiece ?? "",
    status: SHOW_STATUS_LABELS[show.statusPhase] ?? show.statusPhase,
    ld: show.lightDesigners,
    lo: show.lightOperators,
    pm: show.productionManagers,
    se: show.soundEngineers,
    checklistChecked,
    checklistTotal,
    folderUrl: show.folderUrl ?? "",
    fileCount: show.folderFileCount,
    lat: show.venueLat,
    lng: show.venueLng,
  };
}
