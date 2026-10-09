/**
 * /api/auth
 * Authentication handler querying credentials directly from MongoDB Atlas users collection.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth/users";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, password } = body;

    if (action === "login") {
      const loginInput = email || "";
      const passwordInput = password || "";

      if (!loginInput || !passwordInput) {
        return NextResponse.json(
          { error: "Email/Username and Password are required." },
          { status: 400 }
        );
      }

      // Verify credentials directly in MongoDB Atlas DB
      const userDoc = await authenticateUser(loginInput, passwordInput);

      if (userDoc) {
        const user = {
          email: userDoc.email,
          username: userDoc.username,
          name: userDoc.name,
          role: userDoc.role,
          workspace: userDoc.workspace,
        };

        const response = NextResponse.json({
          success: true,
          user,
          message: "Authentication successful (Verified via MongoDB Atlas)",
        });

        // Set secure HTTP-only session cookie
        response.cookies.set("clds_session", JSON.stringify(user), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: "/",
        });

        return response;
      }

      return NextResponse.json(
        { error: "Invalid email or password. Please check your credentials." },
        { status: 401 }
      );
    }

    if (action === "logout") {
      const response = NextResponse.json({ success: true, message: "Logged out successfully" });
      response.cookies.delete("clds_session");
      return response;
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Authentication error", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get("clds_session");
    if (!cookie?.value) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    try {
      const user = JSON.parse(cookie.value);
      return NextResponse.json({ authenticated: true, user });
    } catch {
      return NextResponse.json({ authenticated: false, user: null });
    }
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
}
