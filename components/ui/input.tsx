import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

// Border, focus, invalid and disabled look shared by every form control
// (input, textarea, select), so they all look the same when focused.
// Focus only colors the border: a ring on top of it looks twice as thick.
// `npx shadcn add` may offer to overwrite these files: answer no, or this is lost.
export const controlClassName =
  "rounded-lg border border-input bg-transparent transition-colors outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30 dark:aria-invalid:border-destructive/50";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        controlClassName,
        "h-8 w-full min-w-0 px-2.5 py-1 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:bg-input/50 md:text-sm dark:disabled:bg-input/80",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
