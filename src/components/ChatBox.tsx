import React, { useState } from "react";
import * as signalR from "@microsoft/signalr";

// Componente principal del chat
const ChatBox: React.FC = () => {
  // Estado para guardar la conexión a SignalR
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  // Lista de mensajes recibidos en el chat
  const [messages, setMessages] = useState<string[]>([]);

  // Nombre del usuario que se conecta al chat
  const [username, setUsername] = useState("");

  // Mensaje que está escribiendo el usuario
  const [message, setMessage] = useState("");

  // Estado que indica si el usuario ya está conectado al chat
  const [isConnected, setIsConnected] = useState(false);

  // Función para iniciar la conexión con SignalR
  const startConnection = async () => {
    if (!username || connection) return;

    // Crear una nueva conexión al Hub de SignalR con el nombre de usuario
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect() // Si se pierde la conexión, intenta reconectar automáticamente
      .build();

    // Maneja los mensajes entrantes del servidor
    newConnection.on("ReceiveMessage", (user, receivedMessage) => {
      setMessages((prev) => [...prev, `${user}: ${receivedMessage}`]);
    });

    try {
      // Iniciar la conexión
      await newConnection.start();
      setConnection(newConnection);
      setIsConnected(true);
    } catch (e) {
      console.error("Error al conectar con SignalR: ", e);
    }
  };

    return (
    <div style={{ padding: "2rem" }}>
      {/* Vista antes de conectarse */}
      {!isConnected ? (
        <div style={{ textAlign: "center" }}>
          {/* Logo y encabezado de la app */}
          <img
            src="/logo_ulatina.png"
            alt="Logo de Universidad Latina"
            style={{ width: "800px", marginBottom: "1rem" }}
          />
          <h1>Curso: Programacion Web </h1>
          <p>20252-002-BISI05
            <br />
            Profesor: Jose Arturo Gracia Rodriguez
            <br />
            Proyecto Final - Aplicacion de Chat
            <h3>Equipo: Pastelito</h3>
            <ul>
              <li>Leiner Arce Jimenez</li>
              <li>Diego Campos Borbon</li>
              <li>Gabriel Barrios Benavides</li>
              <li>Erick Villegas Aragon</li>
            </ul>
            <br />
          </p>

          {/* Campo para ingresar nombre de usuario */}
          <h2>Ingresa tu nombre de usuario:</h2>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escribe tu nombre..."
            style={{ marginRight: "0.5rem" }}
          />
          <button onClick={startConnection}>Entrar al chat</button>
        </div>
      ) : (
        // Vista después de conectarse
        <>
          <h2>Bienvenido, {username}</h2>

          {/* Área de mensajes */}
          <div style={{ border: "1px solid #ccc", padding: "1rem", height: "300px", overflowY: "scroll" }}>
            {/* Recorrido de mensajes */}
            {messages.map((msg, idx) => {
              const [meta, ...contentParts] = msg.split(":");
              const messageText = contentParts.join(":").trim(); // Contenido del mensaje
              const userFromMsg = meta.trim(); // Nombre del remitente
              const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Hora del mensaje

              const isSystem = userFromMsg === "Sistema"; // Mensaje del sistema
              const isMe = userFromMsg === username; // Mensaje propio

              // Función para generar un color por usuario
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
                  style={{
                    marginBottom: "1rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "10px",
                    maxWidth: "70%",
                    marginLeft: isMe ? "auto" : 0,
                    backgroundColor: isSystem ? "#f0f0f0" : isMe ? "#d1e7dd" : "#e7f3ff",
                    textAlign: isMe ? "right" : "left"
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#444",
                      marginBottom: "0.3rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: isMe ? "flex-end" : "flex-start",
                      gap: "0.4rem"
                    }}
                  >
                    {/* Encabezado del mensaje (usuario y hora) */}
                    {isSystem ? (
                      <>
                        <span>🛠 <strong>{userFromMsg}</strong></span>
                        <span>{time}</span>
                      </>
                    ) : (
                      <>
                        {!isMe && (
                          <span
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: getColorForUser(userFromMsg)
                            }}
                          ></span>
                        )}
                        <span><strong>{userFromMsg}</strong></span>
                        <span>{time}</span>
                      </>
                    )}
                  </div>
                  {/* Contenido del mensaje */}
                  <div>{messageText}</div>
                </div>
              );
            })}
          </div>

          {/* Input y botones de enviar/salir */}
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
          />
          <button onClick={sendMessage}>Enviar</button>
          <br />
          <button
            style={{ marginBottom: "1rem" }}
            onClick={async () => {
              // Al salir, cerrar conexión y reiniciar estado
              await connection?.stop();
              setConnection(null);
              setUsername("");
              setIsConnected(false);
              setMessages([]);
            }}
          >
            Salir del chat
          </button>
        </>
      )}
    </div>
  );
};

export default ChatBox;