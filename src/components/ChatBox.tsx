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

  // Hace scroll automático hacia el último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Establece la conexión con SignalR
  const startConnection = async () => {
    if (!username || connection || isConnecting) return;
    setIsConnecting(true);

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect()
      .build();

    // Maneja los mensajes recibidos del servidor
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

    // Actualiza el número de usuarios conectados
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

  // Envía un mensaje al servidor
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

  // Renderizado del componente
  return (
    <div className="chat-container">
      {/* Si no está conectado, se muestra la pantalla de login */}
      {!isConnected ? (
        <div className="chat-login">
          <img src="/logo_ulatina.png" alt="Logo de Universidad Latina" />
          <h1>Curso: Programación Web</h1>
          <p>
            20252-002-BISI05 <br />
            Profesor: Jose Arturo Gracia Rodriguez <br />
            Proyecto Final - Aplicación de Chat <br />
            Nombre del App: Talkao <br /><br />
            <img src="/Talkao.png" alt="talkao logo" />
          </p>

          <ul>
            <h3>Integrantes</h3>
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

          {/* Contenedor del chat */}
          <div className="chat-box">
            {messages.map((msg, idx) => (
              <ChatMessageItem key={idx} msg={msg} username={username} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Campo de entrada y botón de enviar centrados */}
          <div className="message-input-wrapper">
            <input
              id="message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribe un mensaje..."
              autoComplete="off"
            />

            <button
              onClick={sendMessage}
              className="btn-chat btn-send"
              type="button"
            >
              Enviar
              <img src="/sent.png" alt="icono enviar" />
            </button>
          </div>

          {/* Botón de cerrar sesión centrado */}
          <div className="logout-wrapper">
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
          </div>
        </>
      )}
    </div>
  );
};

export default ChatBox;
