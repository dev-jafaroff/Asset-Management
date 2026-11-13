import * as React from "react";
import { cn } from "cn";
import { controlClassName } from "@/components/ui/input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        controlClassName,
        "flex field-sizing-content min-h-16 w-full px-2.5 py-2 text-base placeholder:text-muted-foreground disabled:bg-input/50 md:text-sm dark:disabled:bg-input/80",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
