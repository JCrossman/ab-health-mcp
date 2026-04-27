"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { BrandLogo } from "@/components/ui/brand";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/chat");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#f8fafc]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold">Sign in to MyAI Health</h1>
          <p className="text-sm text-muted-foreground">
            Access your Alberta health records with AI
          </p>
        </div>
        <Card>
          <form onSubmit={handleSubmit} noValidate aria-describedby={error ? "login-error" : undefined}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              <div aria-live="polite" aria-atomic="true">
                {error && (
                  <p id="login-error" className="text-sm text-destructive" role="alert">{error}</p>
                )}
              </div>
              <Button type="submit" className="w-full bg-[#0277b5] hover:bg-[#026a9e]" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                ) : null}
                Sign In
              </Button>
            </CardContent>
            <CardFooter className="justify-center">
              <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Back to home
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
