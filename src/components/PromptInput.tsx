import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
interface PromptTemplate {
  label: string;
  prompt: string;
}
interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  placeholder?: string;
  templates?: PromptTemplate[];
  isSubmitting?: boolean;
}
export function PromptInput({
  onSubmit,
  placeholder = 'Ask Zolt AI...',
  templates = [],
  isSubmitting = false
}: PromptInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value);
      setValue('');
    }
  };
  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {/* Templates */}
      {templates.length > 0 &&
      <div className="flex flex-wrap gap-2 mb-2">
          {templates.map((t, i) =>
        <button
          key={i}
          onClick={() => setValue(t.prompt)}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 transition-colors flex items-center">

              <Sparkles className="w-3 h-3 mr-1.5 text-emerald-500" />
              {t.label}
            </button>
        )}
        </div>
      }

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="relative group">
        <div
          className={cn(
            'absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl opacity-0 transition duration-300 blur',
            isFocused && 'opacity-20'
          )} />

        <div className="relative flex items-center bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="w-full bg-transparent text-slate-200 placeholder-slate-500 px-4 py-4 focus:outline-none text-sm md:text-base"
            disabled={isSubmitting} />

          <button
            type="submit"
            disabled={!value.trim() || isSubmitting}
            className="mr-2 p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all">

            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>);

}