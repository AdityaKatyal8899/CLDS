import crypto from "crypto";
import { getCollection } from "../mongodb/client";
import {
  BusinessLead,
  normalizeWebsite,
  normalizePhone,
  normalizeNameAddress,
} from "./models";
import { VerificationRecord } from "./verification/models";

export class EngineDatabase {
  private ensurePlaceId(lead: BusinessLead, nameAddr: string): string {
    if (lead.place_id && lead.place_id.trim()) {
      return lead.place_id.trim();
    }
    const seed = `${lead.country}|${nameAddr}`;
    const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16);
    return `${lead.source || "lead"}_${hash}`;
  }

  async saveLead(lead: BusinessLead): Promise<{ isNew: boolean; action: string }> {
    const leadsCol = await getCollection("leads");
    const normWeb = normalizeWebsite(lead.website);
    const normPh = normalizePhone(lead.phone);
    const nameAddr = normalizeNameAddress(lead.business_name, lead.address);
    const effectivePlaceId = this.ensurePlaceId(lead, nameAddr);
    const nowIso = new Date().toISOString();

    const docUpdate: any = {
      business_name: lead.business_name,
      category: lead.category,
      country: lead.country,
      state: lead.state || null,
      city: lead.city,
      address: lead.address || null,
      website: lead.website || null,
      website_status: lead.website_status,
      source: lead.source,
      source_url: lead.source_url || null,
      maps_url: lead.maps_url || null,
      phone: lead.phone || null,
      rating: lead.rating ?? null,
      review_count: lead.review_count ?? null,
      latitude: lead.latitude ?? null,
      longitude: lead.longitude ?? null,
      normalized_website: normWeb || null,
      normalized_phone: normPh || null,
      name_address_key: nameAddr || null,
      updated_at: nowIso,
    };

    // Priority 1: Match by exact place_id
    const existingLead = await leadsCol.findOne({ place_id: effectivePlaceId });
    if (existingLead) {
      await leadsCol.updateOne({ place_id: effectivePlaceId }, { $set: docUpdate });
      return { isNew: false, action: "updated" };
    }

    // Priority 2: Match by name + physical address
    if (nameAddr) {
      const existingNameMatch = await leadsCol.findOne({ name_address_key: nameAddr });
      if (existingNameMatch) {
        await leadsCol.updateOne({ _id: existingNameMatch._id }, { $set: docUpdate });
        return { isNew: false, action: "updated" };
      }
    }

    // Priority 3: Match by normalized website if no address
    if (normWeb && !lead.address) {
      const existingWebMatch = await leadsCol.findOne({ normalized_website: normWeb });
      if (existingWebMatch) {
        await leadsCol.updateOne({ _id: existingWebMatch._id }, { $set: docUpdate });
        return { isNew: false, action: "updated" };
      }
    }

    // Brand new lead insertion
    const insertDoc = {
      place_id: effectivePlaceId,
      discovered_at: lead.discovered_at || nowIso,
      ...docUpdate,
    };
    await leadsCol.insertOne(insertDoc);
    return { isNew: true, action: "inserted" };
  }

  async saveLeads(leads: BusinessLead[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;
    for (const lead of leads) {
      const { isNew } = await this.saveLead(lead);
      if (isNew) inserted++;
      else updated++;
    }
    return { inserted, updated };
  }

  async saveVerification(record: VerificationRecord): Promise<void> {
    const verificationsCol = await getCollection("verifications");
    await verificationsCol.insertOne(record as any);

    // If verified with reachable status and lead_id is provided, optionally link or update
    if (record.lead_id) {
      const leadsCol = await getCollection("leads");
      await leadsCol.updateOne(
        { place_id: record.lead_id },
        {
          $set: {
            last_verified_at: record.verified_at,
            verification_status: record.overall_status,
          },
        }
      );
    }
  }
}
