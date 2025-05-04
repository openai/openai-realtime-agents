"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Company } from "../lib/types";

interface CompanySelectorProps {
  onCompanySelected: (company: Company | null) => void;
  selectedCompanyId: string | null;
}

export default function CompanySelector({
  onCompanySelected,
  selectedCompanyId
}: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        console.log("Fetching companies from API...");
        const response = await fetch("/api/companies");
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data?.length || 0} companies from API`);
        console.log("Sample data:", data?.slice(0, 3));
        
        setCompanies(data);
        setFilteredCompanies(data);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to fetch companies:", err);
        setError(err.message || "Failed to load companies");
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (query.trim() === "") {
        setFilteredCompanies(companies);
      } else {
        const searchTerm = query.toLowerCase();
        const filtered = companies.filter(company => 
          company.business_name.toLowerCase().includes(searchTerm)
        );
        setFilteredCompanies(filtered);
      }
      setActiveIndex(-1);
    }, 300); // 300ms debounce
  }, [companies]);

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

  const handleCompanySelect = (company: Company | null) => {
    onCompanySelected(company);
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
          prev < filteredCompanies.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredCompanies.length) {
          handleCompanySelect(filteredCompanies[activeIndex]);
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

  if (loading) {
    return (
      <div className="animate-pulse text-gray-500 text-sm py-2">Loading companies...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm py-2">Error: {error}</div>
    );
  }

  // Find the selected company
  const selectedCompany = selectedCompanyId 
    ? companies.find(c => c.id === selectedCompanyId) 
    : null;

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {selectedCompany ? (
        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md">
          <div className="flex items-center gap-3">
            {selectedCompany.logo && (
              <img 
                src={selectedCompany.logo} 
                alt={selectedCompany.business_name} 
                className="w-8 h-8 object-contain rounded-sm"
              />
            )}
            <div>
              <p className="font-medium text-gray-900">{selectedCompany.business_name}</p>
              {selectedCompany.website && (
                <p className="text-xs text-gray-500">{selectedCompany.website}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCompanySelect(null)}
            className="text-sm text-blue-600 hover:text-blue-800"
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
              placeholder="Search for a company..."
              aria-label="Search for a company"
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              aria-controls="company-list"
              role="combobox"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              id="company-list"
              className="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-md z-10"
              role="listbox"
            >
              {filteredCompanies.length > 0 ? (
                filteredCompanies.map((company, index) => (
                  <div 
                    key={company.id}
                    id={`company-option-${company.id}`}
                    onClick={() => handleCompanySelect(company)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      activeIndex === index ? 'bg-blue-50' : ''
                    }`}
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                  >
                    {company.logo ? (
                      <img 
                        src={company.logo} 
                        alt=""
                        className="w-8 h-8 object-contain rounded-sm"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded-sm flex items-center justify-center text-gray-500">
                        {company.business_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{company.business_name}</p>
                      {company.website && (
                        <p className="text-xs text-gray-500">{company.website}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500 text-sm">
                  {searchQuery ? "No companies found matching your search" : "No companies available"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
} 