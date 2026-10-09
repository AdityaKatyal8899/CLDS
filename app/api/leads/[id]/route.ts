/**
 * GET /api/leads/:id
 * Retrieve a single lead by place_id or _id, including its latest verification record.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const leadsCol = await getCollection("leads");
    const verifCol = await getCollection("verifications");

    const query: any = {
      $or: [{ place_id: id }],
    };

    if (ObjectId.isValid(id)) {
      query.$or.push({ _id: new ObjectId(id) });
    }

    const lead = await leadsCol.findOne(query);

    if (!lead) {
      return NextResponse.json(
        { error: `Lead with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Retrieve latest verification record
    const latestVerification = await verifCol.findOne(
      { $or: [{ lead_id: lead.place_id }, { target_url: lead.website }] },
      { sort: { verified_at: -1 } }
    );

    return NextResponse.json({
      lead,
      latest_verification: latestVerification || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch lead", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
