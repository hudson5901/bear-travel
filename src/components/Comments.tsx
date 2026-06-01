"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Send } from "lucide-react";

interface Comment {
  id: string;
  text: string;
  name: string;
  timestamp: number;
}

export function Comments({ experienceSlug }: { experienceSlug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");

  const storageKey = `comments_${experienceSlug}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setComments(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, [storageKey]);

  const addComment = () => {
    if (!text.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text.trim(),
      name: name.trim() || "Anonymous",
      timestamp: Date.now(),
    };
    const updated = [newComment, ...comments];
    setComments(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setText("");
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="mt-8">
      <h2 className="font-heading text-xl font-semibold text-navy mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5" />
        Comments ({comments.length})
      </h2>

      {/* Comment form */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full px-3 py-2 mb-2 bg-cream border border-cream-dark rounded-lg text-navy text-sm placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/50"
        />
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts about this experience..."
            rows={2}
            className="flex-1 px-3 py-2 bg-cream border border-cream-dark rounded-lg text-navy text-sm placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/50 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addComment();
              }
            }}
          />
          <button
            onClick={addComment}
            disabled={!text.trim()}
            className="self-end px-4 py-2 bg-orange hover:bg-orange-light disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-navy/40 text-sm text-center py-4">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-navy">{c.name}</span>
                <span className="text-xs text-navy/40">{formatTime(c.timestamp)}</span>
              </div>
              <p className="text-sm text-navy/70">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
