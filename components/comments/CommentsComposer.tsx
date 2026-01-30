import React, { useRef, useEffect, useState } from "react";

interface CommentsComposerProps {
  canPost: boolean;
  submitting: boolean;
  onSubmit: (body: string) => void | Promise<void>;
  replyTarget: { id: string; author: string } | null;
  onCancelReply: () => void;
  autoFocusToken: number;
  placeholder?: string;
}

const CommentsComposer = React.memo(
  ({
    canPost,
    submitting,
    onSubmit,
    replyTarget,
    onCancelReply,
    autoFocusToken,
    placeholder = "Write a comment...",
  }: CommentsComposerProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const draftRef = useRef<string>("");
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
      if (autoFocusToken > 0) {
        const timer = window.setTimeout(() => {
          textareaRef.current?.focus();
          textareaRef.current?.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length
          );
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [autoFocusToken]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      draftRef.current = e.target.value;
      setLocalError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const raw = textareaRef.current?.value ?? draftRef.current;
      const body = raw.trim();

      if (!body) {
        setLocalError("Comment cannot be empty");
        return;
      }

      if (body.length > 2000) {
        setLocalError("Comment too long (max 2000 characters)");
        return;
      }

      try {
        await onSubmit(body);
        draftRef.current = "";
        if (textareaRef.current) {
          textareaRef.current.value = "";
        }
        setLocalError(null);
      } catch {
        setLocalError("Failed to post comment. Please try again.");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    };

    return (
      <div className="comments-composer">
        {replyTarget && (
          <div className="reply-indicator">
            Replying to {replyTarget.author}
            <button type="button" onClick={onCancelReply} aria-label="Cancel reply">
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            defaultValue=""
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={submitting}
            aria-label="Write a comment"
            style={{
              touchAction: "manipulation",
              fontSize: "16px",
              WebkitUserSelect: "text",
            }}
          />

          {localError && (
            <div className="error-message" role="alert">
              {localError}
            </div>
          )}

          <div className="composer-actions">
            <button type="submit" disabled={!canPost || submitting} aria-label="Post comment">
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      </div>
    );
  }
);

CommentsComposer.displayName = "CommentsComposer";

export default CommentsComposer;
