import Link from "next/link";
import { BrandLogo, BrandName } from "@/components/ui/brand";
import { LegacyHistoryCleanup } from "@/components/chat/legacy-history-cleanup";

export function PortalUnavailable() {
  return <main id="main-content" className="max-w-2xl mx-auto px-4 py-10 space-y-8">
    <div className="flex items-center gap-3"><BrandLogo /><BrandName /></div>
    <section className="space-y-3">
      <h1 className="text-3xl font-bold">Web chat is unavailable</h1>
      <p className="text-muted-foreground">
        Web sign-in, health connections and chat are turned off. The desktop add-on
        is a separate option. Claude Desktop manages its own conversations and
        provider processing; this page does not change that history.
      </p>
      <div className="flex flex-wrap gap-4">
        <a href="https://myaihealth.ca/" className="text-primary underline rounded focus-visible:ring-2 focus-visible:ring-ring">Get the desktop add-on</a>
        <Link href="/privacy" className="text-primary underline rounded focus-visible:ring-2 focus-visible:ring-ring">Read the privacy details</Link>
      </div>
    </section>
    <LegacyHistoryCleanup />
  </main>;
}
