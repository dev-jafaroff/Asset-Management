"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPIED_FEEDBACK_MS = 1500;

type CopyButtonProps = {
  value: string;
  // What is copied, for screen readers, e.g. "serial".
  label: string;
  className?: string;
};

// Copies a value (serial, IMEI, tag) to the clipboard; a check mark confirms it.
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [isCopied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
    } catch {
      // Clipboard blocked (e.g. no permission): the value can still be selected by hand.
    }
  }

  const Icon = isCopied ? Check : Copy;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={copy}
      aria-label={isCopied ? `Copied ${label}` : `Copy ${label}`}
      title={isCopied ? "Copied" : `Copy ${label}`}
      className={cn("text-muted-foreground", className)}
    >
      <Icon aria-hidden className={cn(isCopied && "text-emerald-600")} />
    </Button>
  );
}
