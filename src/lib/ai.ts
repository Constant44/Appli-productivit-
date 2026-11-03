/**
 * Accès à Claude depuis la page (capacité `sample` de claude.ai) : l'IA utilise le compte Claude
 * de la personne qui ouvre l'appli. Indisponible hors claude.ai → les fonctions renvoient null.
 */
import { create } from "zustand";
import { capability } from "./platform";

/* eslint-disable @typescript-eslint/no-explicit-any */
let samplePromise: Promise<any | null> | null = null;
const getSample = () => (samplePromise ??= capability("sample"));

export const useAi = create<{ available: boolean | null }>(() => ({ available: null }));
void getSample().then((s) => useAi.setState({ available: !!s }));

export class AiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

const explain = (code?: string) =>
  code === "rate_limited" ? "Trop de demandes d'affilée : réessaie dans une minute."
  : code === "not_granted" ? "Autorise l'appli à utiliser Claude (menu Autorisations de la page)."
  : code === "invalid_json" ? "Réponse illisible de Claude, réessaie."
  : "Claude n'a pas pu répondre, réessaie.";

export async function askJson<T>(prompt: string, opts: { tier?: "quick" | "default" | "complex"; fresh?: boolean } = {}): Promise<T> {
  const sample = await getSample();
  if (!sample) throw new AiError("L'IA n'est disponible que dans la version claude.ai de l'appli.", "unavailable");
  try {
    return (await sample.json(prompt, { modelTier: opts.tier ?? "default", ...(opts.fresh ? { cache: false } : {}) })) as T;
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new AiError(explain(code), code);
  }
}
