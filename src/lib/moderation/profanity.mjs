import { WORDS as KO } from "./badwords/ko.mjs";
import { WORDS as EN } from "./badwords/en.mjs";
import { WORDS as VI } from "./badwords/vi.mjs";
import { WORDS as TH } from "./badwords/th.mjs";
import { WORDS as ID } from "./badwords/id.mjs";
import { WORDS as TL } from "./badwords/tl.mjs";
import { WORDS as LO } from "./badwords/lo.mjs";
import { WORDS as MY } from "./badwords/my.mjs";
import { WORDS as MN } from "./badwords/mn.mjs";
import { WORDS as KM } from "./badwords/km.mjs";
import { WORDS as RU } from "./badwords/ru.mjs";

const ALL_WORDS = [...KO, ...EN, ...VI, ...TH, ...ID, ...TL, ...LO, ...MY, ...MN, ...KM, ...RU].map(
  (word) => word.toLowerCase(),
);

export function checkProfanity(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ALL_WORDS.some((word) => lower.includes(word));
}
