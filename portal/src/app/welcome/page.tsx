import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Clock,
  Shield,
  HelpCircle,
  LogIn,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Welcome to MyAI Health",
  description:
    "Find out what MyAI Health can do for you \u2014 what to expect, what to ask, and how your privacy is protected.",
};

const EXAMPLE_QUESTIONS = [
  "What were my last blood test results?",
  "What medicines am I currently taking?",
  "Am I up to date on my vaccines?",
  "What were my blood pressure readings over the last year?",
  "Do I have any upcoming appointments?",
  "Can you explain what my cholesterol numbers mean?",
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Top nav */}
      <nav
        aria-label="Page navigation"
        className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40"
      >
        <div className="max-w-3xl mx-auto flex h-14 items-center px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </nav>

      <main
        id="main-content"
        className="max-w-3xl mx-auto px-4 py-10 space-y-12"
        style={{ fontSize: "1.125rem", lineHeight: "1.7" }}
      >
        {/* ── Section 1: Welcome ── */}
        <section aria-labelledby="welcome-heading">
          <h1
            id="welcome-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
          >
            Welcome to MyAI Health
          </h1>
          <p>
            MyAI Health is an assistant that reads your Alberta health records
            and answers your questions in plain English. You can ask things like{" "}
            <em>&ldquo;What were my last blood test results?&rdquo;</em> or{" "}
            <em>&ldquo;What medicines am I on?&rdquo;</em> &mdash; and get a
            clear, easy-to-read answer.
          </p>
          <p className="mt-3">
            It connects to the same records you can see on{" "}
            <strong>My Health Records</strong> and{" "}
            <strong>AHS MyChart</strong> &mdash; Alberta&apos;s official health
            portals. This assistant just makes them easier to explore and
            understand.
          </p>
        </section>

        <hr className="border-border" />

        {/* ── Section 2: What you'll need ── */}
        <section aria-labelledby="need-heading">
          <h2
            id="need-heading"
            className="text-2xl font-bold mb-4 flex items-center gap-2"
          >
            <CheckCircle
              className="h-6 w-6 text-primary shrink-0"
              aria-hidden="true"
            />
            What you&apos;ll need
          </h2>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                aria-hidden="true"
              />
              <span>
                A <strong>MyAlberta Digital ID</strong> account &mdash; the
                login you already use on Alberta government websites.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                aria-hidden="true"
              />
              <span>
                About <strong>5 minutes</strong> to get started.
              </span>
            </li>
          </ul>
          <p className="mt-4 text-muted-foreground text-sm">
            If you don&apos;t have a MyAlberta Digital ID yet, you can create
            one for free at{" "}
            <a
              href="https://account.alberta.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              account.alberta.ca
            </a>
            .
          </p>
        </section>

        <hr className="border-border" />

        {/* ── Section 3: How to sign in ── */}
        <section aria-labelledby="signin-heading">
          <h2
            id="signin-heading"
            className="text-2xl font-bold mb-4 flex items-center gap-2"
          >
            <LogIn
              className="h-6 w-6 text-primary shrink-0"
              aria-hidden="true"
            />
            How to sign in
          </h2>
          <p>
            When you click{" "}
            <strong>
              &ldquo;I&apos;m ready &mdash; sign me in&rdquo;
            </strong>{" "}
            below, a sign-in screen will appear. It&apos;s Alberta&apos;s own
            login page &mdash; the same one used for My Health Records.
            You&apos;ll enter your MyAlberta Digital ID and password there, on
            Alberta&apos;s website.
          </p>
          <p className="mt-3">
            We <strong>never</strong> see your password. Alberta handles the
            login and then lets us know you&apos;ve been approved. Your
            password stays between you and Alberta.
          </p>
        </section>

        <hr className="border-border" />

        {/* ── Section 4: What you can ask ── */}
        <section aria-labelledby="ask-heading">
          <h2
            id="ask-heading"
            className="text-2xl font-bold mb-4 flex items-center gap-2"
          >
            <HelpCircle
              className="h-6 w-6 text-primary shrink-0"
              aria-hidden="true"
            />
            What you can ask
          </h2>
          <p>Once you&apos;re signed in, you can ask questions like these:</p>
          <ul
            className="mt-4 space-y-2 ml-1"
            aria-label="Example questions you can ask"
          >
            {EXAMPLE_QUESTIONS.map((q) => (
              <li key={q} className="flex items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                  aria-hidden="true"
                />
                <span className="italic">&ldquo;{q}&rdquo;</span>
              </li>
            ))}
          </ul>
          <p className="mt-4">
            You can ask in your own words &mdash; you don&apos;t need to use
            exact phrases.
          </p>
        </section>

        <hr className="border-border" />

        {/* ── Section 5: Important limits ── */}
        <section aria-labelledby="limits-heading">
          <h2
            id="limits-heading"
            className="text-2xl font-bold mb-4 flex items-center gap-2"
          >
            <AlertTriangle
              className="h-6 w-6 text-amber-500 shrink-0"
              aria-hidden="true"
            />
            Important limits
          </h2>
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2"
            role="note"
            aria-label="Important limits and warnings"
            style={{ color: "inherit" }}
          >
            <p>
              <strong>This assistant is not a doctor.</strong> It can read your
              records and explain what you&apos;re looking at &mdash; but it
              cannot diagnose an illness, tell you what treatment to choose, or
              replace a talk with your doctor or nurse.
            </p>
            <p>
              <strong>Always talk to your healthcare team</strong> before
              changing any medicine or making health decisions.
            </p>
            <p>
              Your data comes from My Health Records and AHS MyChart. If
              something looks wrong or missing, check those sites directly.
              This assistant shows exactly what they show &mdash; nothing more,
              nothing less.
            </p>
          </div>
        </section>

        <hr className="border-border" />

        {/* ── Section 6: Session timeout ── */}
        <section aria-labelledby="timeout-heading">
          <h2
            id="timeout-heading"
            className="text-2xl font-bold mb-4 flex items-center gap-2"
          >
            <Clock
              className="h-6 w-6 text-primary shrink-0"
              aria-hidden="true"
            />
            Getting signed out
          </h2>
          <p>
            For your safety, you&apos;ll be signed out after about{" "}
            <strong>10 minutes</strong> of not using the chat. This is the same
            rule that Alberta&apos;s health websites use.
          </p>
          <p className="mt-3">
            If that happens, just sign in again. No data is lost &mdash; your
            health records are stored by Alberta, not here.
          </p>
        </section>

        <hr className="border-border" />

        {/* ── Section 7: Privacy ── */}
        <section aria-labelledby="privacy-heading">
          <h2
            id="privacy-heading"
            className="text-2xl font-bold mb-4 flex items-center gap-2"
          >
            <Shield
              className="h-6 w-6 text-primary shrink-0"
              aria-hidden="true"
            />
            Your privacy
          </h2>
          <p>
            Your health data is read straight from Alberta Health and shown to
            you. We don&apos;t save your lab results, medicines, or any other
            health details on our end. When your visit ends, the data is gone
            from our side.
          </p>
          <p className="mt-3">
            The AI that helps read and explain your data runs on{" "}
            <strong>Microsoft Azure servers in Canada</strong>. Our
            setup follows Alberta&apos;s privacy rules.
          </p>
          <p className="mt-3">
            Read our full{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Privacy Policy
            </Link>{" "}
            for details.
          </p>
        </section>

        <hr className="border-border" />

        {/* ── Section 8: Getting help ── */}
        <section aria-labelledby="help-heading">
          <h2
            id="help-heading"
            className="text-2xl font-bold mb-4 flex items-center gap-2"
          >
            <HelpCircle
              className="h-6 w-6 text-primary shrink-0"
              aria-hidden="true"
            />
            Getting help
          </h2>
          <p>
            If you get stuck, run into an error, or something doesn&apos;t look
            right, email us at{" "}
            <a
              href="mailto:support@myaihealth.ca"
              className="underline underline-offset-2 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded font-medium"
            >
              support@myaihealth.ca
            </a>
            .
          </p>
          <p className="mt-3">In your message, tell us:</p>
          <ul className="mt-2 space-y-1 ml-1">
            <li className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                aria-hidden="true"
              />
              <span>What you were trying to do</span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                aria-hidden="true"
              />
              <span>What happened instead (or any error message you saw)</span>
            </li>
            <li className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                aria-hidden="true"
              />
              <span>
                The type of device you&apos;re using (phone, tablet, computer)
              </span>
            </li>
          </ul>
          <p className="mt-3">
            We&apos;ll get back to you as quickly as we can &mdash; usually
            within one business day.
          </p>
        </section>

        <hr className="border-border" />

        {/* ── CTA ── */}
        <section aria-labelledby="cta-heading" className="pb-4">
          <h2 id="cta-heading" className="sr-only">
            Ready to get started
          </h2>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-6 sm:p-8 text-center space-y-4">
            <p className="text-lg font-medium">You&apos;re all set!</p>
            <p className="text-muted-foreground">
              Click the button below to go to the chat and sign in with your
              MyAlberta Digital ID.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground font-semibold px-8 py-4 text-lg shadow hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-2"
              style={{ minHeight: "3.25rem" }}
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
              I&apos;m ready &mdash; sign me in
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4 mt-4">
        <div
          className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground"
          style={{ fontSize: "0.875rem" }}
        >
          <p>MyAI Health &mdash; your Alberta health records, in plain language</p>
          <div className="flex gap-4">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Privacy
            </Link>
            <a
              href="mailto:support@myaihealth.ca"
              className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
