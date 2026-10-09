/**
 * GET /api/leads/:id/verifications
 * Retrieve full historical verification records for a lead (1-to-many relationship).
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

    const leadId = lead ? lead.place_id : id;
    const targetUrl = lead ? lead.website : id;

    const verifications = await verifCol
      .find({
        $or: [{ lead_id: leadId }, { target_url: targetUrl }],
      })
      .sort({ verified_at: -1 })
      .toArray();

    return NextResponse.json({
      lead_id: leadId,
      verifications,
      count: verifications.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch verification history", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
