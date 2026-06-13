import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";
export const Route = createFileRoute("/signup")({ head: () => ({ meta: [{ title: "Create Account — FlowForge ERP" }, { name: "description", content: "Request access to Shiv Furniture Works operations." }] }), component: () => <AuthPage mode="signup" /> });