"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  timestamp: Date;
}

interface AgentChatProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  agentStatus: string;
}

export default function AgentChat({ messages, onSendMessage, agentStatus }: AgentChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="bg-gray-800/80 rounded-xl border border-gray-700 flex flex-col h-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-bold text-white">🤖 AI Agent</span>
        <span className="ml-auto text-xs text-gray-500">{agentStatus}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-4">
            Agent is standing by. Give commands like &quot;attack E4&quot; or &quot;focus on resources&quot;
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-200"
              }`}
            >
              {msg.role === "agent" && (
                <span className="text-xs text-purple-400 font-semibold block mb-0.5">🤖 Agent</span>
              )}
              {msg.text}
              <span className="block text-[10px] text-gray-400 mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-gray-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Command your agent..."
          className="flex-1 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export type { ChatMessage };
