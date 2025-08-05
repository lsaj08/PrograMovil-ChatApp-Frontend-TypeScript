// ChatBox.tsx
import React, { useState, useRef, useEffect } from "react";
import * as signalR from "@microsoft/signalr";
import "./Chat.css"; // Estilos globales del chat
import ChatMessageItem from "./ChatMessageItem"; // Componente para renderizar mensajes individuales

// Define el tipo para un mensaje del chat
interface ChatMessage {
  user: string;
  message: string;
  timestamp: string;
}

// Componente principal del chat
const ChatBox: React.FC = () => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll automático al nuevo mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Iniciar conexión con SignalR
  const startConnection = async () => {
    if (!username || connection || isConnecting) return;
    setIsConnecting(true);

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect()
      .build();

    // Evento: mensaje recibido
    newConnection.on("ReceiveMessage", (data) => {
      const { user, message, fechaHoraCostaRica } = data;
      setMessages((prev) => [
        ...prev,
        {
          user,
          message,
          timestamp: fechaHoraCostaRica,
        },
      ]);
    });

    // Evento: actualización de usuarios conectados
    newConnection.on("UpdateUserCount", (count) => {
      setOnlineUsers(count);
    });

    try {
      await newConnection.start();
      setConnection(newConnection);
      setIsConnected(true);
    } catch (e) {
      console.error("Error al conectar con SignalR:", e);
    } finally {
      setIsConnecting(false);
    }
  };

  // Enviar mensaje al servidor
  const sendMessage = async () => {
    if (connection && message) {
      try {
        await connection.invoke("SendMessage", username, message);
        setMessage("");
      } catch (e) {
        console.error("Error al enviar mensaje:", e);
      }
    }
  };

  // Render del componente
  return (
    <div className="chat-container">
      {!isConnected ? (
        <div className="chat-login">
          <img src="/logo_ulatina.png" alt="Logo de Universidad Latina" />
          <h1>Curso: Programación Web</h1>
          <p>
            20252-002-BISI05 <br />
            Profesor: Jose Arturo Gracia Rodriguez <br />
            Proyecto Final - Aplicación de Chat v3.6
          </p>
          <h3>Equipo: Pastelito</h3>
          <ul>
            <li>Leiner Arce Jimenez</li>
            <li>Diego Campos Borbon</li>
            <li>Gabriel Barrios Benavides</li>
            <li>Erick Villegas Aragon</li>
          </ul>

          <h2>Ingresa tu nombre de usuario:</h2>
          <input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escribe tu nombre..."
            autoComplete="username"
          />

          <br /><br />
          <button
            onClick={startConnection}
            disabled={isConnecting}
            className="btn-chat"
            type="button"
          >
            {isConnecting ? (
              <>
                Conectando...
                <span className="spinner"></span>
              </>
            ) : (
              <>
                Entrar al chat
                <img src="/login.png" alt="icono login" />
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          <h1>Bienvenido, {username}</h1>
          <h3>Usuarios en línea: {onlineUsers}</h3>

          <div className="chat-box">
            {/* Renderiza todos los mensajes usando el componente separado */}
            {messages.map((msg, idx) => (
              <ChatMessageItem key={idx} msg={msg} username={username} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Campo de mensaje */}
          <input
            id="message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
            autoComplete="off"
          />

          {/* Botón de envío */}
          <button
            onClick={sendMessage}
            className="btn-chat btn-send"
            type="button"
          >
            Enviar
            <img src="/sent.png" alt="icono enviar" />
          </button>

          {/* Botón de salir */}
          <br /><br />
          <button
            className="btn-chat btn-logout"
            onClick={async () => {
              await connection?.stop();
              setConnection(null);
              setUsername("");
              setIsConnected(false);
              setMessages([]);
            }}
            type="button"
          >
            <img src="/logout.png" alt="icono logout" />
            Salir del chat
          </button>
        </>
      )}
    </div>
  );
};

export default ChatBox;
