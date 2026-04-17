import Link from "next/link";
import {
  Shield,
  MessageSquare,
  FlaskConical,
  Pill,
  Syringe,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ExampleConversation({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm">
          {question}
        </div>
      </div>
      <div className="flex justify-start">
        <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] text-sm">
          {answer}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Alberta Health Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/chat">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Understand your health records
            <br />
            <span className="text-primary">with AI</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your Alberta My Health Records account and ask questions about
            your lab results, medications, immunizations, and more — in plain language.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/chat">
              <Button size="lg">Start Chatting</Button>
            </Link>
            <Link href="/privacy">
              <Button variant="outline" size="lg">How It Works</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-primary" />
                  1. Connect securely
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Sign in with your MyAlberta Digital ID — the same login you use for
                  the official health portal. We never see or store your password.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  2. Ask questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Ask about your health records in plain language. The AI fetches your
                  real data from government portals and explains it clearly.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-primary" />
                  3. Nothing stored
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Your health data passes through but is never saved. When you
                  disconnect, it&apos;s gone. Only your sign-in stays active while you chat.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Example conversations */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">See what you can ask</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Lab Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExampleConversation
                  question="Show me my recent lab results"
                  answer="Here are your lab results from the last 6 months. Your CBC from Feb 15 shows hemoglobin at 142 g/L (normal range: 130-170). All values are within reference ranges. Would you like me to compare these to your previous results?"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="h-5 w-5 text-primary" />
                  Medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExampleConversation
                  question="What medications am I currently on?"
                  answer="You have 3 active medications: Metformin 500mg (twice daily), Lisinopril 10mg (once daily), and Atorvastatin 20mg (once daily at bedtime). Want me to explain what each one is for?"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Syringe className="h-5 w-5 text-primary" />
                  Immunizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExampleConversation
                  question="Am I up to date on my vaccines?"
                  answer="Based on your immunization records, you received your last COVID-19 booster in Oct 2024 and flu shot in Nov 2024. Your Tdap was last administered in 2019 — it's typically recommended every 10 years."
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-primary" />
                  Health Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExampleConversation
                  question="Give me an overview of my health"
                  answer="Here's your health snapshot: 3 active medications, last lab work on Feb 15 (all normal), blood pressure trending down over the last 3 months (great progress!), and 2 upcoming referral appointments."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Privacy section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Shield className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Privacy by design</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-lg bg-background border">
              <p className="font-medium text-sm">🔒 No health data stored</p>
              <p className="text-sm text-muted-foreground mt-1">
                We fetch your data live from government portals. Nothing is saved on our servers.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="font-medium text-sm">🇨🇦 Canadian data residency</p>
              <p className="text-sm text-muted-foreground mt-1">
                All infrastructure hosted in Azure Canada Central, compliant with Alberta&apos;s privacy laws.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="font-medium text-sm">🔑 You control access</p>
              <p className="text-sm text-muted-foreground mt-1">
                Disconnect anytime. Your session is cleared instantly. We never store your login credentials.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="font-medium text-sm">🏥 Not medical advice</p>
              <p className="text-sm text-muted-foreground mt-1">
                AI helps you understand your records, but always consult your healthcare provider for medical decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Alberta Health Portal — AI-powered access to your health records</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
