/** Copy for the "easy to use" pass (UX-01…UX-18). en is the typed source; fr/ar/aeb must match. */
export const uxEn = {
  logSets: "Log sets (optional)",
  markDone: "Mark done",
  markUndone: "Not done yet",
};

export type UxCopy = typeof uxEn;

export const uxFr: UxCopy = {
  logSets: "Noter mes séries (facultatif)",
  markDone: "Marquer comme fait",
  markUndone: "Pas encore fait",
};

export const uxAr: UxCopy = {
  logSets: "سجّل المجموعات (اختياري)",
  markDone: "تمّ",
  markUndone: "لم يتمّ بعد",
};

export const uxAeb: UxCopy = {
  logSets: "سجّل السيريات (اختياري)",
  markDone: "كمّلت",
  markUndone: "مازلت",
};
