/**
 * GET /api/leads
 * Query leads from MongoDB Atlas with filtering and pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const country = searchParams.get("country");
    const city = searchParams.get("city");
    const category = searchParams.get("category");
    const source = searchParams.get("source");
    const websiteStatus = searchParams.get("website_status");

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const query: any = {};

    if (country) {
      query.country = { $regex: `^${country}$`, $options: "i" };
    }
    if (city) {
      query.city = { $regex: `^${city}$`, $options: "i" };
    }
    if (category) {
      query.category = { $regex: category, $options: "i" };
    }
    if (source) {
      query.source = source;
    }
    if (websiteStatus) {
      query.website_status = websiteStatus;
    }

    const leadsCol = await getCollection("leads");
    const verifCol = await getCollection("verifications");

    const totalCount = await leadsCol.countDocuments(query);

    const leads = await leadsCol
      .find(query)
      .sort({ discovered_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Fetch latest verifications for these leads
    const placeIds = leads.map((l: any) => l.place_id).filter(Boolean);
    const websites = leads.map((l: any) => l.website).filter(Boolean);

    let verifications: any[] = [];
    if (placeIds.length > 0 || websites.length > 0) {
      verifications = await verifCol
        .find({
          $or: [
            { lead_id: { $in: placeIds } },
            { target_url: { $in: websites } },
          ],
        })
        .sort({ verified_at: -1 })
        .toArray();
    }

    // Map latest verification to each lead
    const enrichedLeads = leads.map((lead: any) => {
      const match = verifications.find(
        (v: any) => (lead.place_id && v.lead_id === lead.place_id) || (lead.website && v.target_url === lead.website)
      );
      return {
        ...lead,
        latest_verification: match || null,
      };
    });

    // Compute global performance summary stats across all verifications
    const allVerifs = await verifCol.find().limit(200).toArray();
    let totalTtfb = 0;
    let ttfbCount = 0;
    let totalDocSize = 0;
    let docSizeCount = 0;
    let httpsCount = 0;
    let mobileOkCount = 0;
    let seoOkCount = 0;
    let conversionOkCount = 0;

    for (const v of allVerifs) {
      if (v.performance?.ttfb_ms) {
        totalTtfb += v.performance.ttfb_ms;
        ttfbCount++;
      }
      if (v.performance?.document_size_kb) {
        totalDocSize += v.performance.document_size_kb;
        docSizeCount++;
      }
      if (v.availability?.https) {
        httpsCount++;
      }
      if (v.responsiveness?.responsive) {
        mobileOkCount++;
      }
      if (v.technical_seo?.title && v.technical_seo?.meta_description) {
        seoOkCount++;
      }
      if (v.conversion_ux?.has_conversion_signals) {
        conversionOkCount++;
      }
    }

    const withWebsitesCount = await leadsCol.countDocuments({ website: { $ne: null, $exists: true } });
    const verifiedCount = await leadsCol.countDocuments({ website_status: "verified" });

    const stats = {
      total_leads: totalCount,
      with_websites: withWebsitesCount,
      verified_websites: verifiedCount,
      total_verifications: allVerifs.length,
      avg_ttfb_ms: ttfbCount > 0 ? Math.round(totalTtfb / ttfbCount) : 0,
      avg_doc_size_kb: docSizeCount > 0 ? Math.round((totalDocSize / docSizeCount) * 10) / 10 : 0,
      https_percentage: allVerifs.length > 0 ? Math.round((httpsCount / allVerifs.length) * 100) : 0,
      mobile_ready_percentage: allVerifs.length > 0 ? Math.round((mobileOkCount / allVerifs.length) * 100) : 0,
      seo_ready_percentage: allVerifs.length > 0 ? Math.round((seoOkCount / allVerifs.length) * 100) : 0,
      conversion_ready_percentage: allVerifs.length > 0 ? Math.round((conversionOkCount / allVerifs.length) * 100) : 0,
    };

    return NextResponse.json({
      leads: enrichedLeads,
      stats,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch leads", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
