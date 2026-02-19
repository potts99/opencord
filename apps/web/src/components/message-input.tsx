import { useState, useRef } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  channelName?: string;
}

export function MessageInput({ onSend, onTyping, disabled, channelName }: MessageInputProps) {
  const [content, setContent] = useState('');
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;
    onSend(content.trim());
    setContent('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    if (!typingTimeout.current) {
      onTyping();
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      typingTimeout.current = undefined;
    }, 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-6">
      <div className="bg-secondary rounded-lg flex items-center px-4">
        <input
          value={content}
          onChange={handleChange}
          placeholder={`Message #${channelName ?? 'channel'}`}
          disabled={disabled}
          className="flex-1 bg-transparent py-3 text-foreground placeholder-muted-foreground focus:outline-none"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={!content.trim() || disabled}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
