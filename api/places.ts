import { failure, isRecord, isNonEmptyString, readJsonBody, success } from './_lib/http';
import type { ProductError } from '../src/types/error';

const allowedCategories = ['food', 'shopping', 'attraction', 'convenience', 'station', 'all'] as const;
type AllowedCategory = (typeof allowedCategories)[number];

// Hard search radius for coordinate-based Nearby Search (metres); do not widen without product approval.
const NEARBY_SEARCH_RADIUS_METERS = 500;

// Places API (New) Table A types per approved category vocabulary.
const includedTypesByCategory: Record<AllowedCategory, string[] | undefined> = {
  food: ['restaurant', 'cafe'],
  shopping: ['shopping_mall', 'store'],
  attraction: ['tourist_attraction'],
  convenience: ['convenience_store'],
  station: ['train_station', 'transit_station'],
  all: undefined,
};

// Keyword appended to manualArea for Text Search so category intent is preserved without overriding the area.
const manualSearchKeywordByCategory: Record<AllowedCategory, string> = {
  food: '美食',
  shopping: '購物',
  attraction: '景點',
  convenience: '便利商店',
  station: '車站',
  all: '景點',
};

type GooglePlace = {
  id?: string;
  name?: string;
  category?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
  editorialSummary?: { text?: string };
  types?: string[];
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody<Partial<{ location: { type?: string; coordinates?: { latitude?: unknown; longitude?: unknown }; manualArea?: string }; category?: string; query?: string }>>(request);
    if (!isRecord(body) || !isRecord(body.location)) {
      return Response.json(failure(invalidInput()), { status: 400 });
    }

    const locationType = body.location.type;
    let coordinates: { latitude: number; longitude: number } | undefined;

    if (locationType === 'coordinates') {
      const latitude = Number(body.location.coordinates?.latitude);
      const longitude = Number(body.location.coordinates?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return Response.json(failure(invalidInput()), { status: 400 });
      }
      coordinates = { latitude, longitude };
    } else if (locationType === 'manual') {
      if (!isNonEmptyString(body.location.manualArea, 50)) {
        return Response.json(failure(invalidInput()), { status: 400 });
      }
    } else {
      return Response.json(failure(invalidInput()), { status: 400 });
    }

    const rawCategory = typeof body.category === 'string' ? body.category : 'all';
    if (!allowedCategories.includes(rawCategory as AllowedCategory)) {
      return Response.json(failure(invalidInput()), { status: 400 });
    }
    const category = rawCategory as AllowedCategory;

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return Response.json(failure({
        code: 'PLACES_SERVICE_UNAVAILABLE',
        userTitle: '附近探索服務暫時無法連線',
        userMessage: '無法取得周邊景點與店家資料。',
        actionableStep: '請輸入地區名稱重新搜尋，或前往東京百科查看區域景點介紹。',
      } satisfies ProductError), { status: 500 });
    }

    const fieldMask = 'places.displayName,places.formattedAddress,places.location,places.businessStatus,places.editorialSummary,places.types,places.id';
    const providerHeaders = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY ?? '',
      'X-Goog-FieldMask': fieldMask,
    };

    let response: Response;
    if (coordinates) {
      // Nearby Search (New): geographic restriction is a hard cutoff, not a soft bias.
      const includedTypes = includedTypesByCategory[category];
      response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: providerHeaders,
        body: JSON.stringify({
          ...(includedTypes ? { includedTypes } : {}),
          languageCode: 'zh-TW',
          locationRestriction: {
            circle: {
              center: { latitude: coordinates.latitude, longitude: coordinates.longitude },
              radius: NEARBY_SEARCH_RADIUS_METERS,
            },
          },
        }),
      });
    } else {
      const manualArea = body.location.manualArea ?? '';
      const keyword = query || manualSearchKeywordByCategory[category];
      // manualArea must always anchor the query; query/category only append, never replace it.
      const textQuery = manualArea ? `${manualArea} ${keyword}`.trim() : (query || '東京 景點');
      response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: providerHeaders,
        body: JSON.stringify({
          textQuery,
          languageCode: 'zh-TW',
          regionCode: 'JP',
        }),
      });
    }

    if (!response.ok) {
      return Response.json(failure({
        code: 'PLACES_SERVICE_UNAVAILABLE',
        userTitle: '附近探索服務暫時無法連線',
        userMessage: '無法取得周邊景點與店家資料。',
        actionableStep: '請輸入地區名稱重新搜尋，或前往東京百科查看區域景點介紹。',
      } satisfies ProductError), { status: 500 });
    }

    const payload = (await response.json()) as { places?: GooglePlace[] };
    const places = (payload.places ?? []).map((place, index) => {
      const googlePlace = place as GooglePlace;
      const displayName = String(googlePlace.displayName?.text ?? googlePlace.name ?? `地點 ${index + 1}`);
      const address = String(googlePlace.formattedAddress ?? '東京都');
      const latitude = Number(googlePlace.location?.latitude ?? 0);
      const longitude = Number(googlePlace.location?.longitude ?? 0);
      const types = Array.isArray(googlePlace.types) ? googlePlace.types : [];
      const resolvedCategory = deriveCategory(types, String(googlePlace.category ?? category));
      return {
        id: String(googlePlace.id ?? `place-${index + 1}`),
        name: displayName,
        category: resolvedCategory,
        address,
        location: { latitude, longitude },
        distanceMeter: coordinates ? estimateDistance(coordinates, { latitude, longitude }) : undefined,
        openNowStatus: mapBusinessStatus(String(googlePlace.businessStatus ?? '')),
        whyRecommended: String(googlePlace.editorialSummary?.text ?? '距離您較近，適合當前需求與路線安排。'),
      };
    });

    return Response.json(success({ places }));
  } catch {
    return Response.json(failure({
      code: 'PLACES_SERVICE_UNAVAILABLE',
      userTitle: '附近探索服務暫時無法連線',
      userMessage: '無法取得周邊景點與店家資料。',
      actionableStep: '請輸入地區名稱重新搜尋，或前往東京百科查看區域景點介紹。',
    } satisfies ProductError), { status: 500 });
  }
}

function invalidInput(): ProductError {
  return {
    code: 'INVALID_INPUT',
    userTitle: '無法取得位置資訊',
    userMessage: '請提供有效的 GPS 座標或手動輸入區域。',
    actionableStep: '請輸入您想搜尋的地區名稱，例如「新宿」或「淺草」。',
  };
}

function deriveCategory(types: string[], fallback: string): string {
  if (types.some((type) => /restaurant|food|cafe/.test(type))) return '拉麵';
  if (types.some((type) => /shop|store|mall/.test(type))) return '購物';
  if (types.some((type) => /tourist_attraction|museum|park/.test(type))) return '景點';
  if (types.some((type) => /station|transit_station/.test(type))) return '車站';
  if (fallback === 'food') return '拉麵';
  if (fallback === 'shopping') return '購物';
  if (fallback === 'attraction') return '景點';
  if (fallback === 'station') return '車站';
  if (fallback === 'convenience') return '便利商店';
  return '景點';
}

function mapBusinessStatus(value: string): 'open' | 'closed' | 'unknown' {
  if (!value) return 'unknown';
  if (value === 'OPERATIONAL') return 'open';
  if (value === 'CLOSED_TEMPORARILY' || value === 'CLOSED_PERMANENTLY') return 'closed';
  return 'unknown';
}

function estimateDistance(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRad(to.latitude - from.latitude);
  const deltaLng = toRad(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(2 * earthRadius * Math.asin(Math.sqrt(a)));
}
