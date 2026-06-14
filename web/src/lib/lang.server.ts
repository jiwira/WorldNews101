import { cookies } from "next/headers";
import { normalizeLang, type Lang } from "./lang";

/** Read the reader's chosen language from the `lang` cookie (defaults to English). */
export async function getLang(): Promise<Lang> {
  return normalizeLang((await cookies()).get("lang")?.value);
}
