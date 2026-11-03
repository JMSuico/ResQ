// [Layer: Shared]
// Responsibility: Floating tactical emergency dispatch comms modal enabling live inter-agency coordination.
// Zero emojis, 100% Lucide icons standard, strict typing (ZERO any), and universal arrow lambda syntax (=>).

import React, { FC, useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Shield,
  Activity,
  AlertTriangle,
  X,
  Clock,
  Radio,
  CheckCheck
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
      className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden font-mono text-slate-100 animate-in fade-in zoom-in-95 duration-150"
      style={{
        boxShadow: '0 24px 50px -6px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(56, 189, 248, 0.25)'
      }}
      role="dialog"
      aria-label="Tactical Comms Channel"
    >
      {/* Tactical Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/60 text-sky-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>{channelName}</span>
            </h3>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 text-emerald-400" />
              <span>LIVE HUD COMMS &bull; {unitCallsign}</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close tactical chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeIncidentId && (
        <div className="px-3 py-1.5 bg-rose-950/40 border-b border-rose-900/40 text-[10px] text-rose-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0" />
          <span className="truncate">Active Incident Dispatched: #{activeIncidentId}</span>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 bg-slate-900/60">
        {messages.map((msg) => {
          const isOwn = msg.unitCallsign === unitCallsign;
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] rounded-xl p-2.5 text-xs border ${
                msg.isPriority
                  ? 'bg-rose-950/50 border-rose-800/80 text-rose-100'
                  : isOwn
                  ? 'self-end bg-sky-950/50 border-sky-800/80 text-sky-100'
                  : 'self-start bg-slate-950/90 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1 text-[10px] text-slate-400 border-b border-slate-800/60 pb-1">
                <span className="font-bold flex items-center gap-1">
                  {msg.isPriority ? (
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                  ) : (
                    <Shield className="w-2.5 h-2.5 text-sky-400" />
                  )}
                  <span>{msg.unitCallsign || msg.senderName}</span>
                </span>
                <span className="text-[9px] flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{msg.timestamp}</span>
                </span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Tactical Brevity Toolbar */}
      <div className="px-2.5 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {BREVITY_CODES.map((code) => (
          <button
            key={code.label}
            type="button"
            onClick={() => handleApplyBrevity(code.text, code.priority)}
            className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors whitespace-nowrap cursor-pointer ${
              code.priority
                ? 'bg-rose-950/60 border-rose-800/60 text-rose-300 hover:bg-rose-900/60'
                : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {code.label}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSend} className="p-2.5 bg-slate-950 border-t border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type tactical message or dispatch update..."
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition-colors cursor-pointer flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 text-rose-600 bg-slate-900 focus:ring-rose-500"
            />
            <span className={isPriority ? 'text-rose-400 font-bold' : ''}>Flag Priority Code 3</span>
          </label>
          <span className="flex items-center gap-1 text-slate-500">
            <CheckCheck className="w-3 h-3 text-sky-500" />
            <span>Encrypted AES-256</span>
          </span>
        </div>
      </form>
    </div>
  );
};

export default FloatingChatModal;
