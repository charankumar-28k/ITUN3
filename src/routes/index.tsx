import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Dashboard } from "@/components/Dashboard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Mood Sync — AI-powered social music" },
      { name: "description", content: "Detect your mood with AI, get a matching playlist, and listen with friends in real time." },
      { property: "og:title", content: "Mood Sync — AI-powered social music" },
      { property: "og:description", content: "Detect your mood, get a matching playlist, and listen together." },
    ],
  }),
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#aac0e1]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AnimatePresence mode="wait">
      <Dashboard key="dash" />
    </AnimatePresence>
  );
}

