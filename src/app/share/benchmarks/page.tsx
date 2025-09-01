import React from 'react';

export const dynamic = 'force-static';

export async function generateMetadata({ searchParams }: { searchParams: Record<string, string> }) {
  const params = new URLSearchParams({
    country: searchParams.country || 'UK',
    age: searchParams.age || '',
    home: searchParams.home || '',
    income: searchParams.income || '',
    dependants: searchParams.dependants || '',
    top: searchParams.top || '',
  });
  const ogUrl = `/share/benchmarks/opengraph-image?${params.toString()}`;
  const twUrl = `/share/benchmarks/twitter-image?${params.toString()}`;
  const title = 'People like you — Prosper';
  const description = 'See how you compare to people like you with Prosper.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [twUrl],
    },
  } as any;
}

export default function ShareBenchmarksPage({ searchParams }: { searchParams: Record<string, string> }) {
  const country = (searchParams.country || 'UK').toString();
  const home = (searchParams.home || '').toString();
  const income = (searchParams.income || '').toString();
  const top = Number.isFinite(Number(searchParams.top)) ? Math.round(Number(searchParams.top)) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border bg-white shadow-sm p-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs">Prosper • People like you</div>
          <div className="mt-3 text-3xl font-semibold text-gray-900">Top {top ?? '—'}% of peers</div>
          <div className="mt-1 text-gray-600">{[country, home || '—', income || '—'].join(', ')}</div>
        </div>
        <div className="mt-6 text-center text-sm text-gray-500">Made with Prosper — your personal wealth coach</div>
      </div>
    </div>
  );
}
