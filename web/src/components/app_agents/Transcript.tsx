'use-client';

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { TranscriptItem } from '@/types';
import { useTranscript } from '@/contexts/TranscriptContext';
// Inline icons to avoid external @radix-ui/react-icons dependency
const IconDownload = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);
const IconClipboard = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4">
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);
import { GuardrailChip } from './GuardrailChip';

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
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

  // Autofocus on text box input on load
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
      console.error('Failed to copy transcript:', error);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white min-h-0 rounded-xl">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 text-base border-b bg-white rounded-t-xl">
          <span className="font-semibold">Transcript</span>
          <div className="flex gap-x-2">
            <button
              onClick={handleCopyTranscript}
              className="w-24 text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-x-1">
              <IconClipboard />
              {justCopied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={downloadRecording}
              className="w-40 text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-x-1">
              <IconDownload />
              <span>Download Audio</span>
            </button>
          </div>
        </div>

        {/* Transcript Content */}
        <div
          ref={transcriptRef}
          className="overflow-auto p-4 flex flex-col gap-y-4 h-full">
          {[...transcriptItems]
            .sort((a, b) => a.createdAtMs - b.createdAtMs)
            .map((item) => {
              const {
                itemId,
                type,
                role,
                data,
                expanded,
                timestamp,
                title = '',
                isHidden,
                guardrailResult,
              } = item;

              if (isHidden) {
                return null;
              }

              if (type === 'MESSAGE') {
                const isUser = role === 'user';
                const containerClasses = `flex justify-end flex-col ${
                  isUser ? 'items-end' : 'items-start'
                }`;
                const bubbleBase = `max-w-lg p-3 ${
                  isUser
                    ? 'bg-gray-900 text-gray-100'
                    : 'bg-gray-100 text-black'
                }`;
                const isBracketedMessage =
                  title.startsWith('[') && title.endsWith(']');
                const messageStyle = isBracketedMessage
                  ? 'italic text-gray-400'
                  : '';
                const displayTitle = isBracketedMessage
                  ? title.slice(1, -1)
                  : title;

                return (
                  <div key={itemId} className={containerClasses}>
                    <div className="max-w-lg">
                      <div
                        className={`${bubbleBase} rounded-t-xl ${
                          guardrailResult ? '' : 'rounded-b-xl'
                        }`}>
                        <div
                          className={`text-xs ${
                            isUser ? 'text-gray-400' : 'text-gray-500'
                          } font-mono`}>
                          {timestamp}
                        </div>
                        <div className={`whitespace-pre-wrap ${messageStyle}`}>
                          <ReactMarkdown>{displayTitle}</ReactMarkdown>
                        </div>
                      </div>
                      {guardrailResult && (
                        <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
                          <GuardrailChip guardrailResult={guardrailResult} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else if (type === 'BREADCRUMB') {
                return (
                  <div
                    key={itemId}
                    className="flex flex-col justify-start items-start text-gray-500 text-sm">
                    <span className="text-xs font-mono">{timestamp}</span>
                    <div
                      className={`whitespace-pre-wrap flex items-center font-mono text-sm text-gray-800 ${
                        data ? 'cursor-pointer' : ''
                      }`}
                      onClick={() =>
                        data && toggleTranscriptItemExpand(itemId)
                      }>
                      {data && (
                        <span
                          className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${
                            expanded ? 'rotate-90' : 'rotate-0'
                          }`}>
                          ▶
                        </span>
                      )}
                      {title}
                    </div>
                    {expanded && data && (
                      <div className="text-gray-800 text-left">
                        <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              } else {
                // Fallback if type is neither MESSAGE nor BREADCRUMB
                return (
                  <div
                    key={itemId}
                    className="flex justify-center text-gray-500 text-sm italic font-mono">
                    Unknown item type: {type}{' '}
                    <span className="ml-2 text-xs">{timestamp}</span>
                  </div>
                );
              }
            })}
        </div>
      </div>

      <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-gray-200">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSend) {
              onSendMessage();
            }
          }}
          className="flex-1 px-4 py-2 focus:outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="bg-gray-900 text-white rounded-full px-2 py-2 disabled:opacity-50">
          <img src="/arrow.svg" alt="Send" width={24} height={24} />
        </button>
      </div>
    </div>
  );
}

export default Transcript;
