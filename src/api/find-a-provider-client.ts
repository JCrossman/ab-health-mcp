/**
 * Alberta Find-a-Provider REST client.
 *
 * Public, unauthenticated REST API at https://albertafindaprovider.ca.
 * Source: reverse-engineered from a HAR capture of the find-a-doc map UI.
 *
 * No session or cookies required. No PHI involved — all data is public
 * provider directory information (clinics, physicians, nurse practitioners,
 * PCNs, languages, services).
 *
 * Used in both real and demo mode (find-a-provider is always real because
 * the data is public and calling the live API validates the integration).
 */

const BASE_URL = 'https://albertafindaprovider.ca';
const USER_AGENT = 'ab-health-mcp/1.x (+https://www.myaihealth.ca)';
const DEFAULT_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Lookup tables (extracted directly from HAR responses).
//
// These IDs are stable in the upstream Laravel database; treating them as
// constants is safe because the upstream UI also hard-codes them.
// ---------------------------------------------------------------------------

export const SERVICES: Record<number, string> = {
  1: 'Open After Hours',
  2: 'Wheelchair Access',
  4: 'Walk-in Services',
  5: 'Virtual Appointments',
  6: 'Online Booking',
};

export const LANGUAGES: Record<number, string> = {
  1: 'Cantonese',
  2: 'English',
  3: 'Arabic',
  5: 'French',
  7: 'German',
  9: 'Hungarian',
  11: 'Italian',
  13: 'Farsi',
  14: 'Polish',
  15: 'Portuguese',
  18: 'Hausa',
  19: 'Hindi',
  20: 'Tagalog',
  21: 'Spanish',
  22: 'Vietnamese',
  23: 'Korean',
  24: 'Japanese',
  27: 'Mandarin',
  28: 'Greek',
  31: 'Ukrainian',
  33: 'Punjabi',
  34: 'Romanian',
  35: 'Russian',
  37: 'Serbian',
  43: 'Somali',
  51: 'Urdu',
  54: 'Yoruba',
  58: 'Croatian',
  99: 'Other',
};

export const PCNS: Record<number, string> = {
  2: "Calgary Foothills PCN",
  3: 'Highland PCN',
  4: 'Calgary Rural PCN',
  5: 'Calgary West Central PCN',
  6: 'Mosaic PCN',
  7: 'South Calgary PCN',
  9: 'Lakeland PCN',
  10: 'Bonnyville PCN',
  11: 'Cold Lake PCN',
  12: 'Wood Buffalo PCN',
  15: 'Grande Prairie PCN',
  18: 'Aspen PCN',
  19: 'Chinook PCN',
  20: 'Palliser PCN',
  21: 'Big Country PCN',
  23: 'Wolf Creek PCN',
  25: 'Wetaskiwin PCN',
  27: 'Kalyna Country PCN',
  28: 'Camrose PCN',
  30: 'Peaks to Prairies PCN',
  33: 'Edmonton North PCN',
  34: "Edmonton O-day'min PCN",
  35: 'Edmonton Southside PCN',
  36: 'Edmonton West PCN',
  38: 'Leduc Beaumont Devon PCN',
  39: 'Sherwood Park PCN',
  40: 'St. Albert Sturgeon PCN',
  41: 'WestView PCN',
  42: 'No PCN',
};

// ---------------------------------------------------------------------------
// Fuzzy-match helpers — accept human-friendly strings, return upstream IDs.
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function lookupId(table: Record<number, string>, value: string): number | null {
  if (!value) return null;
  const target = normalize(value);
  // exact normalized match first
  for (const [id, name] of Object.entries(table)) {
    if (normalize(name) === target) return Number(id);
  }
  // substring match (e.g. "edmonton west" matches "Edmonton West PCN")
  for (const [id, name] of Object.entries(table)) {
    const n = normalize(name);
    if (n.includes(target) || target.includes(n)) return Number(id);
  }
  return null;
}

export function resolveLanguage(name: string): number {
  const id = lookupId(LANGUAGES, name);
  if (id == null) {
    throw new Error(
      `Unknown language: "${name}". Supported languages: ${Object.values(LANGUAGES).join(', ')}.`,
    );
  }
  return id;
}

export function resolvePcn(name: string): number {
  const id = lookupId(PCNS, name);
  if (id == null) {
    throw new Error(
      `Unknown PCN: "${name}". Supported PCNs: ${Object.values(PCNS).join(', ')}.`,
    );
  }
  return id;
}

export function resolveServices(names: string[]): number[] {
  const ids: number[] = [];
  for (const n of names) {
    const id = lookupId(SERVICES, n);
    if (id == null) {
      throw new Error(
        `Unknown service: "${n}". Supported services: ${Object.values(SERVICES).join(', ')}.`,
      );
    }
    ids.push(id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Geocoding — postal code or address → lat/lng.
//
// Uses Nominatim (OpenStreetMap), a free public geocoder. Per Nominatim's
// usage policy: identify ourselves with a User-Agent and don't hammer the
// service. Single calls from a desktop client are well within the policy.
// ---------------------------------------------------------------------------

export interface Geocoded {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocode(query: string): Promise<Geocoded> {
  const cleaned = query.trim();
  if (!cleaned) throw new Error('Empty location query.');

  // Detect Canadian postal code (with or without space): A1A 1A1
  const postalMatch = cleaned.match(/^([A-Za-z]\d[A-Za-z])\s*(\d[A-Za-z]\d)$/);
  const fsaOnly = cleaned.match(/^([A-Za-z]\d[A-Za-z])$/);
  const fsa = postalMatch ? postalMatch[1].toUpperCase() : fsaOnly ? fsaOnly[1].toUpperCase() : null;

  // For Canadian postal codes, try Nominatim first (more accurate when it
  // has the data), then fall back to zippopotam.us at the FSA level
  // (~1-3 km accuracy, fine for clinic radius search).
  if (postalMatch || fsaOnly) {
    if (postalMatch) {
      const nom = await tryNominatimPostal(`${postalMatch[1].toUpperCase()} ${postalMatch[2].toUpperCase()}`);
      if (nom) return nom;
    }
    if (fsa) {
      const zp = await tryZippopotamFsa(fsa);
      if (zp) return zp;
    }
    throw new Error(
      `Could not resolve "${cleaned}" to coordinates. Try a different postal code, a free-form address, or pass latitude/longitude directly.`,
    );
  }

  // Free-form address: Nominatim only.
  const result = await tryNominatimQuery(cleaned);
  if (result) return result;
  throw new Error(
    `Could not geocode "${cleaned}". Try a Canadian postal code (e.g. "T6G 1L7") or pass latitude/longitude directly.`,
  );
}

async function tryNominatimPostal(postal: string): Promise<Geocoded | null> {
  const params = new URLSearchParams({ format: 'json', countrycodes: 'ca', limit: '1', postalcode: postal });
  return nominatimRequest(params);
}

async function tryNominatimQuery(q: string): Promise<Geocoded | null> {
  const params = new URLSearchParams({ format: 'json', countrycodes: 'ca', limit: '1', q });
  return nominatimRequest(params);
}

async function nominatimRequest(params: URLSearchParams): Promise<Geocoded | null> {
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0];
    return { lat: Number(hit.lat), lng: Number(hit.lon), displayName: hit.display_name };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryZippopotamFsa(fsa: string): Promise<Geocoded | null> {
  const url = `https://api.zippopotam.us/ca/${fsa}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: Array<{ latitude?: string; longitude?: string; 'place name'?: string; state?: string }> };
    const place = data?.places?.[0];
    if (!place || !place.latitude || !place.longitude) return null;
    return {
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      displayName: `${place['place name'] ?? fsa}, ${place.state ?? ''} (FSA ${fsa})`.trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Response trimming — strip noisy / oversized fields before returning to LLM.
// ---------------------------------------------------------------------------

const NOISY_FIELDS = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'laravel_through_key',
  'polygon',
  'min_x',
  'min_y',
  'max_x',
  'max_y',
  'media',
  'rawDescription',
  'pivot',
]);

function trim(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(trim);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (NOISY_FIELDS.has(k)) continue;
      if (v == null) continue;
      out[k] = trim(v);
    }
    return out;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Core fetch helper.
// ---------------------------------------------------------------------------

async function fapFetch(path: string, params: URLSearchParams): Promise<unknown> {
  const url = `${BASE_URL}${path}?${params.toString()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'Cache-Control': 'no-cache',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Find-a-Provider request failed (${res.status} ${res.statusText}).`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Find-a-Provider request timed out after ${DEFAULT_TIMEOUT_MS}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Embeds requested by the upstream UI; we mirror them so the LLM gets a
// fully-resolved record in a single call.
const SEARCH_WITH = ['pcn', 'physicians', 'physicians.languages', 'physicians.specialties', 'services', 'specialties'];
const PHYSICIAN_WITH = ['pcn', 'clinics', 'anp', 'languages', 'specialties'];

// ---------------------------------------------------------------------------
// Public API — search clinics by geo radius.
// ---------------------------------------------------------------------------

export interface FindClinicsParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  acceptingNewPatients?: boolean;
  genderPreference?: 'm' | 'f';
  languageId?: number;
  pcnId?: number;
  serviceIds?: number[];
  walkInOnly?: boolean;
  limit?: number;
  /** Original address for the `address` query param (pass-through, optional). */
  address?: string;
}

export async function findClinics(p: FindClinicsParams): Promise<unknown> {
  const params = new URLSearchParams({
    radius: String(p.radiusKm ?? 10),
    limit: String(Math.min(p.limit ?? 25, 25)),
    lat: String(p.lat),
    lng: String(p.lng),
  });
  if (p.acceptingNewPatients !== false) params.set('anp', '1');
  if (p.genderPreference) params.set('gender-pref', p.genderPreference);
  if (p.languageId != null) params.append('language-ids[]', String(p.languageId));
  if (p.pcnId != null) params.append('pcn-ids[]', String(p.pcnId));
  if (p.walkInOnly) params.set('is-dedicated-walk-in', '1');
  for (const s of p.serviceIds ?? []) params.append('service-ids[]', String(s));
  for (const w of SEARCH_WITH) params.append('with[]', w);
  if (p.address) params.set('address', p.address);

  const data = await fapFetch('/search', params);
  return trim(data);
}

// ---------------------------------------------------------------------------
// Public API — search physicians/NPs by name.
// ---------------------------------------------------------------------------

export interface SearchPhysiciansByNameParams {
  name: string;
  isNursePractitioner: 0 | 1;
  page?: number;
  limit?: number;
}

export async function searchPhysiciansByName(p: SearchPhysiciansByNameParams): Promise<unknown> {
  const params = new URLSearchParams({
    is_nurse_practitioner: String(p.isNursePractitioner),
    page: String(p.page ?? 1),
    limit: String(Math.min(p.limit ?? 25, 25)),
    'public-find': p.name,
  });
  for (const w of PHYSICIAN_WITH) params.append('with[]', w);
  const data = await fapFetch('/search/directory/physicians', params);
  return trim(data);
}

// ---------------------------------------------------------------------------
// Public API — get a clinic or physician by ID.
// ---------------------------------------------------------------------------

export async function getClinicById(id: number): Promise<unknown> {
  const params = new URLSearchParams();
  params.append('ids[]', String(id));
  for (const w of SEARCH_WITH) params.append('with[]', w);
  const data = await fapFetch('/search/directory/clinics', params);
  return trim(data);
}

export async function getPhysicianById(id: number, isNursePractitioner: 0 | 1 = 0): Promise<unknown> {
  const params = new URLSearchParams({
    is_nurse_practitioner: String(isNursePractitioner),
  });
  params.append('ids[]', String(id));
  for (const w of PHYSICIAN_WITH) params.append('with[]', w);
  const data = await fapFetch('/search/directory/physicians', params);
  return trim(data);
}
