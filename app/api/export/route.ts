/**
 * GET /api/export
 * Export discovered leads and their verification records from MongoDB Atlas.
 * Supports weekly, monthly, or full database dumps in formatted JSON or CSV.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "all"; // 'week' | 'month' | 'all'
    const format = searchParams.get("format") || "json"; // 'json' | 'csv'
    const includeVerifications = searchParams.get("include_verifications") !== "false";

    const leadsCol = await getCollection("leads");
    const verifCol = await getCollection("verifications");

    const query: any = {};

    const now = new Date();
    if (range === "week" || range === "7days") {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query.discovered_at = { $gte: pastWeek.toISOString() };
    } else if (range === "month" || range === "30days") {
      const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.discovered_at = { $gte: pastMonth.toISOString() };
    }

    const leads = await leadsCol
      .find(query)
      .sort({ discovered_at: -1 })
      .toArray();

    // Enrich leads with verification records if requested
    let exportData = leads;
    if (includeVerifications && leads.length > 0) {
      const placeIds = leads.map((l) => l.place_id).filter(Boolean);
      const websites = leads.map((l) => l.website).filter(Boolean);

      const verifications = await verifCol
        .find({
          $or: [{ lead_id: { $in: placeIds } }, { target_url: { $in: websites } }],
        })
        .sort({ verified_at: -1 })
        .toArray();

      const verifMap = new Map<string, any>();
      for (const v of verifications) {
        if (v.lead_id && !verifMap.has(v.lead_id)) {
          verifMap.set(v.lead_id, v);
        }
        if (v.target_url && !verifMap.has(v.target_url)) {
          verifMap.set(v.target_url, v);
        }
      }

      exportData = leads.map((lead) => {
        const verif = verifMap.get(lead.place_id) || verifMap.get(lead.website) || null;
        return {
          ...lead,
          latest_verification: verif,
        };
      });
    }

    const dateStr = now.toISOString().slice(0, 10);
    const filename = `clds_leads_${range}_${dateStr}.${format}`;

    if (format === "csv") {
      // Build CSV output
      const headers = [
        "place_id",
        "business_name",
        "category",
        "country",
        "state",
        "city",
        "address",
        "website",
        "website_status",
        "phone",
        "rating",
        "review_count",
        "source",
        "discovered_at",
        "verification_status",
      ];

      const csvRows = [headers.join(",")];

      for (const item of exportData) {
        const row = [
          JSON.stringify(item.place_id || ""),
          JSON.stringify(item.business_name || ""),
          JSON.stringify(item.category || ""),
          JSON.stringify(item.country || ""),
          JSON.stringify(item.state || ""),
          JSON.stringify(item.city || ""),
          JSON.stringify(item.address || ""),
          JSON.stringify(item.website || ""),
          JSON.stringify(item.website_status || ""),
          JSON.stringify(item.phone || ""),
          JSON.stringify(item.rating || ""),
          JSON.stringify(item.review_count || ""),
          JSON.stringify(item.source || ""),
          JSON.stringify(item.discovered_at || ""),
          JSON.stringify(item.latest_verification?.verification_status || item.website_status || ""),
        ];
        csvRows.push(row.join(","));
      }

      const csvString = csvRows.join("\n");

      return new NextResponse(csvString, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON Format Output with detailed metadata wrap
    const jsonOutput = {
      export_metadata: {
        system: "CLDS - Client Lead Discovery System",
        exported_at: now.toISOString(),
        timeframe: range,
        total_records: exportData.length,
        with_websites: exportData.filter((l) => Boolean(l.website)).length,
        verified_count: exportData.filter((l) => l.website_status === "verified").length,
      },
      leads: exportData,
    };

    return new NextResponse(JSON.stringify(jsonOutput, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate export", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
