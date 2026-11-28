/** Accès aux capacités de claude.ai (base de données, identité, Google Agenda). Absentes hors de claude.ai. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = () => (window as any).claude as { use: (n: string) => Promise<any> } | undefined;
export async function capability(name: string): Promise<any | null> {
  try {
    return (await runtime()?.use(name)) ?? null;
  } catch {
    return null;
  }
}
