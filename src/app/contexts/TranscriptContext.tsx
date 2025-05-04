"use client";

import React, { createContext, useContext, useState, FC, PropsWithChildren, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { TranscriptItem } from "@/app/types";

type TranscriptContextValue = {
  transcriptItems: TranscriptItem[];
  addTranscriptMessage: (itemId: string, role: "user" | "assistant", text: string, hidden?: boolean) => void;
  updateTranscriptMessage: (itemId: string, text: string, isDelta: boolean) => void;
  addTranscriptBreadcrumb: (title: string, data?: Record<string, any>) => void;
  toggleTranscriptItemExpand: (itemId: string) => void;
  updateTranscriptItemStatus: (itemId: string, newStatus: "IN_PROGRESS" | "DONE") => void;
  saveTranscriptData: (interviewId: string) => Promise<void>;
  setActiveInterviewId: (id: string | null) => void;
};

const TranscriptContext = createContext<TranscriptContextValue | undefined>(undefined);

export const TranscriptProvider: FC<PropsWithChildren> = ({ children }) => {
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [activeInterviewId, setActiveInterviewId] = useState<string | null>(null);
  const [saveTimerId, setSaveTimerId] = useState<NodeJS.Timeout | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);

  function newTimestampPretty(): string {
    return new Date().toLocaleTimeString([], {
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  const addTranscriptMessage: TranscriptContextValue["addTranscriptMessage"] = (itemId, role, text = "", isHidden = false) => {
    setTranscriptItems((prev) => {
      if (prev.some((log) => log.itemId === itemId && log.type === "MESSAGE")) {
        console.warn(`[addTranscriptMessage] skipping; message already exists for itemId=${itemId}, role=${role}, text=${text}`);
        return prev;
      }

      const newItem: TranscriptItem = {
        itemId,
        type: "MESSAGE",
        role,
        title: text,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "IN_PROGRESS",
        isHidden,
      };

      return [...prev, newItem];
    });
  };

  const updateTranscriptMessage: TranscriptContextValue["updateTranscriptMessage"] = (itemId, newText, append = false) => {
    setTranscriptItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId && item.type === "MESSAGE") {
          return {
            ...item,
            title: append ? (item.title ?? "") + newText : newText,
          };
        }
        return item;
      })
    );
  };

  const addTranscriptBreadcrumb: TranscriptContextValue["addTranscriptBreadcrumb"] = (title, data) => {
    setTranscriptItems((prev) => [
      ...prev,
      {
        itemId: `breadcrumb-${uuidv4()}`,
        type: "BREADCRUMB",
        title,
        data,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "DONE",
        isHidden: false,
      },
    ]);
  };

  const toggleTranscriptItemExpand: TranscriptContextValue["toggleTranscriptItemExpand"] = (itemId) => {
    setTranscriptItems((prev) =>
      prev.map((log) =>
        log.itemId === itemId ? { ...log, expanded: !log.expanded } : log
      )
    );
  };

  const updateTranscriptItemStatus: TranscriptContextValue["updateTranscriptItemStatus"] = (itemId, newStatus) => {
    setTranscriptItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, status: newStatus } : item
      )
    );
  };

  // Function to save transcript data to the database
  const saveTranscriptData = useCallback(async (interviewId: string) => {
    if (!interviewId || transcriptItems.length === 0) return;
    
    try {
      // Filter out system messages and information only relevant to the UI
      const messages = transcriptItems
        .filter(item => !item.isHidden && item.type === "MESSAGE")
        .map(item => ({
          id: item.itemId,
          role: item.role,
          content: item.title,
          timestamp: item.timestamp,
          created_at: item.createdAtMs,
          status: item.status
        }));
      
      // Format data for saving
      const dataToSave = {
        messages,
        metadata: {
          last_updated: Date.now(),
          message_count: messages.length
        }
      };
      
      const response = await fetch('/api/interviews/save-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId,
          transcriptData: dataToSave
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to save transcript data:", errorData);
        return;
      }
      
      setLastSaveTime(Date.now());
      console.log(`Transcript saved for interview ${interviewId}`);
    } catch (error) {
      console.error("Error saving transcript data:", error);
    }
  }, [transcriptItems]);

  // Set up auto-save when active interview is set and transcript changes
  useEffect(() => {
    // Clear any existing timer
    if (saveTimerId) {
      clearTimeout(saveTimerId);
      setSaveTimerId(null);
    }
    
    // If no active interview, don't set up auto-save
    if (!activeInterviewId) return;
    
    // Don't save too frequently - set minimum interval to 5 seconds
    const timeSinceLastSave = Date.now() - lastSaveTime;
    const saveDelay = Math.max(5000 - timeSinceLastSave, 0);
    
    // Set up a timer to save transcript data
    const timer = setTimeout(() => {
      saveTranscriptData(activeInterviewId);
    }, saveDelay);
    
    setSaveTimerId(timer);
    
    // Clean up timer on unmount
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeInterviewId, transcriptItems, saveTranscriptData, lastSaveTime]);

  return (
    <TranscriptContext.Provider
      value={{
        transcriptItems,
        addTranscriptMessage,
        updateTranscriptMessage,
        addTranscriptBreadcrumb,
        toggleTranscriptItemExpand,
        updateTranscriptItemStatus,
        saveTranscriptData,
        setActiveInterviewId
      }}
    >
      {children}
    </TranscriptContext.Provider>
  );
};

export function useTranscript() {
  const context = useContext(TranscriptContext);
  if (!context) {
    throw new Error("useTranscript must be used within a TranscriptProvider");
  }
  return context;
}