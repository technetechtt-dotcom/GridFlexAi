import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Copy,
  ArrowRight } from
'lucide-react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport, type UIMessage } from 'ai';
import { cn } from '../lib/utils';
import { Page } from '../components/Sidebar';
import { useRealTime } from '../context/RealTimeContext';
import { buildForecastProfilesFromNodes, getAuthToken } from '../services/api';
interface AIPromptInterfaceProps {
  onNavigate: (page: Page) => void;
}

const API_BASE_URL =
(import.meta.env.VITE_API_BASE_URL as string | undefined) ??
'http://localhost:4000/api';

const extractMessageText = (message: UIMessage): string => {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const textParts = parts
    .map((part) => {
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
        return typeof part.text === 'string' ? part.text : '';
      }
      return '';
    })
    .join('\n')
    .trim();

  return textParts;
};

const inferAction = (
content: string)
: {
  label: string;
  page: Page;
} | undefined => {
  const lower = content.toLowerCase();
  if (lower.includes('hydrogen') || lower.includes('electrolyzer') || lower.includes('hyshift')) {
    return {
      label: 'Open HyShift Control',
      page: 'hyshift'
    };
  }
  if (lower.includes('congestion') || lower.includes('forecast') || lower.includes('weather')) {
    return {
      label: 'View Forecast',
      page: 'congestion'
    };
  }
  if (lower.includes('dispatch') || lower.includes('battery')) {
    return {
      label: 'Open Dispatch',
      page: 'dispatch'
    };
  }
  if (lower.includes('curtailment') || lower.includes('recover') || lower.includes('spill')) {
    return {
      label: 'Open Curtailment',
      page: 'curtailment-detail'
    };
  }
  if (lower.includes('insight')) {
    return {
      label: 'Review AI Insights',
      page: 'ai-insights'
    };
  }
  return undefined;
};

const normalizeErrorMessage = (error: Error | undefined): string | null => {
  if (!error?.message) return null;
  const trimmed = error.message.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as {message?: unknown;};
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Keep original message when error body is not JSON.
  }

  return trimmed;
};

export function AIPromptInterface({ onNavigate }: AIPromptInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { availableNodeNames, selectedNodeNames, toggleSelectedNode, backendNodes } = useRealTime();
  const transport = useMemo(
    () =>
    new TextStreamChatTransport({
      api: `${API_BASE_URL}/ai/chat`,
      credentials: 'include',
      headers: () => {
        const token = getAuthToken();
        const requestHeaders: Record<string, string> = {};
        if (token) {
          requestHeaders.Authorization = `Bearer ${token}`;
        }
        return requestHeaders;
      }
    }),
    []
  );

  const {
    messages,
    sendMessage,
    status,
    error } =
  useChat({
    transport
  });
  const errorMessage = normalizeErrorMessage(error);
  const isAiOfflineError = Boolean(
    errorMessage &&
    (
      errorMessage.includes('OPENAI_API_KEY') ||
      errorMessage.toLowerCase().includes('service unavailable') ||
      errorMessage.includes('503'))
  );

  const isTyping = status === 'submitted' || status === 'streaming';
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectedNodesSummary = selectedNodeNames.includes('All Nodes') ? 'All Nodes' : selectedNodeNames.join(', ');
  const scopedProfiles = useMemo(
    () => buildForecastProfilesFromNodes(backendNodes, selectedNodeNames),
    [backendNodes, selectedNodeNames]
  );
  const handleSend = async (
  e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const toSend = input;
    setInput('');
    await sendMessage({
      text: toSend
    }, {
      body: {
        context:
        `Selected node scope: ${selectedNodesSummary}\n` +
        `Selected node profiles: ${scopedProfiles.map((profile) => `${profile.name}${profile.id ? ` [id: ${profile.id}]` : ''} (${profile.lat}, ${profile.lon}) capacity ${profile.capacity}kW`).join('; ')}`
      }
    });
  };
  const templates = [
  {
    category: 'Congestion',
    text: 'Predict grid congestion at {node} for next {hours} hours given current weather: solar irradiance {value} W/m²'
  },
  {
    category: 'Dispatch',
    text: 'Optimize dispatch for {plant} considering battery SOC at {value}%, grid demand {value} MW'
  },
  {
    category: 'Scenario',
    text: 'Simulate impact of adding {value} MWh battery storage at {location} on annual curtailment'
  },
  {
    category: 'HyShift',
    text: 'Optimize electrolyzer load schedule for {plant} given {hours}-hour congestion forecast'
  },
  {
    category: 'AI Native',
    text: 'Run multivariate forecast (solar + wind + load) with 80% confidence intervals for Free State'
  },
  {
    category: 'Weather AI',
    text: 'How will extreme weather in Free State impact tomorrow evening demand surge risk?'
  },
  {
    category: 'South Africa',
    text: 'Estimate load-shedding risk from Eskom trend signals and recommend proactive battery strategy'
  },
  {
    category: 'HyShift',
    text: "Optimize electrolyzer schedule for tomorrow's 92% congestion risk at Upington"
  },
  {
    category: 'HyShift',
    text: 'What is the expected LCOH if we capture 80% of curtailed energy at Prieska?'
  }];

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-6 p-6 pb-20">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <Bot className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">
                Zolt AI
              </h3>
              <p className="text-xs text-slate-400">
                Powered by LLM & Grid Physics Engine
              </p>
              <p className="text-xs text-cyan-400 mt-1">
                Node scope: {selectedNodesSummary}
              </p>
            </div>
          </div>
          <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-pulse" />
            Online
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/30">
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">Shared node scope</p>
                <p className="text-xs text-slate-400">This selection is shared with Dashboard and Curtailment.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableNodeNames.map((nodeName) =>
                <button
                  key={nodeName}
                  onClick={() => toggleSelectedNode(nodeName)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${selectedNodeNames.includes(nodeName) ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                  {nodeName}
                </button>
                )}
              </div>
            </div>
          </div>
          {messages.length === 0 &&
          <motion.div
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="flex space-x-3 max-w-3xl">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-emerald-500/10 text-emerald-500">
                <Bot className="w-5 h-5" />
              </div>
              <div className="p-4 rounded-2xl text-sm leading-relaxed shadow-sm bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none">
                Hello! I am Zolt AI. Ask about congestion, dispatch, forecast risk, node health, or curtailment trends.
              </div>
            </motion.div>
          }
          {messages.map((msg) => {
            const content = extractMessageText(msg);
            const action = msg.role === 'assistant' ? inferAction(content) : undefined;
            return (
          <motion.div
            key={msg.id}
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className={cn(
              'flex space-x-3 max-w-3xl',
              msg.role === 'user' ?
              'ml-auto flex-row-reverse space-x-reverse' :
              ''
            )}>

              <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1',
                msg.role === 'assistant' ?
                'bg-emerald-500/10 text-emerald-500' :
                'bg-slate-700 text-slate-300'
              )}>

                {msg.role === 'assistant' ?
              <Bot className="w-5 h-5" /> :

              <User className="w-5 h-5" />
              }
              </div>
              <div
              className={cn(
                'p-4 rounded-2xl text-sm leading-relaxed shadow-sm',
                msg.role === 'assistant' ?
                'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none' :
                'bg-emerald-600 text-white rounded-tr-none'
              )}>

                <div className="whitespace-pre-wrap">{content}</div>
                {action &&
              <button
                onClick={() => onNavigate(action.page)}
                className="mt-3 flex items-center text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-lg transition-colors border border-emerald-500/20">

                    {action.label} <ArrowRight className="w-3 h-3 ml-1.5" />
                  </button>
              }
                <div
                className={cn(
                  'text-[10px] mt-2 opacity-50',
                  msg.role === 'user' ? 'text-emerald-100' : 'text-slate-500'
                )}>
                  {msg.role === 'assistant' ? 'Zolt AI' : 'You'}
                </div>
              </div>
            </motion.div>
          );})}
          {isAiOfflineError &&
          <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 space-y-1">
              <p className="font-medium text-amber-100">Zolt AI offline: backend key missing</p>
              <p>
                Add <code className="text-amber-100">OPENAI_API_KEY</code> in
                <code className="ml-1 text-amber-100">backend/.env</code>, then restart backend.
              </p>
            </div>
          }
          {errorMessage && !isAiOfflineError &&
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          }
          {isTyping &&
          <div className="flex space-x-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl rounded-tl-none flex items-center space-x-1">
                <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{
                  animationDelay: '0ms'
                }} />

                <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{
                  animationDelay: '150ms'
                }} />

                <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{
                  animationDelay: '300ms'
                }} />

              </div>
            </div>
          }
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-slate-800 border-t border-slate-700">
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or describe a scenario..."
              className="w-full bg-slate-900 text-slate-200 placeholder-slate-500 px-4 py-3 pr-12 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all" />

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-2 p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">

              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Templates Sidebar */}
      <div className="w-80 hidden lg:flex flex-col space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex-1 overflow-y-auto">
          <div className="flex items-center space-x-2 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold text-slate-100">Prompt Templates</h3>
          </div>

          <div className="space-y-4">
            {templates.map((t, i) =>
            <div key={i} className="group">
                <div className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                  {t.category}
                </div>
                <button
                onClick={() => setInput(t.text)}
                className="w-full text-left bg-slate-900/50 hover:bg-slate-700 border border-slate-700/50 hover:border-emerald-500/30 p-3 rounded-lg text-xs text-slate-300 transition-all group-hover:shadow-lg relative">

                  {t.text.split(/(\{.*?\})/).map((part, j) =>
                part.startsWith('{') ?
                <span key={j} className="text-cyan-400 font-medium">
                        {part}
                      </span> :

                part

                )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Copy className="w-3 h-3 text-slate-400" />
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>);

}
