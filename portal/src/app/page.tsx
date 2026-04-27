import Link from "next/link";
import {
  Shield,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { BrandLogo, BrandName, GradientText } from "@/components/ui/brand";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation — matches www.myaihealth.ca */}
      <nav className="sticky top-0 w-full bg-background/90 backdrop-blur-sm border-b border-border z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <BrandName className="text-lg" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a>
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#privacy" className="hover:text-primary transition-colors">Privacy</a>
            <Link
              href="/chat"
              className="px-4 py-2 bg-[#0277b5] text-white rounded-lg hover:bg-[#026a9e] transition-colors font-medium"
            >
              Open Chat
            </Link>
          </div>
          <Link
            href="/chat"
            className="md:hidden px-4 py-2 bg-[#0277b5] text-white rounded-lg hover:bg-[#026a9e] transition-colors font-medium text-sm"
          >
            Open Chat
          </Link>
        </div>
      </nav>

      <main>
        {/* Hero — matches www.myaihealth.ca style */}
        <section className="pt-20 pb-16 px-6">
          <div className="max-w-6xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f0f9ff] text-[#035f8a] rounded-full text-sm font-medium mb-8">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              Built for Alberta · Your data, your control
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Your health records,<br />
              <GradientText>powered by AI</GradientText>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Ask about your lab results, vaccines, medicines, appointments, and
              more — in plain language. Connected to Alberta&apos;s official health
              portals.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="px-8 py-4 bg-[#0277b5] text-white rounded-xl hover:bg-[#026a9e] transition-all text-lg font-semibold shadow-lg"
              >
                Get Started
              </Link>
              <Link
                href="/welcome"
                className="px-8 py-4 text-muted-foreground hover:text-primary transition-colors text-lg font-medium"
              >
                Learn more →
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 px-6 bg-[#f8fafc]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Three steps. No technical knowledge required.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  icon: Shield,
                  title: "Sign in securely",
                  desc: "Sign in with your MyAlberta Digital ID — on Alberta's real login page. We never see or store your password.",
                },
                {
                  step: "2",
                  icon: MessageSquare,
                  title: "Ask questions",
                  desc: "Ask about your health records in plain language. AI fetches your real data from government portals and explains it clearly.",
                },
                {
                  step: "3",
                  icon: Shield,
                  title: "Nothing stored",
                  desc: "Your health data passes through but is never saved. When you disconnect, it's gone from our side completely.",
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#0277b5] text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              See what you can ask
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              44 tools across My Health Records and AHS MyChart.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                "Show me my lab results from the last year",
                "Am I up to date on my vaccinations?",
                "What medicines am I currently on?",
                "Explain my blood work in plain language",
                "Show my upcoming appointments",
                "Download my latest scan report",
                "Do I have any active referrals?",
                "Give me a complete health summary",
              ].map((q) => (
                <div
                  key={q}
                  className="px-4 py-3 border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                >
                  &ldquo;{q}&rdquo;
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="py-20 px-6 bg-[#f8fafc]">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="w-14 h-14 rounded-xl bg-[#0277b5] flex items-center justify-center mx-auto">
              <Shield className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
            <h2 className="text-3xl font-bold">Privacy by design</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              {[
                { icon: "🔒", title: "No health data stored", desc: "We fetch your data live from government portals. Nothing is saved on our servers." },
                { icon: "🇨🇦", title: "Canadian data residency", desc: "AI processing runs on Azure Canada East. Your data stays in Canada." },
                { icon: "🔑", title: "You control access", desc: "Disconnect anytime. Your session is cleared instantly. We never store your credentials." },
                { icon: "⚕️", title: "Not medical advice", desc: "AI helps you understand your records. Always talk to your doctor about health decisions." },
              ].map((item) => (
                <div key={item.title} className="p-5 rounded-xl bg-background border">
                  <p className="font-medium text-sm">{item.icon} {item.title}</p>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <Link
              href="/privacy"
              className="inline-block text-sm text-primary hover:underline"
            >
              Read full privacy policy →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span>MyAI Health — your Alberta health records, in plain language</span>
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/welcome" className="hover:text-foreground transition-colors">How It Works</Link>
            <a href="mailto:support@myaihealth.ca" className="hover:text-foreground transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
