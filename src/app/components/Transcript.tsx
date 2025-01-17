"use-client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";
import Image from "next/image";
import { useTranscript } from "@/app/contexts/TranscriptContext";

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const [justCopied, setJustCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  useEffect(() => {
    if (canSend && inputRef.current) {
      inputRef.current.focus();
    }
  }, [canSend]);

  const handleCopyTranscript = async () => {
    if (!transcriptRef.current) return;
    try {
      await navigator.clipboard.writeText(transcriptRef.current.innerText);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-background dark:bg-[#202020] min-h-0 rounded-lg border border-border dark:border-panel-border panel">
      <div className="relative flex-1 min-h-0">
        <button
          onClick={handleCopyTranscript}
          className="absolute w-20 top-3 right-2 mr-1 z-10 text-sm px-3 py-2 rounded-lg bg-surface dark:bg-surface hover:bg-surface/90 dark:hover:bg-surface/90 text-foreground dark:text-foreground/90 transition-all duration-200"
        >
          {justCopied ? "Copied!" : "Copy"}
        </button>

        <div
          ref={transcriptRef}
          className="overflow-auto p-4 flex flex-col gap-y-4 h-full"
        >
          {transcriptItems.map((item) => {
            const { itemId, type, role, data, expanded, timestamp, title = "", isHidden } = item;

            if (isHidden) {
              return null;
            }

            if (type === "MESSAGE") {
              const isUser = role === "user";
              const baseContainer = "flex justify-end flex-col";
              const containerClasses = `${baseContainer} ${isUser ? "items-end" : "items-start"}`;
              const bubbleBase = `max-w-lg p-3 rounded-lg transition-all duration-200 shadow-md ${
                isUser
                  ? "bg-[#4a4a4a] dark:bg-accent/20 text-white dark:text-white border border-[#2a2a2a] dark:border-accent/20"
                  : "bg-[#4a2a2a]/10 bg-accent/20 text-foreground dark:text-foreground border border-[#C4C4C4] dark:border-[#404040]"
              }`;
              const isBracketedMessage = title.startsWith("[") && title.endsWith("]");
              const messageStyle = isBracketedMessage ? "italic text-muted dark:text-muted" : "";
              const displayTitle = isBracketedMessage ? title.slice(1, -1) : title;

              return (
                <div key={itemId} className={containerClasses}>
                  <div className={bubbleBase}>
                    <div className="text-xs text-muted/5 dark:text-muted font-mono">
                      {timestamp}
                    </div>
                    <div className={`whitespace-pre-wrap ${messageStyle}`}>
                      <ReactMarkdown>{displayTitle}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            } else if (type === "BREADCRUMB") {
              return (
                <div
                  key={itemId}
                  className="flex flex-col justify-start items-start text-muted dark:text-muted text-sm"
                >
                  <span className="text-xs font-mono">{timestamp}</span>
                  <div
                    className={`whitespace-pre-wrap flex items-center font-mono text-sm text-foreground dark:text-foreground/90 ${
                      data ? "cursor-pointer" : ""
                    }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`text-muted dark:text-muted mr-1 transform transition-transform duration-200 select-none font-mono ${
                          expanded ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-foreground dark:text-foreground/90 text-left">
                      <pre className="border-l-2 ml-1 border-[#2a2a2a] dark:border-[#404040] whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            } else {
              return (
                <div
                  key={itemId}
                  className="flex justify-center text-muted dark:text-muted text-sm italic font-mono"
                >
                  Unknown item type: {type}{" "}
                  <span className="ml-2 text-xs">{timestamp}</span>
                </div>
              );
            }
          })}
        </div>
      </div>

      <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-[#acacac] dark:border-[#404040] bg-surface dark:bg-surface">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) {
              onSendMessage();
            }
          }}
          className="flex-1 px-4 py-2 focus:outline-none bg-[#6a6a6a]/10 dark:bg-[#2a2a2a]/20 text-foreground dark:text-foreground rounded-lg border border-[#ACACAC] dark:border-[#404040] focus:border-[#404040] transition-colors duration-200"
          placeholder="Type a message..."
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="bg-primary dark:bg-primary/20 text-white rounded-lg p-2 disabled:opacity-50 transition-all duration-200 hover:bg-primary/90 dark:hover:bg-primary/30"
        >
          <Image 
            src="arrow.svg" 
            alt="Send" 
            width={24} 
            height={24} 
            className="dark:invert"
          />
        </button>
      </div>
    </div>
  );
}

export default Transcript;
