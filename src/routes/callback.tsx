import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/callback")({
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  useEffect(() => { navigate({ to: "/" }); }, [navigate]);
  return null;
}

