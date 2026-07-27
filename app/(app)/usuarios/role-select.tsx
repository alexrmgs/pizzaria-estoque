"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRole } from "./actions";

type Role = { id: string; name: string };

export function RoleSelect({
  userId,
  roleId,
  roles,
  disabled,
}: {
  userId: string;
  roleId: string;
  roles: Role[];
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={roleId}
      disabled={disabled || isPending}
      items={roles.map((role) => ({ value: role.id, label: role.name }))}
      onValueChange={(value) => {
        if (!value) return;
        startTransition(async () => {
          try {
            await updateUserRole(userId, value);
            toast.success("Cargo atualizado.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível atualizar.");
          }
        });
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
