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
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    signIn("google", { callbackUrl: "/chat" });
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
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

  // Check if we're in dev mode (credentials login available)
  const showCredentials = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ALLOW_CREDENTIALS === "true";

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
          <CardContent className="space-y-4 pt-6">
            {/* Google OAuth — primary sign-in method */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
              ) : (
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Dev-only credentials login */}
            {showCredentials && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      or (dev only)
                    </span>
                  </div>
                </div>
                <form onSubmit={handleCredentialsSubmit} noValidate aria-describedby={error ? "login-error" : undefined}>
                  <div className="space-y-3">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <div aria-live="polite" aria-atomic="true">
                      {error && (
                        <p id="login-error" className="text-sm text-destructive" role="alert">{error}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full bg-[#0277b5] hover:bg-[#026a9e]" disabled={loading}>
                      {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />}
                      Sign In
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-center">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back to home
            </Link>
          </CardFooter>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          No account needed — just sign in with your Google account.
          <br />
          Your health records require a separate sign-in with your MyAlberta Digital ID.
        </p>
      </div>
    </main>
  );
}
