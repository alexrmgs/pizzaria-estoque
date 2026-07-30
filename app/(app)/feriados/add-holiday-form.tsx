"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addHoliday } from "./actions";

export function AddHolidayForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addHoliday(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Feriado cadastrado.");
        (document.getElementById("add-holiday-form") as HTMLFormElement | null)?.reset();
      }
    });
  }

  return (
    <form id="add-holiday-form" action={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="holiday-date" className="text-xs">
          Data
        </Label>
        <Input id="holiday-date" name="date" type="date" required className="h-9" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor="holiday-name" className="text-xs">
          Nome
        </Label>
        <Input
          id="holiday-name"
          name="name"
          placeholder="Ex: Independência do Brasil"
          required
          className="h-9"
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Salvando..." : "Cadastrar"}
      </Button>
    </form>
  );
}
