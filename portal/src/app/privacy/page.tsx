import { Activity, Shield, Eye, Lock, Trash2, MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto flex h-14 items-center px-4 gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold">Privacy &amp; Security</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <section className="space-y-3">
          <h1 className="text-3xl font-bold">How We Protect Your Health Data</h1>
          <p className="text-lg text-muted-foreground">
            Alberta Health Portal is designed with privacy as its foundation.
            Your health information is protected under Alberta&apos;s Health
            Information Act (HIA) and the Personal Information Protection Act (PIPA).
          </p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="border rounded-xl p-5 space-y-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Passthrough Architecture</h3>
            <p className="text-sm text-muted-foreground">
              We never store your health data. When you ask a question, we fetch
              the answer from My Health Records or AHS MyChart in real time and
              display it. Nothing is cached or saved.
            </p>
          </div>

          <div className="border rounded-xl p-5 space-y-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Encrypted Sessions</h3>
            <p className="text-sm text-muted-foreground">
              Your health session token is encrypted with AES-256-GCM and exists
              only while you&apos;re active. It&apos;s automatically destroyed
              after ~10 minutes of inactivity.
            </p>
          </div>

          <div className="border rounded-xl p-5 space-y-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">No Credential Storage</h3>
            <p className="text-sm text-muted-foreground">
              Your MyAlberta Digital ID credentials are used once to establish a
              session, then immediately discarded. We never store, log, or
              transmit your username or password.
            </p>
          </div>

          <div className="border rounded-xl p-5 space-y-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Canadian Data Residency</h3>
            <p className="text-sm text-muted-foreground">
              All infrastructure runs in Azure Canada Central. Your data never
              leaves Canadian borders. If you bring your own AI API key from a
              non-Canadian provider, we&apos;ll warn you before sending data.
            </p>
          </div>
        </section>

        <section className="border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">What We Access</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              <p><strong>Read-only health data</strong> — Lab results, medications, immunizations, vitals, imaging reports, referrals, visit history</p>
            </div>
            <div className="flex gap-3">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              <p><strong>Session tokens</strong> — Temporary, encrypted, auto-expiring credentials for the health portals</p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-600 font-bold shrink-0">✗</span>
              <p><strong>No write access</strong> — We cannot modify, delete, or create any records in your health account</p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-600 font-bold shrink-0">✗</span>
              <p><strong>No data retention</strong> — Health data is never stored on our servers or in databases</p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-600 font-bold shrink-0">✗</span>
              <p><strong>No sharing</strong> — Your health data is never shared with third parties, advertisers, or analytics</p>
            </div>
          </div>
        </section>

        <section className="border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">BYOK (Bring Your Own Key) Privacy</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              When you use your own AI provider API key, your health data is sent
              to that provider for processing. We clearly indicate which provider
              will receive your data:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Canadian providers</strong> (Azure Canada, Cohere Canada) — Data stays in Canada</li>
              <li><strong>US/Global providers</strong> (OpenAI, Anthropic, Google) — Data may be processed outside Canada; we display a warning</li>
              <li><strong>Self-hosted</strong> (Ollama, LocalAI) — Data stays on your own infrastructure</li>
            </ul>
            <p>
              Your API keys are encrypted with AES-256-GCM before storage and
              are never logged or visible after initial entry.
            </p>
          </div>
        </section>

        <section className="text-center text-sm text-muted-foreground py-4">
          <p>
            Questions about our privacy practices?{" "}
            <a href="mailto:privacy@abhealth.example.com" className="text-primary hover:underline">
              Contact us
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
