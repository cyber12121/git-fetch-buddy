// Shared text helpers used by both App.tsx and CalendarModule.tsx.

// Strip emojis and a leading "Quest:" / "Event:" / "Todo:" / "Task:" prefix
// from an event/task title so manual and Google-synced titles can be compared.
// NOTE: deliberately only strips emoji + a leading prefix — it must NOT strip
// Cyrillic / CJK / Greek / Arabic etc., otherwise foreign-language titles
// would collapse to "" and break event de-duplication.
export const cleanString = (s: string): string => {
  return s
    .toLowerCase()
    .replace(/\p{Extended_Pictographic}/gu, "") // emoji (astral + others)
    .replace(/[\uD800-\uDFFF]/g, "") // remaining surrogate pairs
    .replace(/^\s*(quest|event|todo|task)[:\s]*/gi, "") // leading "Quest:" etc.
    .replace(/\s+/g, " ")
    .trim();
};
