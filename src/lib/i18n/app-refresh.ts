export const appRefreshEn = {
  yourHabits: "Your habits",
  allHabitsDone: "All habits checked in",
  moreToday: "More for today",
  profileTools: "More tools",
  preview: "Card preview",
  chooseWins: "Choose your wins",
  moreWins: "More wins",
  challengeActivity: "Challenge activity",
  noFeedPosts: "Share something you’re proud of today.",
  shareWin: "Make a share card",
} as const;

type AppRefreshCopy = { [Key in keyof typeof appRefreshEn]: string };

export const appRefreshFr: AppRefreshCopy = {
  yourHabits: "Tes habitudes",
  allHabitsDone: "Toutes tes habitudes sont validées",
  moreToday: "Plus pour aujourd’hui",
  profileTools: "Autres outils",
  preview: "Aperçu de ta carte",
  chooseWins: "Choisis tes victoires",
  moreWins: "Autres victoires",
  challengeActivity: "Activité du défi",
  noFeedPosts: "Partage une petite victoire du jour.",
  shareWin: "Créer une carte à partager",
};

export const appRefreshAr: AppRefreshCopy = {
  yourHabits: "عاداتك",
  allHabitsDone: "سجّلت جميع عاداتك اليوم",
  moreToday: "المزيد لليوم",
  profileTools: "أدوات أخرى",
  preview: "معاينة بطاقتك",
  chooseWins: "اختر انتصاراتك",
  moreWins: "انتصارات أخرى",
  challengeActivity: "نشاط التحدي",
  noFeedPosts: "شارك شيئًا تفخر بإنجازه اليوم.",
  shareWin: "أنشئ بطاقة للمشاركة",
};

export const appRefreshAeb: AppRefreshCopy = {
  yourHabits: "عاداتك",
  allHabitsDone: "سجّلت عاداتك الكل اليوم",
  moreToday: "حاجات أخرى لليوم",
  profileTools: "أدوات أخرى",
  preview: "شوف الكارطة متاعك",
  chooseWins: "اختار ربحاتك",
  moreWins: "ربحات أخرى",
  challengeActivity: "نشاط التحدّي",
  noFeedPosts: "شارك حاجة عملتها اليوم وتفرح بيها.",
  shareWin: "حضّر كارطة للمشاركة",
};
