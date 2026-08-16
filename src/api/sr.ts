/** Jellyfy SR plugin client. Unused unless the user enabled SR and set a URL. */

import * as Crypto from 'expo-crypto';

import { authorizationHeader, fetchWithRetry, type Session } from '@/api/client';
import { createApi } from '@/api/jellyfin';
import type { BaseItem, QueryResult } from '@/api/types';
import { normalizeServerUrl } from '@/lib/format';
import { normId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { getSession } from '@/store/auth';
import { useSettings } from '@/store/settings';

export const SR_SOURCE = 'jellyfy-mobile';

export type SrRecommendation = {
  trackId: string;
  score: number;
  reason: { type?: string; [key: string]: unknown };
};

export type SrRecommendationResponse = {
  requestId: string;
  modelVersion: string;
  recommendations: SrRecommendation[];
};

export type SrEventType =
  | 'PLAY_START'
  | 'PLAY_PROGRESS'
  | 'PLAY_COMPLETE'
  | 'SKIP'
  | 'PAUSE'
  | 'RESUME'
  | 'REPLAY'
  | 'FAVORITE'
  | 'UNFAVORITE';

const recByTrack = new Map<string, { requestId: string; position: number }>();
let clientSessionId: string | null = null;

export function srClientSessionId(): string {
  if (!clientSessionId) {
    try {
      clientSessionId =
        typeof Crypto.randomUUID === 'function' ? Crypto.randomUUID() : `sr-${Date.now().toString(36)}`;
    } catch {
      clientSessionId = `sr-${Date.now().toString(36)}`;
    }
  }
  return clientSessionId;
}

export function selectSrEnabled(state: { srEnabled?: boolean; srBaseUrl?: string } | null | undefined): boolean {
  return Boolean(state?.srEnabled && normalizeServerUrl(state.srBaseUrl));
}

export function isSrEnabled(): boolean {
  return selectSrEnabled(useSettings.getState());
}

export function srBaseUrl(): string {
  return normalizeServerUrl(useSettings.getState().srBaseUrl);
}

function rememberRecommendations(payload: SrRecommendationResponse) {
  payload.recommendations.forEach((item, position) => {
    recByTrack.set(item.trackId, { requestId: payload.requestId, position });
  });
}

export function recommendationRef(trackId: string): { requestId: string; position: number } | undefined {
  return recByTrack.get(trackId);
}

async function srFetch<T>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const session = getSession();
  const base = srBaseUrl();
  if (!session || !base) {
    throw new Error('Smart Recommendations is not configured');
  }
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value === undefined || value === '') continue;
    qs.set(key, String(value));
  }
  const url = `${base}${path}${qs.size ? `?${qs}` : ''}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: authorizationHeader(session),
  };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const { response } = await fetchWithRetry(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as T) : (undefined as T);
  if (!response.ok) {
    throw new Error(`SR ${response.status}`);
  }
  return parsed;
}

export async function fetchSrHome(limit: number): Promise<SrRecommendationResponse> {
  const payload = await srFetch<SrRecommendationResponse>('/api/v1/recommendations', {
    query: { limit, sessionId: srClientSessionId() },
  });
  rememberRecommendations(payload);
  return payload;
}

export async function fetchSrRadio(kind: 'track' | 'artist' | 'album', id: string, limit = 40): Promise<SrRecommendationResponse> {
  const path =
    kind === 'artist'
      ? `/api/v1/radio/artists/${encodeURIComponent(id)}`
      : kind === 'album'
        ? `/api/v1/radio/albums/${encodeURIComponent(id)}`
        : `/api/v1/radio/tracks/${encodeURIComponent(id)}`;
  const payload = await srFetch<SrRecommendationResponse>(path, {
    query: { limit, sessionId: srClientSessionId() },
  });
  rememberRecommendations(payload);
  return payload;
}

export async function fetchSrNext(currentTrackId: string, limit = 20): Promise<SrRecommendationResponse> {
  const payload = await srFetch<SrRecommendationResponse>('/api/v1/recommendations/next', {
    method: 'POST',
    body: {
      sessionId: srClientSessionId(),
      currentTrackId,
      limit,
    },
  });
  rememberRecommendations(payload);
  return payload;
}

export async function hydrateSrTracks(session: Session, payload: SrRecommendationResponse): Promise<BaseItem[]> {
  const ids = payload.recommendations.map((item) => item.trackId).filter(Boolean);
  if (!ids.length) return [];
  const api = createApi(session);
  const result: QueryResult = await api.items({
    ids,
    includeItemTypes: ['Audio'],
    limit: ids.length,
  });
  const byId = new Map((result.items ?? []).map((item) => [normId(item.id), item]));
  return ids.map((id) => byId.get(normId(id))).filter((item): item is BaseItem => Boolean(item));
}

export async function postSrEvent(input: {
  eventType: SrEventType;
  trackId: string;
  positionMs?: number;
  durationMs?: number;
  userId: string;
}): Promise<void> {
  if (!isSrEnabled()) return;
  const rec = recommendationRef(input.trackId);
  await srFetch('/api/v1/events', {
    method: 'POST',
    body: {
      eventId: typeof Crypto.randomUUID === 'function' ? Crypto.randomUUID() : `evt-${Date.now()}`,
      eventType: input.eventType,
      occurredAt: new Date().toISOString(),
      userId: input.userId,
      sessionId: srClientSessionId(),
      trackId: input.trackId,
      source: SR_SOURCE,
      positionMs: input.positionMs !== undefined ? Math.round(input.positionMs) : undefined,
      durationMs: input.durationMs !== undefined ? Math.round(input.durationMs) : undefined,
      recommendation: rec ? { requestId: rec.requestId, position: rec.position } : undefined,
    },
  });
}

export function postSrEventSafe(input: {
  eventType: SrEventType;
  trackId: string;
  positionMs?: number;
  durationMs?: number;
}): void {
  const session = getSession();
  if (!session || !isSrEnabled()) return;
  void postSrEvent({ ...input, userId: session.userId }).catch((err) => {
    // Plugin must not break playback, but a swallowed 400 hid missing SKIP.
    logger.warn('SR event failed', { eventType: input.eventType, trackId: input.trackId, error: err });
  });
}
