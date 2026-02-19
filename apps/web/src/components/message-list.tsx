import { useRef, useEffect, useState } from 'react';
import type { Message } from '@opencord/shared';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { getInitials, hashColor } from '@/lib/utils';
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
  currentUserId?: string;
  onEditMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export function MessageList({
  messages, hasMore, onLoadMore, isLoading,
  currentUserId, onEditMessage, onDeleteMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sortedMessages = [...messages].reverse();

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const submitEdit = () => {
    if (editingId && editContent.trim() && onEditMessage) {
      onEditMessage(editingId, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  return (
    <ScrollArea className="flex-1">
      <div className="px-4 py-4">
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="text-sm text-primary hover:text-primary/80"
            >
              {isLoading ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {sortedMessages.map((msg, i) => {
          const prevMsg = i > 0 ? sortedMessages[i - 1] : null;
          const showHeader = !prevMsg || prevMsg.authorId !== msg.authorId ||
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;

          const authorName = msg.author?.displayName ?? 'Unknown';
          const isOwn = currentUserId === msg.authorId;
          const isEditing = editingId === msg.id;

          return (
            <div
              key={msg.id}
              className={`group flex gap-4 px-2 py-0.5 hover:bg-accent/30 rounded ${
                showHeader ? 'mt-4' : ''
              }`}
            >
              {showHeader ? (
                <Avatar className="size-8">
                  <AvatarImage src={msg.author?.avatarUrl ?? undefined} alt={authorName} />
                  <AvatarFallback style={{ backgroundColor: hashColor(authorName) }} className="text-white text-xs">
                    {getInitials(authorName)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8" />
              )}
              <div className="flex-1 min-w-0">
                {showHeader && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-foreground">
                      {authorName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {isEditing ? (
                  <div className="flex flex-col gap-1">
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="bg-secondary rounded px-2 py-1 text-foreground focus:outline-none"
                      autoFocus
                    />
                    <span className="text-xs text-muted-foreground">
                      Enter to save &middot; Escape to cancel
                    </span>
                  </div>
                ) : (
                  <p className="text-foreground/80 break-words">
                    {msg.content}
                    {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                      <span className="text-xs text-muted-foreground ml-1">(edited)</span>
                    )}
                  </p>
                )}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt=""
                    className="mt-2 max-w-md max-h-80 rounded-lg"
                  />
                )}
              </div>

              {isOwn && !isEditing && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start pt-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEdit(msg)}>
                        <Pencil className="size-4" />
                        Edit Message
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(msg.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete Message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget && onDeleteMessage) {
                  onDeleteMessage(deleteTarget);
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
