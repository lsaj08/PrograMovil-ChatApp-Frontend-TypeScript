// ChatMessageItem.tsx
import React from "react";

interface ChatMessage {
  user: string;
  message: string;
  timestamp: string;
}

interface Props {
  msg: ChatMessage;
  username: string;
}

/**
 * Componente para renderizar un mensaje individual del chat
 * Aplica estilos condicionales dependiendo si el mensaje es del sistema o del usuario actual
 */
const ChatMessageItem: React.FC<Props> = ({ msg, username }) => {
  const { user, message, timestamp } = msg;

  const date = new Date(timestamp);
  const isValidDate = !isNaN(date.getTime());

  const time = isValidDate
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
    : "--:--";

  const isSystem = user === "Sistema";
  const isMe = user === username;

  // Color único por usuario
  const getColorForUser = (name?: string) => {
    if (!name) return "#999";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 70%, 60%)`;
  };

  return (
    <div
      style={{
        backgroundColor: isMe ? "#e0f7ff" : isSystem ? "#f0f0f0" : "#ffffff",
        padding: "8px 12px",
        margin: "6px 0",
        borderRadius: "8px",
        textAlign: isMe ? "right" : "left",
        border: isSystem ? "1px dashed #aaa" : "none",
      }}
    >
        <div style={{ fontSize: "0.85em", color: "#666" }}>
        <span
            style={{
            color: isSystem ? "#666" : getColorForUser(user),
            fontWeight: 600,
            }}
        >
            {user}
        </span>
        <span style={{ marginLeft: 8 }}>{time}</span>
        </div>
      <div style={{ fontSize: "1em", fontWeight: isSystem ? 500 : 400 }}>{message}</div>
    </div>
  );
};

export default ChatMessageItem;
