// ChatMessageItem.tsx
import React from "react";

// Interface para representar un mensaje individual
interface ChatMessage {
  user: string;
  message: string;
  timestamp: string;
}

// Props que recibe el componente: mensaje y nombre del usuario actual
interface Props {
  msg: ChatMessage;
  username: string;
}

/**
 * Componente para renderizar un mensaje individual del chat
 * Aplica estilos condicionales dependiendo si el mensaje es del sistema, del usuario actual o de otro usuario
 * Muestra:
 * - Emoji para mensajes del sistema
 * - Círculo de color + nombre para usuarios
 */
const ChatMessageItem: React.FC<Props> = ({ msg, username }) => {
  const { user, message, timestamp } = msg;

  // Verifica si el timestamp es válido y lo convierte a formato hora local
  const date = new Date(timestamp);
  const isValidDate = !isNaN(date.getTime());

  const time = isValidDate
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
    : "--:--";

  // Determina el tipo de mensaje
  const isSystem = user === "Sistema";
  const isMe = user === username;

  /**
   * Genera un color único basado en el nombre del usuario
   * Se usa para colorear el texto y el círculo del usuario
   */
  const getColorForUser = (name?: string) => {
    if (!name) return "#999";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 70%, 60%)`;
  };

  /**
   * Determina el color de fondo del mensaje según el tipo
   */
  const backgroundColor = isMe
    ? "#e0f7ff"     // Azul claro si soy yo
    : isSystem
    ? "#f0f0f0"     // Gris si es el sistema
    : "#fffbe6";    // Crema claro si es otro usuario

  /**
   * Retorna un emoji según el contenido del mensaje del sistema
   */
  const getSystemEmoji = (msg: string): string => {
    if (msg.includes("conectado")) return "🤖";
    if (msg.includes("desconectado")) return "❌";
    if (msg.includes("Bienvenido")) return "👋";
    return "ℹ️";
  };

  return (
    <div
      style={{
        backgroundColor,
        padding: "8px 12px",
        margin: "6px 0",
        borderRadius: "8px",
        textAlign: isMe ? "right" : "left",
        border: isSystem ? "1px dashed #aaa" : "none",
      }}
    >
      {/* Cabecera del mensaje: usuario + hora + emoji o círculo */}
      <div
        style={{
          fontSize: "0.85em",
          color: "#666",
          display: "flex",
          alignItems: "center",
          justifyContent: isMe ? "flex-end" : "flex-start",
          gap: 8,
        }}
      >
        {isSystem ? (
          <>
            {/* Emoji para el sistema */}
            <span style={{ fontSize: "1.1em" }}>{getSystemEmoji(message)}</span>
            <span style={{ fontWeight: 600 }}>{user}</span>
          </>
        ) : (
          <>
            {/* Círculo de color por usuario */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: getColorForUser(user),
              }}
            ></div>
            {/* Nombre del usuario en color */}
            <span style={{ color: getColorForUser(user), fontWeight: 600 }}>
              {user}
            </span>
          </>
        )}
        {/* Hora del mensaje */}
        <span>{time}</span>
      </div>

      {/* Contenido del mensaje */}
      <div style={{ fontSize: "1em", fontWeight: isSystem ? 500 : 400 }}>
        {message}
      </div>
    </div>
  );
};

export default ChatMessageItem;
