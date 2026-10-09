/**
 * Native TypeScript Job Executor for Serverless (Vercel) and Local Execution.
 * Runs Stage 1 Discovery & Stage 2 Fast Verification 100% in Node.js.
 */

import { JobRepository } from "@/lib/jobs/repository";
import { SearchCriteria } from "./models";
import { LeadDiscoveryService } from "./search";
import { WebsiteVerificationRunner } from "./verification/runner";
import { EngineDatabase } from "./database";
import { getCollection } from "@/lib/mongodb/client";

export class EngineJobExecutor {
  static async executeSearchJob(jobId: string, criteria: SearchCriteria): Promise<void> {
    try {
      await JobRepository.setJobRunning(jobId, process.pid);
      await JobRepository.appendJobLog(
        jobId,
        `[INFO] Starting Discovery for category: "${criteria.category}", location: "${criteria.city || criteria.country}" (Provider: ${criteria.provider || "auto"})...`
      );

      await JobRepository.updateJobProgress(jobId, 20, "[INFO] Querying discovery providers...");

      const discoveryService = new LeadDiscoveryService();
      const { summary, leads } = await discoveryService.executeSearch(criteria);

      await JobRepository.updateJobProgress(
        jobId,
        80,
        `[INFO] Discovered ${leads.length} leads (${summary.websites_found} with website, ${summary.no_website_found} without website).`
      );

      await JobRepository.completeJob(
        jobId,
        summary as any,
        `[SUCCESS] Discovery complete. ${summary.unique_discovered} leads stored/updated in database.`
      );
    } catch (err: any) {
      console.error(`[EngineJobExecutor] Search Job ${jobId} failed:`, err);
      await JobRepository.failJob(jobId, err.message || String(err));
    }
  }

  static async executeVerifyJob(
    jobId: string,
    options: { url?: string; lead_id?: string; limit?: number }
  ): Promise<void> {
    try {
      await JobRepository.setJobRunning(jobId, process.pid);
      const runner = new WebsiteVerificationRunner();
      const db = new EngineDatabase();

      if (options.url) {
        await JobRepository.appendJobLog(
          jobId,
          `[INFO] Running 7-point verification for target URL: ${options.url}`
        );
        await JobRepository.updateJobProgress(jobId, 30, "[INFO] Checking DNS & HTTP Availability...");

        const record = await runner.verify(options.url, options.lead_id);
        await db.saveVerification(record);

        await JobRepository.updateJobProgress(jobId, 90, `[INFO] Verification status: ${record.overall_status}`);
        await JobRepository.completeJob(
          jobId,
          record as any,
          `[SUCCESS] Verified ${options.url} in ${record.verification_duration_ms}ms (Status: ${record.overall_status}).`
        );
        return;
      }

      // Batch verification mode
      const leadsCol = await getCollection("leads");
      const query: any = { website: { $ne: null, $exists: true } };
      if (options.lead_id) {
        query.place_id = options.lead_id;
      }

      const leads = await leadsCol
        .find(query)
        .limit(options.limit || 20)
        .toArray();

      if (leads.length === 0) {
        await JobRepository.completeJob(
          jobId,
          { total: 0, verified: 0 },
          "[INFO] No unverified leads with websites found to verify."
        );
        return;
      }

      await JobRepository.appendJobLog(
        jobId,
        `[INFO] Starting batch verification for ${leads.length} businesses...`
      );

      const results = [];
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        const progress = Math.round(((i + 1) / leads.length) * 100);
        await JobRepository.updateJobProgress(
          jobId,
          progress,
          `[INFO] Verifying [${i + 1}/${leads.length}] ${lead.business_name} (${lead.website})...`
        );

        try {
          const record = await runner.verify(lead.website, lead.place_id);
          await db.saveVerification(record);
          results.push(record);
        } catch (err: any) {
          await JobRepository.appendJobLog(
            jobId,
            `[WARN] Verification failed for ${lead.business_name}: ${err.message || err}`
          );
        }
      }

      await JobRepository.completeJob(
        jobId,
        { total: leads.length, verified: results.length, results } as any,
        `[SUCCESS] Batch verification complete. ${results.length} websites verified.`
      );
    } catch (err: any) {
      console.error(`[EngineJobExecutor] Verify Job ${jobId} failed:`, err);
      await JobRepository.failJob(jobId, err.message || String(err));
    }
  }
}
