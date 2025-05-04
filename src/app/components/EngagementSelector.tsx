"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { SupportEngagement } from "../lib/types";

interface EngagementSelectorProps {
  companyId: string | null;
  onEngagementSelected: (engagement: SupportEngagement | null) => void;
  selectedEngagementId: string | null;
}

// Helper function to strip HTML tags from text
const stripHtmlTags = (html: string | null | undefined): string => {
  if (!html) return "";
  
  // First replace common HTML tags with appropriate spacing
  const withSpaces = html
    .replace(/<\/p>/g, ' ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<\/div>/g, ' ')
    .replace(/<\/li>/g, ' ');
  
  // Then remove all remaining HTML tags
  return withSpaces
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
    .trim();
};

export default function EngagementSelector({
  companyId,
  onEngagementSelected,
  selectedEngagementId
}: EngagementSelectorProps) {
  const [engagements, setEngagements] = useState<SupportEngagement[]>([]);
  const [filteredEngagements, setFilteredEngagements] = useState<SupportEngagement[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchEngagements = async () => {
      if (!companyId) {
        setEngagements([]);
        setFilteredEngagements([]);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        console.log("Fetching engagements from API...");
        
        const response = await fetch(`/api/companies/${companyId}/engagements`);
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data?.length || 0} engagements from API`);
        console.log("Sample data:", data?.slice(0, 3));
        
        setEngagements(data);
        setFilteredEngagements(data);
        
        // If previously selected engagement is not in the new engagements list, clear selection
        if (selectedEngagementId && !data.some((engagement: SupportEngagement) => engagement.id === selectedEngagementId)) {
          onEngagementSelected(null);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to fetch engagements:", err);
        setError(err.message || "Failed to load engagements");
        setLoading(false);
      }
    };

    fetchEngagements();
  }, [companyId, selectedEngagementId, onEngagementSelected]);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (query.trim() === "") {
        setFilteredEngagements(engagements);
      } else {
        const searchTerm = query.toLowerCase();
        const filtered = engagements.filter(engagement => {
          const descriptionText = stripHtmlTags(engagement.description).toLowerCase();
          return engagement.title.toLowerCase().includes(searchTerm) || 
                 descriptionText.includes(searchTerm);
        });
        setFilteredEngagements(filtered);
      }
      setActiveIndex(-1);
    }, 300); // 300ms debounce
  }, [engagements]);

  // Update search when query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    
    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, debouncedSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleEngagementSelect = (engagement: SupportEngagement | null) => {
    onEngagementSelected(engagement);
    setSearchQuery("");
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsDropdownOpen(true);
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle keyboard navigation when dropdown is closed
    if (!isDropdownOpen) return;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex(prev => 
          prev < filteredEngagements.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredEngagements.length) {
          handleEngagementSelect(filteredEngagements[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsDropdownOpen(false);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  if (!companyId) {
    return (
      <div className="text-gray-500 text-sm py-2">
        Please select a company first to view support engagements.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse text-gray-500 text-sm py-2">Loading support engagements...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm py-2">Error: {error}</div>
    );
  }

  // Find the selected engagement
  const selectedEngagement = selectedEngagementId 
    ? engagements.find(e => e.id === selectedEngagementId) 
    : null;

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {selectedEngagement ? (
        <div className="flex items-center justify-between bg-purple-50 p-3 rounded-md">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-gray-900">{selectedEngagement.title}</p>
            {selectedEngagement.description && (
              <p className="text-sm text-gray-500 line-clamp-2">
                {stripHtmlTags(selectedEngagement.description)}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                selectedEngagement.status === 'active' ? 'bg-green-100 text-green-800' :
                selectedEngagement.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {selectedEngagement.status}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(selectedEngagement.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleEngagementSelect(null)}
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder="Search for a support engagement..."
              aria-label="Search for a support engagement"
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              aria-controls="engagement-list"
              role="combobox"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          
          {isDropdownOpen && (
            <div 
              id="engagement-list"
              className="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-md z-10"
              role="listbox"
            >
              {filteredEngagements.length > 0 ? (
                filteredEngagements.map((engagement, index) => (
                  <div 
                    key={engagement.id}
                    id={`engagement-option-${engagement.id}`}
                    onClick={() => handleEngagementSelect(engagement)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex flex-col gap-1 p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      activeIndex === index ? 'bg-purple-50' : ''
                    }`}
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                  >
                    <div className="flex justify-between">
                      <p className="font-medium text-gray-900">{engagement.title}</p>
                      <span className="text-xs text-gray-500">
                        {new Date(engagement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {engagement.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {stripHtmlTags(engagement.description)}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        engagement.status === 'active' ? 'bg-green-100 text-green-800' :
                        engagement.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {engagement.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500 text-sm">
                  {searchQuery 
                    ? "No support engagements found matching your search" 
                    : "No support engagements available for this company"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
} 