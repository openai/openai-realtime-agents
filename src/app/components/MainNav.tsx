"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MainNav() {
  const pathname = usePathname();
  
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Interviews", href: "/interviews" },
  ];
  
  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold text-gray-900 flex items-center">
              <span className="text-blue-600 mr-1">Volta</span> Research
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
} 