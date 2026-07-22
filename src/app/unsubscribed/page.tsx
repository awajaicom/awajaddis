export default function UnsubscribedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-charcoal/10 bg-white p-8 text-center">
        <h1 className="font-display text-xl font-semibold">You’re unsubscribed</h1>
        <p className="mt-3 text-sm text-smoke">
          You won’t receive any more marketing emails from us. Service emails about your
          account (receipts, password resets) may still be delivered.
        </p>
      </div>
    </main>
  );
}
