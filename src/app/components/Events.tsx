"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEvent } from "@/app/contexts/EventContext";
import { LoggedEvent } from "@/app/types";

export interface EventsProps {
  isExpanded: boolean;
}

function Events({ isExpanded }: EventsProps) {
  const [prevEventLogs, setPrevEventLogs] = useState<LoggedEvent[]>([]);
  const eventLogsContainerRef = useRef<HTMLDivElement | null>(null);

  const { loggedEvents, toggleExpand } = useEvent();

  const getDirectionArrow = (direction: string) => {
    if (direction === "client") return { symbol: "▲", color: "var(--primary)" };
    if (direction === "server") return { symbol: "▼", color: "var(--accent)" };
    return { symbol: "•", color: "var(--muted)" };
  };

  useEffect(() => {
    const hasNewEvent = loggedEvents.length > prevEventLogs.length;

    if (isExpanded && hasNewEvent && eventLogsContainerRef.current) {
      eventLogsContainerRef.current.scrollTop =
        eventLogsContainerRef.current.scrollHeight;
    }

    setPrevEventLogs(loggedEvents);
  }, [loggedEvents, isExpanded]);

  return (
    <div
      className={`
        ${isExpanded ? "w-1/2 overflow-auto" : "w-0 overflow-hidden opacity-0"}
        transition-all rounded-lg duration-200 ease-in-out flex flex-col 
        bg-background dark:bg-[#202020] border border-border dark:border-panel-border panel
      `}
      ref={eventLogsContainerRef}
    >
      {isExpanded && (
        <div>
          <div className="font-semibold px-6 py-4 sticky top-0 z-10 text-base border-divider bg-[#2a2a2a]/5  dark:bg-[#2a2a2a] text-foreground dark:text-foreground/90">
            Logs
          </div>
          <div>
            {loggedEvents.map((log) => {
              const arrowInfo = getDirectionArrow(log.direction);
              const isError =
                log.eventName.toLowerCase().includes("error") ||
                log.eventData?.response?.status_details?.error != null;

              return (
                <div
                  key={log.id}
                  className="border-t-[0.5px] border-t-gray-400  dark:border-t-gray-500 border-panel-border/50 py-2 px-6 font-mono hover:bg-surface/50 dark:hover:bg-surface/20 transition-colors duration-200"
                >
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center flex-1">
                      <span
                        style={{ color: arrowInfo.color }}
                        className="ml-1 mr-2"
                      >
                        {arrowInfo.symbol}
                      </span>
                      <span
                        className={`
                          flex-1 text-sm
                          ${isError 
                            ? "text-red-600 dark:text-red-400" 
                            : "text-foreground dark:text-foreground/90"}
                        `}
                      >
                        {log.eventName}
                      </span>
                    </div>
                    <div className="text-muted dark:text-muted ml-1 text-xs whitespace-nowrap">
                      {log.timestamp}
                    </div>
                  </div>

                  {log.expanded && log.eventData && (
                    <div className="text-foreground dark:text-foreground/90 text-left">
                      <pre className="border-l-2 ml-1 border-panel-border whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                        {JSON.stringify(log.eventData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Events;
