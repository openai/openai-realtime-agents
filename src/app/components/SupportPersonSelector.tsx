"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Person } from "../lib/types";

interface SupportPersonSelectorProps {
  engagementId: string | null;
  onPersonSelected: (person: Person | null) => void;
  selectedPersonId: string | null;
}

export default function SupportPersonSelector({
  engagementId,
  onPersonSelected,
  selectedPersonId
}: SupportPersonSelectorProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchSupportPeople = async () => {
      if (!engagementId) {
        setPeople([]);
        setFilteredPeople([]);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        console.log("Fetching support people from API...");
        
        const response = await fetch(`/api/engagements/${engagementId}/people`);
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data?.length || 0} support people from API`);
        console.log("Sample data:", data?.slice(0, 3));
        
        setPeople(data);
        setFilteredPeople(data);
        
        // If previously selected person is not in the new people list, clear selection
        if (selectedPersonId && !data.some((person: Person) => person.id === selectedPersonId)) {
          onPersonSelected(null);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to fetch support people:", err);
        setError(err.message || "Failed to load support people");
        setLoading(false);
      }
    };

    fetchSupportPeople();
  }, [engagementId, selectedPersonId, onPersonSelected]);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (query.trim() === "") {
        setFilteredPeople(people);
      } else {
        const searchTerm = query.toLowerCase();
        const filtered = people.filter(person => 
          `${person.first_name} ${person.last_name}`.toLowerCase().includes(searchTerm) ||
          (person.title && person.title.toLowerCase().includes(searchTerm))
        );
        setFilteredPeople(filtered);
      }
      setActiveIndex(-1);
    }, 300); // 300ms debounce
  }, [people]);

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

  const handlePersonSelect = (person: Person | null) => {
    onPersonSelected(person);
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
          prev < filteredPeople.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredPeople.length) {
          handlePersonSelect(filteredPeople[activeIndex]);
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

  if (!engagementId) {
    return (
      <div className="text-gray-500 text-sm py-2">
        Please select a support engagement first to view support personnel.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse text-gray-500 text-sm py-2">Loading support personnel...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm py-2">Error: {error}</div>
    );
  }

  // Find the selected person
  const selectedPerson = selectedPersonId 
    ? people.find(p => p.id === selectedPersonId) 
    : null;

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {selectedPerson ? (
        <div className="flex items-center justify-between bg-amber-50 p-3 rounded-md">
          <div className="flex items-center gap-3">
            {selectedPerson.photo ? (
              <Image
                src={selectedPerson.photo}
                alt={`${selectedPerson.first_name} ${selectedPerson.last_name}`}
                width={32}
                height={32}
                className="w-8 h-8 object-cover rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-medium">
                {selectedPerson.first_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">
                {selectedPerson.first_name} {selectedPerson.last_name}
              </p>
              {selectedPerson.title && (
                <p className="text-xs text-gray-500">{selectedPerson.title}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handlePersonSelect(null)}
            className="text-sm text-amber-600 hover:text-amber-800"
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
              placeholder="Search for a support person..."
              aria-label="Search for a support person"
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              aria-controls="person-list"
              role="combobox"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
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
              id="person-list"
              className="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-md z-10"
              role="listbox"
            >
              {filteredPeople.length > 0 ? (
                filteredPeople.map((person, index) => (
                  <div 
                    key={person.id}
                    id={`person-option-${person.id}`}
                    onClick={() => handlePersonSelect(person)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      activeIndex === index ? 'bg-amber-50' : ''
                    }`}
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                  >
                    {person.photo ? (
                      <Image
                        src={person.photo}
                        alt={`${person.first_name} ${person.last_name}`}
                        width={32}
                        height={32}
                        className="w-8 h-8 object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-medium">
                        {person.first_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {person.first_name} {person.last_name}
                      </p>
                      {person.title && (
                        <p className="text-xs text-gray-500">{person.title}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500 text-sm">
                  {searchQuery 
                    ? "No support personnel found matching your search" 
                    : "No support personnel available for this engagement"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
} 