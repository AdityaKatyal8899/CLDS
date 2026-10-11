/**
 * /api/auth
 * Authentication handler supporting both:
 * 1. Administrator credentials in MongoDB Atlas
 * 2. 3-Search Free Public Trial accounts for Peerlist visitors
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  handleTrialLogin,
  getTrialStatus,
  UserSessionData,
} from "@/lib/auth/users";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, password } = body;

    // 1. Peerlist / Public 3-Free-Search Trial Login
    if (action === "trial_login") {
      const cleanEmail = (email || "").trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@") || cleanEmail.length < 5) {
        return NextResponse.json(
          { error: "Please enter a valid email address to start your 3 free searches." },
          { status: 400 }
        );
      }

      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";

      const trialUser = await handleTrialLogin(cleanEmail, ip);

      const response = NextResponse.json({
        success: true,
        user: trialUser,
        message: `Welcome! You have ${trialUser.searches_remaining} of 3 free searches remaining.`,
      });

      // Set session cookie for 14 days
      response.cookies.set("clds_session", JSON.stringify(trialUser), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 14,
        path: "/",
      });

      return response;
    }

    // 2. Administrator Password Login
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
        const user: UserSessionData = {
          email: userDoc.email,
          username: userDoc.username,
          name: userDoc.name,
          role: userDoc.role,
          workspace: userDoc.workspace,
          is_trial: false,
          searches_limit: 999999,
          searches_used: 0,
          searches_remaining: 999999,
        };

        const response = NextResponse.json({
          success: true,
          user,
          message: "Authentication successful",
        });

        // Set secure session cookie for 30 days
        response.cookies.set("clds_session", JSON.stringify(user), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        });

        return response;
      }

      return NextResponse.json(
        { error: "Invalid email or password. Please check your credentials." },
        { status: 401 }
      );
    }

    // 3. Logout
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
      const user: UserSessionData = JSON.parse(cookie.value);

      // If trial user, refresh dynamic usage numbers from MongoDB Atlas
      if (user.is_trial && user.email) {
        const status = await getTrialStatus(user.email);
        user.searches_used = status.used;
        user.searches_remaining = status.remaining;
        user.searches_limit = status.limit;
      }

      return NextResponse.json({ authenticated: true, user });
    } catch {
      return NextResponse.json({ authenticated: false, user: null });
    }
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
}
