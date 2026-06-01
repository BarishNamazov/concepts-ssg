import type { Metadata } from "next";
import { AuthForm } from "@/components/forum/auth-form";

export const metadata: Metadata = { title: "Join" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
