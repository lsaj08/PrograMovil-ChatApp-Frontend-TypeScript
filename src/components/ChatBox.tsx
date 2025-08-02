import React, { useState, useRef, useEffect } from "react"; // Importa React y hooks necesarios
import * as signalR from "@microsoft/signalr"; // Cliente SignalR para comunicación en tiempo real
import './Chat.css'; // Importa estilos CSS

const ChatBox: React.FC = () => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null); // Almacena la conexión
  const [messages, setMessages] = useState<string[]>([]); // Historial de mensajes
  const [username, setUsername] = useState(""); // Nombre del usuario
  const [message, setMessage] = useState(""); // Mensaje en curso
  const [isConnected, setIsConnected] = useState(false); // Marca si el usuario está en el chat
  const [isConnecting, setIsConnecting] = useState(false); // Evita conexiones duplicadas
  const [onlineUsers, setOnlineUsers] = useState(0); // Cantidad de usuarios conectados

  const messagesEndRef = useRef<HTMLDivElement | null>(null); // Referencia al final del contenedor de mensajes

  // Desplaza automáticamente hacia abajo cuando llegan nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Conecta al servidor de SignalR
  const startConnection = async () => {
    if (!username || connection || isConnecting) return;

    setIsConnecting(true); // Activar indicador de conexión

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect()
      .build();

    // Manejador de mensajes recibidos
    newConnection.on("ReceiveMessage", (user, receivedMessage) => {
      setMessages((prev) => [...prev, `${user}: ${receivedMessage}`]);
    });

    // Recibir cantidad de usuarios conectados
    newConnection.on("UpdateUserCount", (count) => {
      setOnlineUsers(count);
    });

    try {
      await newConnection.start(); // Inicia conexión
      setConnection(newConnection);
      setIsConnected(true);
    } catch (e) {
      console.error("Error al conectar con SignalR:", e);
    } finally {
      setIsConnecting(false);
    }
  };

  // Envía mensaje al servidor
  const sendMessage = async () => {
    if (connection && message) {
      try {
        await connection.invoke("SendMessage", username, message);
        setMessage(""); // Limpia input
      } catch (e) {
        console.error("Error al enviar mensaje:", e);
      }
    }
  };

  // Devuelve estructura visual
  return (
    <div className="chat-container">
      {!isConnected ? (
        // Pantalla de login
        <div className="chat-login">
          <img src="/logo_ulatina.png" alt="Logo de Universidad Latina" />
          <h1>Curso: Programación Web</h1>
          <p>
            20252-002-BISI05 <br />
            Profesor: Jose Arturo Gracia Rodriguez <br />
            Proyecto Final - Aplicación de Chat v3.2
          </p>
          <h3>Equipo: Pastelito</h3>
          <ul>
            <li>Leiner Arce Jimenez</li>
            <li>Diego Campos Borbon</li>
            <li>Gabriel Barrios Benavides</li>
            <li>Erick Villegas Aragon</li>
          </ul>

          {/* Campo para ingresar el nombre */}
          <h2>Ingresa tu nombre de usuario:</h2>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escribe tu nombre..."
          />

          {/* Botón para iniciar sesión */}
          <br /><br />
          <button
            onClick={startConnection}
            disabled={isConnecting}
            className="btn-chat"
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
        // Pantalla de chat
        <>
          <h2>Bienvenido, {username}</h2>
          <h2>Usuarios en línea: {onlineUsers}</h2>

          <div className="chat-box">
            {messages.map((msg, idx) => {
              const [meta, ...contentParts] = msg.split(":");
              const messageText = contentParts.join(":").trim();
              const userFromMsg = meta.trim();
              const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const isSystem = userFromMsg === "Sistema";
              const isMe = userFromMsg === username;

              // Genera color único por usuario
              const getColorForUser = (name: string) => {
                let hash = 0;
                for (let i = 0; i < name.length; i++) {
                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                return `hsl(${hash % 360}, 70%, 60%)`;
              };

              return (
                <div
                  key={idx}
                  className={`chat-message ${isSystem ? "system" : isMe ? "me" : ""}`}
                >
                  <div className={`chat-meta ${isMe ? "right" : "left"}`}>
                    {isSystem ? (
                      <>
                        <span>🛠 <strong>{userFromMsg}</strong></span>
                        <span>{time}</span>
                      </>
                    ) : (
                      <>
                        {!isMe && (
                          <span
                            className="chat-color-dot"
                            style={{ backgroundColor: getColorForUser(userFromMsg) }}
                          ></span>
                        )}
                        <span><strong>{userFromMsg}</strong></span>
                        <span>{time}</span>
                      </>
                    )}
                  </div>
                  <div>{messageText}</div>
                </div>
              );
            })}

            {/* Referencia para scroll automático al último mensaje */}
            <div ref={messagesEndRef} />
          </div>

          {/* Campo y botón para enviar mensaje */}
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
          />
          <button
            onClick={sendMessage}
            className="btn-chat btn-send"
          >
            Enviar
            <img src="/sent.png" alt="icono enviar" />
          </button>

          {/* Botón para salir del chat */}
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
          >
            <img src="/logout.png" alt="icono logout" />
            Salir del chat
          </button>
        </>
      )}
    </div> // ← Cierre correcto del div contenedor principal
  );
};

export default ChatBox;
