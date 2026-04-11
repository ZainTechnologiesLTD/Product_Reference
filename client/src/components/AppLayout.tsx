import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { LogOut, Moon, Package, Sun } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const { theme, toggleTheme, switchable } = useTheme();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ??
    user.username?.charAt(0).toUpperCase() ??
    "U";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4 mx-auto">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">
              Product Reference
            </span>
          </div>
          <div className="flex items-center gap-2">
            {switchable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name || user.username}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()}{" "}
        <a
          href="https://zaintechnologiesltd.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline underline-offset-4"
        >
          Zain Technologies LTD
        </a>
      </footer>
    </div>
  );
}
