import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LandingSectionProps } from "./types";

/** Loaded on demand as the section scrolls into view. */
export default function FinalCtaSection({ onGetStarted }: LandingSectionProps) {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-center space-y-6">
      <div className="max-w-2xl mx-auto space-y-3">
        <h2 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
          Ready to Modernize Your Counter?
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Create your merchant account to select your product and generate your official Rwandan
          payment tent card today.
        </p>
      </div>
      <div className="pt-2">
        <Button
          size="lg"
          onClick={() => onGetStarted()}
          className="h-12 px-8 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm"
        >
          <span>Create Account / Sign In</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
