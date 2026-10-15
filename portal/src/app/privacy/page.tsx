import { Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LegacyHistoryCleanup } from "@/components/chat/legacy-history-cleanup";

const linkStyle = "text-primary underline rounded focus-visible:ring-2 focus-visible:ring-ring";

export default function PrivacyPage() {
  return <div className="min-h-screen bg-background">
    <header className="border-b">
      <div className="max-w-4xl mx-auto flex h-14 items-center px-4 gap-4">
        <Link href="/" className={`flex items-center gap-2 ${linkStyle}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back
        </Link>
        <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="font-semibold">Privacy &amp; Security</span>
      </div>
    </header>
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">How your information is handled</h1>
        <p className="text-lg text-muted-foreground">
          Web chat is unavailable. The desktop add-on, website and AI provider are
          different services with different storage and processing.
        </p>
      </section>
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="text-xl font-semibold">Desktop add-on and Claude</h2>
        <p>
          The add-on reads records from Alberta&apos;s health portals on your computer
          and returns them to your MCP app, such as Claude Desktop. That app and its AI
          provider receive the records used in your conversation. Anthropic processes
          Claude conversations on US-based servers.
        </p>
        <p>
          Claude manages its own chat history and retention. This project does not
          delete or change Claude&apos;s history. See{" "}
          <a href="https://privacy.anthropic.com/" className={linkStyle}>Anthropic&apos;s privacy information</a>{" "}
          and your account settings for the terms that apply.
        </p>
        <p>
          The add-on saves encrypted sign-in cookies and uses a dedicated browser
          profile to make reconnecting easier. Ordinary disconnect removes the saved
          MCP session, but the dedicated browser may remember your Alberta sign-in.
          Local encryption does not protect you from someone using the same OS account.
          The add-on is read-only; it cannot change your Alberta records.
        </p>
      </section>
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="text-xl font-semibold">Web chat remains turned off</h2>
        <p>
          The experimental portal does not accept sign-ins, health connections, API keys
          or chat requests while disabled. New portal chat history is designed to stay
          in page memory only, not localStorage or sessionStorage. It is cleared on
          sign-out, account changes, session loss, refresh, or leaving the tab.
        </p>
        <p>
          This is not a promise that all copies disappear. An AI provider would receive
          the questions and records needed to answer them if chat were later enabled.
          Provider retention, abuse monitoring, account settings and legal obligations
          would still apply. Portal activation requires a separate review.
        </p>
        <p>
          The proposed beta model uses Azure AI Foundry in Canada East. This is not a
          claim that all processing stays in Canada. See{" "}
          <a href="https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy" className={linkStyle}>
            Microsoft&apos;s model data and privacy terms
          </a>{" "}
          for configuration-dependent handling and retention.
        </p>
      </section>
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="text-xl font-semibold">Website, downloads and operational records</h2>
        <p>
          The public website&apos;s Azure Static Web App is currently in Central US.
          The download storage and separate MCP server are in Canada Central.
          Canadian hosting alone is not legal certification or a guarantee about every
          service provider.
        </p>
        <p>
          Downloads do not require a name, email address or reason. Earlier access
          requests, notification emails and operational records may still exist.
          Their removal needs a separately approved retention and cleanup process.
        </p>
        <p>
          Hosting and network providers can process IP addresses, request times and
          other operational metadata. Portal application telemetry is off while the
          portal is disabled. Any later opt-in technical events allow only fixed
          categories and numeric counters, not chats or user identifiers. A hashed
          identifier would be pseudonymous, not anonymous.
        </p>
      </section>
      <LegacyHistoryCleanup />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Questions or concerns</h2>
        <p>
          Contact <a href="mailto:support@myaihealth.ca" className={linkStyle}>support@myaihealth.ca</a>{" "}
          about information we may hold or a privacy concern. Do not email health
          records or passwords. You can also contact Alberta&apos;s{" "}
          <a href="https://oipc.ab.ca/" className={linkStyle}>privacy commissioner</a>.
          This page describes the service; it does not certify legal compliance.
        </p>
      </section>
    </main>
  </div>;
}
