import Link from "next/link";

export default function InviteNotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Invite Link Not Found</h1>
        <p className="text-gray-600 mb-6">
          Sorry, we couldn&apos;t find a valid interview invite matching this link.
        </p>
        <Link
          href="https://voltaeffect.com"
          target="_blank"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Return to Volta
        </Link>
      </div>
    </div>
  );
} 