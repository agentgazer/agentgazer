"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-400 transition-colors hover:text-white"
    >
      Sign out
    </button>
  );
}
