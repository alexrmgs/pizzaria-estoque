"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-foreground"
      onClick={() => signOut({ redirectTo: "/login" })}
    >
      Sair
    </Button>
  );
}
