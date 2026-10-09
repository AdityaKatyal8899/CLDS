import dns from "dns/promises";
import { AvailabilityResult } from "./models";

export interface AvailabilityResponse {
  result: AvailabilityResult;
  htmlContent: string;
  headers: Record<string, string>;
  status: number;
}

export class AvailabilityChecker {
  private timeoutMs: number;
  private userAgent: string;

  constructor(timeoutSec: number = 10.0) {
    this.timeoutMs = timeoutSec * 1000;
    this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CLDS-Verifier/2.0";
  }

  async check(url: string): Promise<AvailabilityResponse> {
    const result: AvailabilityResult = {
      reachable: false,
      status_code: null,
      dns_resolved: false,
      https: false,
      response_time_ms: null,
      redirect_chain: [],
      final_url: null,
      error: null,
    };

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }

    // 1. DNS Resolution Check
    try {
      const parsed = new URL(cleanUrl);
      const host = parsed.hostname;
      await dns.lookup(host);
      result.dns_resolved = true;
    } catch (err: any) {
      result.dns_resolved = false;
      result.error = `DNS resolution failed: ${err.message || err}`;
      return { result, htmlContent: "", headers: {}, status: 0 };
    }

    // 2. Fetch Connectivity & Timing
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(cleanUrl, {
        method: "GET",
        headers: {
          "User-Agent": this.userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timer);
      const durationMs = Math.round(performance.now() - startTime);

      result.reachable = true;
      result.status_code = response.status;
      result.final_url = response.url || cleanUrl;
      result.https = (response.url || cleanUrl).startsWith("https://");
      result.response_time_ms = durationMs;

      // Extract headers as lowercase record
      const headersRecord: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersRecord[key.toLowerCase()] = value;
      });

      let htmlContent = "";
      try {
        htmlContent = await response.text();
      } catch (err: any) {
        htmlContent = "";
      }

      return {
        result,
        htmlContent,
        headers: headersRecord,
        status: response.status,
      };
    } catch (err: any) {
      result.reachable = false;
      if (err.name === "AbortError") {
        result.error = "Connection timed out";
      } else {
        result.error = `HTTP request failed: ${err.message || err}`;
      }
      return { result, htmlContent: "", headers: {}, status: 0 };
    }
  }
}
