import React from 'react';

export const PageHeader: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <header className="border-b border-gray-800 pb-3">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
  </header>
);
