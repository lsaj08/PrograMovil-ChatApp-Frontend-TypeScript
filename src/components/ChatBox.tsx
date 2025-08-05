import React, { useState, useRef, useEffect } from "react"; // Importa React y hooks necesarios
import * as signalR from "@microsoft/signalr"; // Cliente SignalR para comunicación en tiempo real
import './Chat.css'; // Importa estilos CSS personalizados

// Componente principal del chat
const ChatBox: React.FC = () => {
  // Estado para almacenar la conexión actual con SignalR
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  // Lista de mensajes recibidos
  interface ChatMessage {
  user: string;
  message: string;
  timestamp: string;
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);


  // Estado del nombre de usuario ingresado
  const [username, setUsername] = useState("");

  // Estado del mensaje actual que está escribiendo el usuario
  const [message, setMessage] = useState("");

  // Indica si el usuario ya está conectado al chat
  const [isConnected, setIsConnected] = useState(false);

  // Estado para evitar conexiones múltiples simultáneas
  const [isConnecting, setIsConnecting] = useState(false);

  // Número de usuarios en línea
  const [onlineUsers, setOnlineUsers] = useState(0);

  // Referencia al final del contenedor de mensajes, usada para hacer scroll automático
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Efecto para hacer scroll automático al final cuando cambia la lista de mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Función para iniciar la conexión con el servidor SignalR
  const startConnection = async () => {
    // Validación: si ya hay conexión, está conectando o no hay nombre, no hace nada
    if (!username || connection || isConnecting) return;

    setIsConnecting(true); // Activa indicador de "conectando"

    // Construye la conexión con el backend, incluyendo el nombre de usuario en la URL
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect()
      .build();

    // Evento: al recibir un mensaje desde el servidor
    newConnection.on("ReceiveMessage", (data) => {
      const { user, message, fechaHoraCostaRica } = data;

      setMessages((prev) => [
        ...prev,
        {
          user,
          message,
          timestamp: fechaHoraCostaRica
        }
      ]);
    });

    // Evento: al actualizarse el número de usuarios conectados
    newConnection.on("UpdateUserCount", (count) => {
      setOnlineUsers(count);
    });

    // Intenta iniciar la conexión
    try {
      await newConnection.start();
      setConnection(newConnection);
      setIsConnected(true);
    } catch (e) {
      console.error("Error al conectar con SignalR:", e);
    } finally {
      setIsConnecting(false); // Termina el estado de conexión
    }
  };

  // Envía un mensaje al servidor usando la conexión actual
  const sendMessage = async () => {
    if (connection && message) {
      try {
        await connection.invoke("SendMessage", username, message);
        setMessage(""); // Limpia el input de mensaje
      } catch (e) {
        console.error("Error al enviar mensaje:", e);
      }
    }
  };

  // Renderizado del componente
  return (
    <div className="chat-container">
      {/* Si NO está conectado aún, muestra pantalla de login */}
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

          {/* Campo para ingresar el nombre de usuario */}
          <h2>Ingresa tu nombre de usuario:</h2>
          <input
            id="username" // Para accesibilidad y autocompletado
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escribe tu nombre..."
            autoComplete="username"
          />

          {/* Botón para iniciar sesión */}
          <br /><br />
          <button
            onClick={startConnection}
            disabled={isConnecting}
            className="btn-chat"
            type="button" // Para evitar comportamiento por defecto en formularios
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
        // Si está conectado, muestra el chat
        <>
          <h1>Bienvenido, {username}</h1>
          <h3>Usuarios en línea: {onlineUsers}</h3>

          {/* Contenedor de mensajes del chat */}
          <div className="chat-box">
              {messages.map((msg, idx) => {
                const { user, message, timestamp } = msg;

                const time = new Date(timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true, // si quieres formato AM/PM
                });

                const isSystem = user === "Sistema";
                const isMe = user === username;


              // Genera un color único para cada usuario según su nombre
              const getColorForUser = (name?: string) => {
                if (!name) return "#999"; // Color por defecto si el nombre es inválido

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
                  {/* Información del mensaje (quién y a qué hora) */}
                  <div className={`chat-meta ${isMe ? "right" : "left"}`}>
                    {isSystem ? (
                      <>
                        <span>🛠 <strong>{user}</strong></span>
                        <span>{time}</span>
                      </>
                    ) : (
                      <>
                        {!isMe && (
                          <span
                            className="chat-color-dot"
                            style={{ backgroundColor: getColorForUser(user) }}
                          ></span>
                        )}
                        <span><strong>{user}</strong></span>
                        <span>{time}</span>
                      </>
                    )}
                  </div>
                  <div>{message}</div>
                </div>
              );
            })}

            {/* Referencia al final de los mensajes, para scroll automático */}
            <div ref={messagesEndRef} />
          </div>

          {/* Campo de entrada de mensaje */}
          <input
            id="message" // Mejora accesibilidad
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
            autoComplete="off"
          />

          {/* Botón de enviar mensaje */}
          <button
            onClick={sendMessage}
            className="btn-chat btn-send"
            type="button"
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
