import React, { useEffect, useState } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import ChatMessageItem, { ChatMessage } from "./ChatMessageItem";

// 🎯 Componente principal del chat
const ChatBox: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<any>(null);
  const [messageInput, setMessageInput] = useState("");
  const [username, setUsername] = useState("Estudiante");

  // 🔌 Conexión a SignalR
  useEffect(() => {
    const newConnection = new HubConnectionBuilder()
      .withUrl("/chatHub?username=" + username)
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    return () => {
      newConnection.stop();
    };
  }, [username]);

  // 🧠 Eventos de conexión
  useEffect(() => {
    if (!connection) return;

    connection
      .start()
      .then(() => {
        console.log("✅ Conectado a SignalR");

        connection.on("ReceiveMessage", (data) => {
          const { user, message, fechaHoraCostaRica } = data;

          if (!user || !message || !fechaHoraCostaRica) {
            console.warn("⚠️ Mensaje inválido recibido:", data);
            return;
          }

          setMessages((prev) => [
            ...prev,
            {
              user,
              message,
              timestamp: fechaHoraCostaRica,
            },
          ]);
        });

        connection.on("UpdateUserCount", (count) => {
          console.log(`Usuarios conectados: ${count}`);
        });
      })
      .catch((err) => console.error("❌ Error al conectar:", err));
  }, [connection]);

  // 🚀 Enviar mensaje
  const handleSend = async () => {
    if (messageInput.trim() === "" || !connection) return;

    try {
      await connection.invoke("SendMessage", username, messageInput);
      setMessageInput("");
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h3>Chat en tiempo real</h3>
      <div
        style={{
          height: "300px",
          overflowY: "auto",
          border: "1px solid #ddd",
          padding: "10px",
          borderRadius: "8px",
          background: "#fafafa",
        }}
      >
        {messages.map((msg, idx) => (
          <ChatMessageItem key={idx} msg={msg} username={username} />
        ))}
      </div>

      <div style={{ marginTop: "10px", display: "flex" }}>
        <input
          type="text"
          placeholder="Escribe un mensaje..."
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          style={{ flex: 1, padding: "8px" }}
        />
        <button
          onClick={handleSend}
          style={{
            marginLeft: "10px",
            background: "#00bfff",
            color: "white",
            padding: "8px 12px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
