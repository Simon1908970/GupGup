import { useEffect, useState } from "react";
import { checkProfanity } from "./profanity";

export function useProfanityCheck(text: string, delayMs = 300): boolean {
  const [hasProfanity, setHasProfanity] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasProfanity(checkProfanity(text));
    }, delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);

  return hasProfanity;
}
