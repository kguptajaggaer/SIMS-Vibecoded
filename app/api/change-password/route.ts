import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await req.json();

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, password_hash")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: updateErr } = await supabase
      .from("users")
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
