import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-gray-800">
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 block">
        &larr; Return
      </Link>
      <h1 className="text-3xl font-semibold mb-4">Privacy Policy</h1>
      <p className="text-sm mb-3">We respect your privacy. This Policy describes how Prosper collects, uses, and protects your information.</p>
      <p className="text-sm mb-3">We use your data to personalize your experience and compute your KPIs and plan. We do not sell your data. You can request deletion of your information at any time.</p>
      <p className="text-sm mb-3">We may update this Policy from time to time. If you have questions, contact us.</p>
    </main>
  );
}

