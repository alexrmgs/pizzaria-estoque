"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AiAnalysisPanel({
  action,
  title = "Análise com IA",
}: {
  action: () => Promise<{ text?: string; error?: string }>;
  title?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setText(result.text ?? "");
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-lg">🤖 {title}</CardTitle>
        <Button size="sm" onClick={run} disabled={isPending}>
          {isPending ? "Analisando…" : "Analisar com IA"}
        </Button>
      </CardHeader>
      {text !== null && (
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{text}</div>
        </CardContent>
      )}
    </Card>
  );
}
