"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Person } from "../lib/types";

interface ContactSelectorProps {
  companyId: string | null;
  onContactSelected: (contact: Person | null) => void;
  selectedContactId: string | null;
}

export default function ContactSelector({
  companyId,
  onContactSelected,
  selectedContactId
}: ContactSelectorProps) {
  const [contacts, setContacts] = useState<Person[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!companyId) {
        setContacts([]);
        setFilteredContacts([]);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/companies/${companyId}/contacts`);
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        setContacts(data);
        setFilteredContacts(data);
        
        // If previously selected contact is not in the new contacts list, clear selection
        if (selectedContactId && !data.some((contact: Person) => contact.id === selectedContactId)) {
          onContactSelected(null);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to fetch contacts:", err);
        setError(err.message || "Failed to load contacts");
        setLoading(false);
      }
    };

    fetchContacts();
  }, [companyId, selectedContactId, onContactSelected]);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (query.trim() === "") {
        setFilteredContacts(contacts);
      } else {
        const searchTerm = query.toLowerCase();
        const filtered = contacts.filter(contact => 
          `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchTerm)
        );
        setFilteredContacts(filtered);
      }
      setActiveIndex(-1);
    }, 300); // 300ms debounce
  }, [contacts]);

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

  const handleContactSelect = (contact: Person | null) => {
    onContactSelected(contact);
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
          prev < filteredContacts.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredContacts.length) {
          handleContactSelect(filteredContacts[activeIndex]);
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
        Please select a company first to view available contacts.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse text-gray-500 text-sm py-2">Loading contacts...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm py-2">Error: {error}</div>
    );
  }

  // Find the selected contact
  const selectedContact = selectedContactId 
    ? contacts.find(c => c.id === selectedContactId) 
    : null;

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {selectedContact ? (
        <div className="flex items-center justify-between bg-green-50 p-3 rounded-md">
          <div className="flex items-center gap-3">
            {selectedContact.photo ? (
              <img 
                src={selectedContact.photo} 
                alt={`${selectedContact.first_name} ${selectedContact.last_name}`} 
                className="w-8 h-8 object-cover rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                {selectedContact.first_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">
                {selectedContact.first_name} {selectedContact.last_name}
              </p>
              {selectedContact.title && (
                <p className="text-xs text-gray-500">{selectedContact.title}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleContactSelect(null)}
            className="text-sm text-green-600 hover:text-green-800"
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
              placeholder="Search for a contact..."
              aria-label="Search for a contact"
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              aria-controls="contact-list"
              role="combobox"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
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
              id="contact-list"
              className="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-md z-10"
              role="listbox"
            >
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact, index) => (
                  <div 
                    key={contact.id}
                    id={`contact-option-${contact.id}`}
                    onClick={() => handleContactSelect(contact)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      activeIndex === index ? 'bg-green-50' : ''
                    }`}
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                  >
                    {contact.photo ? (
                      <img 
                        src={contact.photo} 
                        alt=""
                        className="w-8 h-8 object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {contact.first_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.title && (
                        <p className="text-xs text-gray-500">{contact.title}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500 text-sm">
                  {searchQuery 
                    ? "No contacts found matching your search" 
                    : "No contacts available for this company"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
} 