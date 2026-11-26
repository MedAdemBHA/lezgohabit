/** Copy for the "easy to use" pass (UX-01…UX-18). en is the typed source; fr/ar/aeb must match. */
export const uxEn = {
  doneTarget: "Done — {{target}} {{unit}}",
  orPartial: "Or log part of it:",
  sleptEnough: "Slept {{n}}h or more",
  lastNight: "Last night — or log the hours:",
  sleepRule: "Last night · {{n}}h or more",
  logSets: "Log sets (optional)",
  markDone: "Mark done",
  markUndone: "Not done yet",
};

export type UxCopy = typeof uxEn;

export const uxFr: UxCopy = {
  doneTarget: "Fait — {{target}} {{unit}}",
  orPartial: "Ou note une partie :",
  sleptEnough: "Dormi {{n}} h ou plus",
  lastNight: "La nuit dernière — ou note tes heures :",
  sleepRule: "La nuit dernière · {{n}} h ou plus",
  logSets: "Noter mes séries (facultatif)",
  markDone: "Marquer comme fait",
  markUndone: "Pas encore fait",
};

export const uxAr: UxCopy = {
  doneTarget: "تمّ — {{target}} {{unit}}",
  orPartial: "أو سجّل جزءًا منه:",
  sleptEnough: "نمت {{n}} ساعات أو أكثر",
  lastNight: "الليلة الماضية — أو سجّل الساعات:",
  sleepRule: "الليلة الماضية · {{n}} ساعات أو أكثر",
  logSets: "سجّل المجموعات (اختياري)",
  markDone: "تمّ",
  markUndone: "لم يتمّ بعد",
};

export const uxAeb: UxCopy = {
  doneTarget: "كمّلت — {{target}} {{unit}}",
  orPartial: "ولا سجّل شويّة منها:",
  sleptEnough: "رقدت {{n}} سوايع ولا أكثر",
  lastNight: "البارح في الليل — ولا سجّل السوايع:",
  sleepRule: "البارح في الليل · {{n}} سوايع ولا أكثر",
  logSets: "سجّل السيريات (اختياري)",
  markDone: "كمّلت",
  markUndone: "مازلت",
};
