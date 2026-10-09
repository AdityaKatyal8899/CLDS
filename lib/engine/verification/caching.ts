import { CachingResult } from "./models";

export class CachingChecker {
  check(headers: Record<string, string>): CachingResult {
    const result: CachingResult = {
      cache_control: null,
      etag: false,
      etag_value: null,
      last_modified: false,
      last_modified_value: null,
      expires: false,
      expires_value: null,
      has_caching_signals: false,
      error: null,
    };

    try {
      // Cache-Control
      const cacheCtrl = headers["cache-control"];
      if (cacheCtrl) {
        result.cache_control = cacheCtrl.trim();
      }

      // ETag
      const etag = headers["etag"];
      if (etag) {
        result.etag = true;
        result.etag_value = etag.trim();
      }

      // Last-Modified
      const lastMod = headers["last-modified"];
      if (lastMod) {
        result.last_modified = true;
        result.last_modified_value = lastMod.trim();
      }

      // Expires
      const expires = headers["expires"];
      if (expires) {
        result.expires = true;
        result.expires_value = expires.trim();
      }

      result.has_caching_signals = Boolean(
        result.cache_control || result.etag || result.last_modified || result.expires
      );
    } catch (err: any) {
      result.error = `Caching check error: ${err.message || err}`;
    }

    return result;
  }
}
