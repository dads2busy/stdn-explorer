import type { ChatMessage } from "./types";
import { AnalystResponseRenderer } from "./AnalystResponseRenderer";

interface Props {
  message: ChatMessage;
}

export function AnalystMessage({ message }: Props) {
  if (message.role === "user") {
    return (
      <div className="analyst-msg analyst-msg-user">
        <div className="analyst-msg-bubble user">{message.displayText}</div>
      </div>
    );
  }

  return (
    <div className="analyst-msg analyst-msg-analyst">
      {message.loading ? (
        <div className="analyst-msg-bubble analyst loading">
          Analyzing data...
        </div>
      ) : message.error ? (
        <div className="analyst-msg-bubble analyst error">
          Error: {message.error}
        </div>
      ) : message.response ? (
        <div className="analyst-msg-bubble analyst">
          <AnalystResponseRenderer response={message.response} />
        </div>
      ) : null}
    </div>
  );
}
