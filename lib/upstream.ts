// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 외부 API(업스트림) 호출 공통 유틸
// 타임아웃 + 1회 재시도 + 실패 시 상태코드 포함 에러
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

interface FetchUpstreamOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

// 업스트림(외부 API) fetch: AbortController 타임아웃 적용, !res.ok면 상태코드 포함 에러,
// 멱등 GET 요청 전제로 실패 시 1회 재시도.
export async function fetchUpstream(
  url: string,
  options: FetchUpstreamOptions = {}
): Promise<Response> {
  const { timeoutMs = 8000, retries = 1, ...init } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new UpstreamError(`Upstream fetch failed: ${res.status}`, res.status);
    }
    return res;
  } catch (e) {
    if (retries > 0) {
      return fetchUpstream(url, { ...options, retries: retries - 1 });
    }
    if (e instanceof UpstreamError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new UpstreamError(`Upstream fetch error: ${msg}`, 502);
  } finally {
    clearTimeout(timer);
  }
}
