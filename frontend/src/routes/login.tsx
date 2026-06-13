import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";
export const Route = createFileRoute("/login")({ head: () => ({ meta: [{ title: "Login — FlowForge ERP" }, { name: "description", content: "Secure access to Shiv Furniture Works operations." }] }), component: () => <AuthPage mode="login" /> });