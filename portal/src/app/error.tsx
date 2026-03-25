"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="text-4xl">😕</div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
          <Link href="/chat">
            <Button>Back to Chat</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
