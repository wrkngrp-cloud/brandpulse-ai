// Uses Google Maps Places API (Nearby Search) to infer audience demographics
// from nearby POIs (points of interest) within 500m of an OOH site.
//
// POI scoring logic:
// - Banks/ATMs + offices + hotels → "business_professional" / middle-upper income
// - Markets + bus stops + motor parks → "mass_market" / lower-middle income
// - Universities + cafes + gyms → "young_professional" / 18-34
// - Hospitals + schools + churches/mosques → "family" / 25-45
// - Malls + cinemas + restaurants → "upper_middle" / 25-44
//
// Input: lat, lng
// Output: PlaceDemographics object (or null on failure / missing key)

export interface PlaceDemographics {
  primary_audience: string
  income_tier: 'lower' | 'lower_middle' | 'middle' | 'upper_middle' | 'upper'
  age_skew: string
  gender_split: 'male_skew' | 'female_skew' | 'mixed'
  poi_types: string[]
  confidence: number
}

interface PlacesResult {
  types?: string[]
  name?: string
}

interface PlacesApiResponse {
  results?: PlacesResult[]
  status?: string
}

// Scoring buckets: each Place type contributes to a persona bucket
const PERSONA_WEIGHTS: Record<string, Record<string, number>> = {
  business_professional: {
    bank: 3, atm: 2, finance: 3, accounting: 2, insurance_agency: 2,
    office: 4, corporate: 3, hotel: 2, lodging: 2, courthouse: 1,
  },
  mass_market: {
    bus_station: 3, transit_station: 3, local_government_office: 2,
    market: 4, grocery_or_supermarket: 3, convenience_store: 2,
    mosque: 2, church: 2, place_of_worship: 1,
    gas_station: 2, car_repair: 1,
  },
  young_professional: {
    university: 4, school: 2, library: 2,
    cafe: 3, coffee: 2, gym: 3, fitness: 3, yoga: 2,
    coworking: 4, bar: 2, nightclub: 2, entertainment: 2,
    beauty_salon: 1, spa: 2,
  },
  family: {
    hospital: 3, pharmacy: 2, doctor: 2, health: 2,
    primary_school: 4, secondary_school: 3, child_care: 4,
    church: 2, mosque: 2, place_of_worship: 2,
    park: 3, playground: 4, stadium: 1,
  },
  upper_middle: {
    shopping_mall: 4, department_store: 3, clothing_store: 2, jewelry_store: 2,
    movie_theater: 3, restaurant: 3, food: 2, museum: 2, art_gallery: 2,
    car_dealer: 2, car_rental: 1,
  },
}

const INCOME_MAP: Record<string, 'lower' | 'lower_middle' | 'middle' | 'upper_middle' | 'upper'> = {
  mass_market:           'lower_middle',
  family:                'middle',
  young_professional:    'middle',
  business_professional: 'upper_middle',
  upper_middle:          'upper_middle',
}

const AGE_MAP: Record<string, string> = {
  mass_market:           '25-54',
  family:                '25-45',
  young_professional:    '18-34',
  business_professional: '28-50',
  upper_middle:          '25-44',
}

const GENDER_MAP: Record<string, 'male_skew' | 'female_skew' | 'mixed'> = {
  mass_market:           'mixed',
  family:                'mixed',
  young_professional:    'mixed',
  business_professional: 'male_skew',
  upper_middle:          'mixed',
}

function humaniseAudience(key: string): string {
  const map: Record<string, string> = {
    mass_market:           'Mass Market',
    family:                'Family',
    young_professional:    'Young Professional',
    business_professional: 'Business Professional',
    upper_middle:          'Upper Middle Class',
  }
  return map[key] ?? key
}

export async function inferDemographics(
  lat: number,
  lng: number,
): Promise<PlaceDemographics | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
    url.searchParams.set('location', `${lat},${lng}`)
    url.searchParams.set('radius', '500')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
    if (!res.ok) return null

    const json: PlacesApiResponse = await res.json()
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') return null

    const places = json.results ?? []
    if (places.length === 0) return null

    // Collect unique POI type labels for display
    const rawTypes: string[] = []
    for (const place of places) {
      if (place.types) rawTypes.push(...place.types)
    }
    const uniqueTypes = [...new Set(rawTypes)]
      .filter(t => !['point_of_interest', 'establishment', 'political', 'locality'].includes(t))
      .slice(0, 8)

    // Score each persona
    const scores: Record<string, number> = {
      mass_market:           0,
      family:                0,
      young_professional:    0,
      business_professional: 0,
      upper_middle:          0,
    }

    for (const place of places) {
      for (const type of place.types ?? []) {
        for (const [persona, weights] of Object.entries(PERSONA_WEIGHTS)) {
          const w = weights[type]
          if (w) scores[persona] += w
        }
      }
    }

    // Find the winning persona
    let topPersona = 'mass_market'
    let topScore   = 0
    let totalScore = 0

    for (const [persona, score] of Object.entries(scores)) {
      totalScore += score
      if (score > topScore) {
        topScore   = score
        topPersona = persona
      }
    }

    // Confidence: how dominant is the winner vs the field
    const confidence = totalScore > 0
      ? Math.min(0.95, Math.round((topScore / totalScore) * 100) / 100 + 0.15)
      : 0.3

    return {
      primary_audience: humaniseAudience(topPersona),
      income_tier:      INCOME_MAP[topPersona] ?? 'middle',
      age_skew:         AGE_MAP[topPersona] ?? '25-44',
      gender_split:     GENDER_MAP[topPersona] ?? 'mixed',
      poi_types:        uniqueTypes.slice(0, 6),
      confidence:       Math.min(0.95, confidence),
    }
  } catch {
    return null
  }
}
