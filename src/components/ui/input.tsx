import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-base shadow-sm transition-all duration-200 outline-none",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
