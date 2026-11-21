// [Layer: Shared]
// Responsibility: Floating tactical emergency dispatch comms modal enabling live inter-agency coordination.
// Zero emojis, 100% Lucide icons standard, strict typing (ZERO any), and universal arrow lambda syntax (=>).

import React, { FC, useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Shield,
  Activity,
  AlertTriangle,
  X,
  Clock,
  Radio
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: 'ADMIN' | 'RESPONDER' | 'DISPATCHER';
  unitCallsign?: string;
  timestamp: string;
  content: string;
  isPriority?: boolean;
}

export interface FloatingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName?: string;
  unitCallsign?: string;
  activeIncidentId?: string;
  initialMessages?: ChatMessage[];
  onSendMessage?: (message: string, isPriority: boolean) => Promise<void> | void;
}

const BREVITY_CODES: { label: string; text: string; priority?: boolean }[] = [
  { label: '10-4 ACK', text: '10-4 Message received and acknowledged.' },
  { label: '10-20 EN ROUTE', text: '10-20 Unit responding en route with sirens.' },
  { label: 'CODE 3 URGENT', text: 'Code 3: Critical on-scene escalation, immediate backup requested.', priority: true },
  { label: 'ON SCENE', text: 'Unit arrived on scene. Establishing operational perimeter.' }
];

export const FloatingChatModal: FC<FloatingChatModalProps> = ({
  isOpen,
  onClose,
  channelName = 'LDRRMO Dispatch Grid',
  unitCallsign = 'KATIPUNAN-ALPHA-1',
  activeIncidentId,
  initialMessages,
  onSendMessage
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages || [
    {
      id: 'msg-seed-1',
      senderName: 'LDRRMO Central Dispatch',
      senderRole: 'DISPATCHER',
      unitCallsign: 'HQ-KATIPUNAN',
      timestamp: 'Just now',
      content: 'Comms link established on secure tactical frequency. Standby for telemetry updates.',
      isPriority: false
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isPriority, setIsPriority] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, scrollToBottom]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    setIsSending(true);
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: unitCallsign,
      senderRole: 'RESPONDER',
      unitCallsign,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: trimmed,
      isPriority
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setIsPriority(false);

    try {
      if (onSendMessage) {
        await onSendMessage(trimmed, isPriority);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyBrevity = (text: string, priority = false) => {
    setInputText(text);
    if (priority) setIsPriority(true);
  };

  return (
    <div
      className="clay-surface fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] flex flex-col rounded-2xl bg-[#F7F1EA] border border-[#E9D9D0] overflow-hidden font-mono text-[#3B1722] animate-in fade-in zoom-in-95 duration-150"
      style={{
        boxShadow: '0 24px 50px -8px rgba(103, 6, 38, 0.28), inset 0 2px 4px rgba(255, 255, 255, 0.9)'
      }}
      role="dialog"
      aria-label="Tactical Comms Channel"
    >
      {/* Tactical Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#EFE5DC] border-b border-[#E9D9D0]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#670626]/12 border border-[#A83B4D]/40 text-[#670626]">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-[#670626] flex items-center gap-1.5">
              <span>Comms &middot; {unitCallsign}</span>
            </h3>
            <span className="text-xs text-[#7A4E59] flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-700" />
              <span>{channelName}</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#7A4E59] hover:text-[#670626] hover:bg-[#E9D9D0] transition-colors cursor-pointer"
          aria-label="Close tactical chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeIncidentId && (
        <div className="px-3 py-1.5 bg-rose-50 border-b border-rose-200 text-xs font-bold text-[#991B1B] flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-[#991B1B] flex-shrink-0" />
          <span className="truncate">Incident #{activeIncidentId}</span>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 bg-[#F7F1EA]">
        {messages.map((msg) => {
          const isOwn = msg.unitCallsign === unitCallsign;
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] rounded-xl p-2.5 text-sm border ${
                msg.isPriority
                  ? 'bg-rose-50 border-rose-300 text-[#991B1B]'
                  : isOwn
                  ? 'self-end bg-[#670626] border-[#670626] text-[#F7F1EA]'
                  : 'self-start bg-[#E9D9D0]/75 border-[#D8C1B5] text-[#3B1722]'
              }`}
            >
              <div className={`flex items-center justify-between gap-2 mb-1 text-xs border-b pb-1 ${
                isOwn && !msg.isPriority ? 'text-[#E9D9D0] border-white/20' : 'text-[#7A4E59] border-[#D8C1B5]'
              }`}>
                <span className="font-bold flex items-center gap-1">
                  {msg.isPriority ? (
                    <AlertTriangle className="w-3 h-3 text-[#991B1B]" />
                  ) : (
                    <Shield className={`w-3 h-3 ${isOwn ? 'text-[#F7F1EA]' : 'text-[#670626]'}`} />
                  )}
                  <span>{msg.unitCallsign || msg.senderName}</span>
                </span>
                <span className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{msg.timestamp}</span>
                </span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap break-words text-sm">{msg.content}</p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Tactical Brevity Toolbar */}
      <div className="px-2.5 py-2 bg-[#EFE5DC] border-t border-[#E9D9D0] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {BREVITY_CODES.map((code) => (
          <button
            key={code.label}
            type="button"
            onClick={() => handleApplyBrevity(code.text, code.priority)}
            className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
              code.priority
                ? 'bg-rose-100 border-rose-300 text-[#991B1B] hover:bg-rose-200'
                : 'bg-[#F7F1EA] border-[#D4B8AA] text-[#670626] hover:bg-[#E9D9D0]'
            }`}
          >
            {code.label}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSend} className="p-2.5 bg-[#EFE5DC]/85 border-t border-[#E9D9D0] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type message..."
            className="flex-1 px-3 py-2 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#3B1722] text-sm placeholder:text-[#9B727D] focus:outline-none focus:ring-2 focus:ring-[#A83B4D]/30 focus:border-[#670626]"
          />
          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            className="p-2.5 rounded-xl bg-[#670626] hover:bg-[#7D0A30] disabled:opacity-50 text-[#F7F1EA] transition-colors cursor-pointer flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-[#7A4E59]">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#D4B8AA] accent-[#991B1B]"
            />
            <span className={isPriority ? 'text-[#991B1B] font-bold' : ''}>Priority Flag</span>
          </label>
        </div>
      </form>
    </div>
  );
};

export default FloatingChatModal;
