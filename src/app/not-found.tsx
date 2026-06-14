import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a12] px-6 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-slate-950/80 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Run not found</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          This report is not in local storage.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          The run may have been reset, uploaded with a different id, or removed
          during local demo cleanup.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-md bg-sky-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300"
        >
          Back to run history
        </Link>
      </section>
    </main>
  );
}
