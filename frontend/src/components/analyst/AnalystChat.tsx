import { useEffect, useRef } from "react";
import type { ChatMessage } from "./types";
import { AnalystMessage } from "./AnalystMessage";

interface Props {
  messages: ChatMessage[];
}

export function AnalystChat({ messages }: Props) {
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  return (
    <div className="analyst-chat-messages">
      <div ref={topRef} />
      {messages.map((m) => (
        <AnalystMessage key={m.id} message={m} />
      ))}
    </div>
  );
}
