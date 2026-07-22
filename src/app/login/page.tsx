import Image from "next/image";
import { LoginForm } from "./ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <Image src="/logo.svg" alt="Awaj ET" width={30} height={30} priority />
          <span className="font-display text-lg font-semibold">
            Awaj <span className="text-amber">Email</span>
          </span>
        </div>
        <h1 className="mb-1 font-display text-xl font-bold">Sign in</h1>
        <p className="mb-6 text-sm text-smoke">Enter the dashboard password to continue.</p>
        <LoginForm redirectTo={from && from.startsWith("/") ? from : "/"} />
      </div>
    </main>
  );
}
