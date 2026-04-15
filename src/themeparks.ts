export const THEMEPARKS_API_BASE_URL = "https://api.themeparks.wiki/v1";
const LIVE_DATA_TTL_MS = 5 * 60 * 1000;
const OTHER_DATA_TTL_MS = 60 * 60 * 1000;
export const WDW_DESTINATION_ID = "e957da41-3552-4cf6-b636-5babc5cbc4e5";

export const PARK_IDS = {
  magic: "75ea578a-adc8-4116-a54d-dccb60765ef9",
  epcot: "47f90d2c-e191-4239-a466-5892ef59a88b",
  hollywood: "288747d1-8b4f-4a64-867e-ea7c9b27bad8",
  animal: "1c84a229-8862-4648-9c71-378ddd2c7693",
  typhoon: "b070cbc5-feaa-4b87-a8c1-f94cca037a18",
  blizzard: "ead53ea5-22e5-4095-9a83-8c29300d7c63",
} as const;

export type ParkKey = keyof typeof PARK_IDS;

export interface ThemeParksClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: HeadersInit;
}

export type ThemeParksEntityType =
  | "DESTINATION"
  | "PARK"
  | "ATTRACTION"
  | "SHOW"
  | "RESTAURANT"
  | "HOTEL"
  | "OTHER";

export interface ThemeParksCoordinates {
  longitude?: number;
  latitude?: number;
}

export interface ThemeParksEntity {
  id: string;
  name: string;
  entityType?: ThemeParksEntityType | string;
  destinationId?: string;
  parentId?: string;
  timezone?: string;
  location?: ThemeParksCoordinates;
  _id?: string;
  _parentId?: string;
  _destinationId?: string;
  [key: string]: unknown;
}

export type LiveStatus =
  | "OPERATING"
  | "DOWN"
  | "CLOSED"
  | "REFURBISHMENT"
  | string;

export interface LiveStandbyQueue {
  waitTime: number | null;
}

export interface LiveReturnTimeQueue {
  state: "AVAILABLE" | "FINISHED" | string;
  returnStart: string | null;
  returnEnd: string | null;
}

export interface LivePrice {
  amount: number;
  currency: string;
  formatted: string;
}

export interface LivePaidReturnTimeQueue extends LiveReturnTimeQueue {
  price?: LivePrice;
}

export interface LiveEntityQueue {
  STANDBY?: LiveStandbyQueue;
  RETURN_TIME?: LiveReturnTimeQueue;
  PAID_RETURN_TIME?: LivePaidReturnTimeQueue;
  [key: string]: unknown;
}

export interface LiveForecastEntry {
  time: string;
  waitTime: number;
  percentage: number;
}

export interface LiveOperatingHoursEntry {
  type: string;
  startTime: string;
  endTime: string;
}

export interface LiveShowtimeEntry {
  type: string;
  startTime: string;
  endTime: string;
}

export interface LiveDiningAvailabilityEntry {
  waitTime: number;
  partySize: number;
}

export interface LiveEntity {
  id: string;
  name: string;
  entityType: ThemeParksEntityType | string;
  parkId?: string | null;
  status?: LiveStatus;
  lastUpdated?: string;
  queue?: LiveEntityQueue;
  forecast?: LiveForecastEntry[];
  operatingHours?: LiveOperatingHoursEntry[];
  showtimes?: LiveShowtimeEntry[];
  diningAvailability?: LiveDiningAvailabilityEntry[];
  [key: string]: unknown;
}

export interface LiveDataResponse {
  id: string;
  name?: string;
  liveData: LiveEntity[];
  [key: string]: unknown;
}

export type ScheduleType = "OPERATING" | "TICKETED_EVENT" | string;

export type PurchaseType = "PACKAGE" | "ATTRACTION" | string;

export interface SchedulePurchase {
  id: string;
  name: string;
  type: PurchaseType;
  price?: LivePrice;
  available?: boolean;
  [key: string]: unknown;
}

export interface ScheduleEntry {
  date: string;
  type: ScheduleType;
  openingTime: string;
  closingTime: string;
  description?: string;
  purchases?: SchedulePurchase[];
  [key: string]: unknown;
}

export interface ScheduleResponse {
  id: string;
  name?: string;
  schedule: ScheduleEntry[];
  [key: string]: unknown;
}

export class ThemeParksApiError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly body: string;

  public constructor(message: string, status: number, url: string, body: string) {
    super(message);
    this.name = "ThemeParksApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export class ThemeParksApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: HeadersInit | undefined;
  private readonly responseCache = new Map<
    string,
    { expiresAt: number; data: unknown }
  >();

  public constructor(options: ThemeParksClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? THEMEPARKS_API_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultHeaders = options.defaultHeaders;
  }

  public getEntity(uuid: string): Promise<ThemeParksEntity> {
    return this.requestJson<ThemeParksEntity>(
      `/entity/${encodeURIComponent(uuid)}`,
      OTHER_DATA_TTL_MS,
    );
  }

  public getLiveData(uuid: string): Promise<LiveDataResponse> {
    return this.requestJson<LiveDataResponse>(
      `/entity/${encodeURIComponent(uuid)}/live`,
      LIVE_DATA_TTL_MS,
    );
  }

  public getSchedule(uuid: string): Promise<ScheduleResponse> {
    return this.requestJson<ScheduleResponse>(
      `/entity/${encodeURIComponent(uuid)}/schedule`,
      OTHER_DATA_TTL_MS,
    );
  }

  private async requestJson<T>(path: string, ttlMs: number): Promise<T> {
    const now = Date.now();
    const cached = this.responseCache.get(path);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...this.defaultHeaders,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ThemeParksApiError(
        `ThemeParks API request failed with status ${response.status}`,
        response.status,
        url,
        body,
      );
    }

    const data = (await response.json()) as T;
    this.responseCache.set(path, { data, expiresAt: now + ttlMs });
    return data;
  }
}
