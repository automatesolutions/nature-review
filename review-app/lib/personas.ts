import type { Brand, PersonaKey } from "./types";

export type Gender = "female" | "male";

export type PersonaMeta = {
  key: PersonaKey;
  name: string;
  brand: Brand;
  gender: Gender;
  blurb: string;
};

export const PERSONAS: PersonaMeta[] = [
  {
    key: "linda_chambers",
    name: "Linda Chambers",
    brand: "Montana Tallow",
    gender: "female",
    blurb: "cozy 50s+",
  },
  {
    key: "becca_rose",
    name: "Becca Rose",
    brand: "Montana Tallow",
    gender: "female",
    blurb: "31, Nashville",
  },
  {
    key: "brooke_swift",
    name: "Brooke Swift",
    brand: "Montana Tallow",
    gender: "female",
    blurb: "24, Annecy",
  },
  {
    key: "claire_donovan",
    name: "Claire Donovan",
    brand: "Lumerval",
    gender: "female",
    blurb: "42, Austin",
  },
];

export const PERSONA_KEYS = PERSONAS.map((p) => p.key);

export function isPersonaKey(value: string): value is PersonaKey {
  return PERSONA_KEYS.includes(value as PersonaKey);
}

export function getPersona(key: PersonaKey): PersonaMeta {
  return PERSONAS.find((p) => p.key === key)!;
}

export function brandForPersona(key: PersonaKey): Brand {
  return getPersona(key).brand;
}

export function genderForPersona(key: PersonaKey): Gender {
  return getPersona(key).gender;
}

export function displayNameForPersona(key: PersonaKey, fallback?: string): string {
  return getPersona(key).name || fallback || key;
}
