import React, { useState } from 'react';
import { GuardrailResultType } from '@/types';

// Minimal inline icons to avoid external dependency
const IconCheck = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconCross = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconClock = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

export interface ModerationChipProps {
  moderationCategory: string;
  moderationRationale: string;
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function GuardrailChip({
  guardrailResult,
}: {
  guardrailResult: GuardrailResultType;
}) {
  const [expanded, setExpanded] = useState(false);

  // Consolidate state into a single variable: "PENDING", "PASS", or "FAIL"
  const state =
    guardrailResult.status === 'IN_PROGRESS'
      ? 'PENDING'
      : guardrailResult.category === 'NONE'
      ? 'PASS'
      : 'FAIL';

  // Variables for icon, label, and styling classes based on state
  let IconComponent: React.ComponentType<any>;
  let label: string;
  let textColorClass: string;
  switch (state) {
    case 'PENDING':
      IconComponent = IconClock;
      label = 'Pending';
      textColorClass = 'text-gray-600';
      break;
    case 'PASS':
      IconComponent = IconCheck;
      label = 'Pass';
      textColorClass = 'text-green-600';
      break;
    case 'FAIL':
      IconComponent = IconCross;
      label = 'Fail';
      textColorClass = 'text-red-500';
      break;
    default:
      IconComponent = IconClock;
      label = 'Pending';
      textColorClass = 'text-gray-600';
  }

  return (
    <div className="text-xs">
      <div
        onClick={() => {
          // Only allow toggling the expanded state for PASS/FAIL cases.
          if (state !== 'PENDING') {
            setExpanded(!expanded);
          }
        }}
        // Only add pointer cursor if clickable (PASS or FAIL state)
        className={`inline-flex items-center gap-1 rounded ${
          state !== 'PENDING' ? 'cursor-pointer' : ''
        }`}>
        Guardrail:
        <div className={`flex items-center gap-1 ${textColorClass}`}>
          <IconComponent /> {label}
        </div>
      </div>
      {/* Container for expandable content */}
      {state !== 'PENDING' &&
        guardrailResult.category &&
        guardrailResult.rationale && (
          <div
            className={`overflow-hidden transition-all duration-300 ${
              expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
            <div className="pt-2 text-xs">
              <strong>
                Moderation Category: {formatCategory(guardrailResult.category)}
              </strong>
              <div>{guardrailResult.rationale}</div>
              {guardrailResult.testText && (
                <blockquote className="mt-1 border-l-2 border-gray-300 pl-2 text-gray-400">
                  {guardrailResult.testText}
                </blockquote>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
