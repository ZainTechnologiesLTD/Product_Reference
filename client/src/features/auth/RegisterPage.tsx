import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    name: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  function updateField(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Registration failed");
        return;
      }

      toast.success("Account created! Redirecting...");
      window.location.href = "/";
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Get started with your product reference manager
          </CardDescription>
          <p className="text-xs text-muted-foreground pt-1">
            by{" "}
            <a
              href="https://zaintechnologiesltd.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline underline-offset-4"
            >
              Zain Technologies LTD
            </a>
          </p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={updateField("name")}
                placeholder="John Doe"
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={updateField("username")}
                placeholder="johndoe"
                autoComplete="username"
                required
                minLength={3}
                maxLength={31}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={updateField("email")}
                placeholder="john@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={updateField("password")}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
