import { Activity, Shield, Eye, Lock, Trash2, MapPin, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      <header className="border-b">
        <div className="max-w-4xl mx-auto flex h-14 items-center px-4 gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-semibold">Privacy &amp; Security</span>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Quick answer */}
        <section className="space-y-3">
          <h1 className="text-3xl font-bold">How We Handle Your Health Data</h1>
          <p className="text-lg text-muted-foreground">
            We don&apos;t keep your health data. Everything we process stays in Canada.
            Your health information is only used to answer your question — then it&apos;s gone.
          </p>
        </section>

        {/* Two paths callout */}
        <section className="border rounded-xl p-5 bg-muted/30 space-y-3">
          <h2 className="font-semibold text-lg">Two ways to use MyAI Health</h2>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-background p-4 space-y-1">
              <p className="font-semibold">📦 Claude Desktop add-on</p>
              <p className="text-muted-foreground">
                Runs on your own computer. Your health data goes straight from your machine
                to Alberta Health — our servers never see it. The AI (Claude by Anthropic)
                runs on US-based servers.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4 space-y-1">
              <p className="font-semibold">🌐 Web portal (beta — this app)</p>
              <p className="text-muted-foreground">
                Runs in your browser. Your health data briefly passes through our
                Canadian server to reach the AI. All processing happens in Canada.
                Nothing is saved after you close the app.
              </p>
            </div>
          </div>
        </section>

        {/* What we do with your data */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-xl font-semibold">What we do with your data (portal)</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              When you ask a question, we fetch the right health records from Alberta&apos;s
              My Health Records or AHS MyChart on your behalf. We pass those records — along
              with your question — to the AI to get you an answer. That&apos;s it.
            </p>
            <p>
              We don&apos;t read your records ourselves. We don&apos;t analyse or score them.
              The data is used only to answer your question in that moment.
            </p>
          </div>
        </section>

        {/* Where it goes */}
        <section className="border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-xl font-semibold">Where your data goes</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <span className="text-green-600 font-bold shrink-0 mt-0.5">🇨🇦</span>
              <p>
                <strong>Our server</strong> — Microsoft Azure, Canada Central region.
                Fetches your health data from Alberta Health on your behalf.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-green-600 font-bold shrink-0 mt-0.5">🇨🇦</span>
              <p>
                <strong>AI (Azure OpenAI, Canada East)</strong> — Microsoft-hosted AI service
                located in Canada. Reads your records to answer your question.
                Microsoft does not use your data to train AI models.
                Microsoft may keep a copy for up to 30 days for safety checks —
                see{" "}
                <a
                  href="https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Azure OpenAI data &amp; privacy
                </a>.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-muted-foreground shrink-0 mt-0.5">💻</span>
              <p>
                <strong>Your browser</strong> — Chat history is saved in your browser
                (localStorage). It never goes to our servers. Clearing your browser
                data removes it.
              </p>
            </div>
          </div>
        </section>

        {/* What we don't do */}
        <section className="border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">What we don&apos;t do</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="text-red-500 font-bold shrink-0">✗</span>
              <p><strong>No selling your data</strong> — we never sell or share your health information with anyone</p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-500 font-bold shrink-0">✗</span>
              <p><strong>No advertising</strong> — we have no ad network and no advertising partners</p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-500 font-bold shrink-0">✗</span>
              <p><strong>No AI training on your data</strong> — neither we nor Microsoft Azure OpenAI use your health data to train AI models</p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-500 font-bold shrink-0">✗</span>
              <p><strong>No storing health records</strong> — health data is only used to answer your question. Nothing is saved to a database.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-red-500 font-bold shrink-0">✗</span>
              <p><strong>No write access</strong> — we can only read your health records; we cannot change or delete anything</p>
            </div>
          </div>
        </section>

        {/* How long we keep things */}
        <section className="border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-xl font-semibold">How long we keep things</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="text-green-600 font-bold shrink-0">~10 min</span>
              <p><strong>Your sign-in</strong> — a small encrypted file, kept in your browser only. Expires automatically after about 10 minutes of no activity.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-green-600 font-bold shrink-0">0</span>
              <p><strong>Health records</strong> — fetched on demand, used to answer your question, then gone. Never written to disk on our side.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-green-600 font-bold shrink-0">Your choice</span>
              <p><strong>Chat history</strong> — saved in your browser only. You can delete it any time by clearing your browser data.</p>
            </div>
          </div>
        </section>

        {/* Your rights */}
        <section className="border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-xl font-semibold">Your rights</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Your health information is protected by Alberta&apos;s Health Information Act (HIA)
              and Protection of Privacy Act. Here&apos;s what that means for you in plain language:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>You can ask what we hold about you.</strong> Because we store almost nothing, this will be quick.</li>
              <li><strong>You can ask us to correct mistakes.</strong> If we have any info about you that&apos;s wrong, we&apos;ll fix it.</li>
              <li><strong>You can make a complaint.</strong> If you think we&apos;ve mishandled your information, you can report it to Alberta&apos;s privacy watchdog: the{" "}
                <a href="https://www.oipc.ab.ca" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Office of the Information and Privacy Commissioner (OIPC)
                </a>.
              </li>
            </ul>
          </div>
        </section>

        {/* How to reach us */}
        <section className="text-center text-sm text-muted-foreground py-4 space-y-2">
          <p className="font-semibold text-foreground">Questions about privacy?</p>
          <p>
            Email us at{" "}
            <a href="mailto:support@myaihealth.ca" className="text-primary hover:underline">
              support@myaihealth.ca
            </a>
          </p>
          <p>
            See the full{" "}
            <a href="https://www.myaihealth.ca/terms.html" className="text-primary hover:underline">
              Terms of Use
            </a>{" "}
            for legal detail.
          </p>
        </section>

        {/* Beta disclaimer */}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Beta product.</strong> This app is in beta — features and privacy
            practices may change. For any medical decisions, always talk to your
            healthcare provider.
          </p>
        </section>

      </main>
    </div>
  );
}
