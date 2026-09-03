import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-mr-surface px-4">
      <div className="w-full max-w-sm rounded-lg border border-mr-line bg-white p-8">
        <Image
          src="/logo.png"
          alt="Mandarin Roots"
          width={218}
          height={40}
          priority
          className="mb-8 h-10 w-auto"
        />
        <h1 className="text-xl">Sign in</h1>
        <p className="mt-1 text-sm text-mr-body">Operations platform for the Mandarin Roots team.</p>
        <div className="mt-6">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
