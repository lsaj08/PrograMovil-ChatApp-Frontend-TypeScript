import React, { useState } from "react"; // Importa React y useState para manejar el estado del componente
import * as signalR from "@microsoft/signalr"; // Importa SignalR para manejar la comunicación en tiempo real
import './Chat.css'; // Importa estilos CSS para el chat

const ChatBox: React.FC = () => {
  // Estado que guarda la conexión con SignalR
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  // Lista de mensajes en el chat
  const [messages, setMessages] = useState<string[]>([]);

  // Nombre de usuario del cliente
  const [username, setUsername] = useState("");

  // Mensaje que el usuario está escribiendo
  const [message, setMessage] = useState("");

  // Indica si ya se estableció conexión con el servidor
  const [isConnected, setIsConnected] = useState(false);

  // Función que inicia la conexión al backend con SignalR
  const startConnection = async () => {
    if (!username || connection) return; // Evita duplicar conexión

    // Se configura la conexión con el endpoint del backend
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect() // Se reconecta automáticamente si se pierde la conexión
      .build();

    // Escucha los mensajes recibidos desde el backend
    newConnection.on("ReceiveMessage", (user, receivedMessage) => {
      setMessages((prev) => [...prev, `${user}: ${receivedMessage}`]); // Agrega el mensaje al historial
    });

    try {
      await newConnection.start(); // Inicia la conexión
      setConnection(newConnection);
      setIsConnected(true); // Marca como conectado
    } catch (e) {
      console.error("Error al conectar con SignalR: ", e);
    }
  };

  // Función para enviar un mensaje al backend
  const sendMessage = async () => {
    if (connection && message) {
      try {
        await connection.invoke("SendMessage", username, message); // Invoca el método del hub
        setMessage(""); // Limpia el campo del mensaje
      } catch (e) {
        console.error("Error al enviar mensaje: ", e);
      }
    }
  };

  return (
    <div className="chat-container">
      {/* Vista cuando aún no se ha conectado */}
      {!isConnected ? (
        <div className="chat-login">
          {/* Encabezado del proyecto */}
          <img
            src="/logo_ulatina.png"
            alt="Logo de Universidad Latina"
          />
          <h1>Curso: Programación Web</h1>
          <p>20252-002-BISI05
            <br />
            Profesor: Jose Arturo Gracia Rodriguez
            <br />
            Proyecto Final - Aplicación de Chat
            <h3>Equipo: Pastelito</h3>
            <ul>
              <li>Leiner Arce Jimenez</li>
              <li>Diego Campos Borbon</li>
              <li>Gabriel Barrios Benavides</li>
              <li>Erick Villegas Aragon</li>
            </ul>
          </p>

          {/* Input para ingresar el nombre de usuario */}
          <h2>Ingresa tu nombre de usuario:</h2>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escribe tu nombre..."
          />
          <button onClick={startConnection}>Entrar al chat</button>
        </div>
      ) : (
        <>
          <h2>Bienvenido, {username}</h2>

          {/* Área donde se listan los mensajes */}
          <div className="chat-box">
            {messages.map((msg, idx) => {
              // Extrae nombre de usuario y contenido del mensaje
              const [meta, ...contentParts] = msg.split(":");
              const messageText = contentParts.join(":").trim();
              const userFromMsg = meta.trim();

              const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const isSystem = userFromMsg === "Sistema";
              const isMe = userFromMsg === username;

              // Función para asignar un color único a cada usuario
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
          </div>

          {/* Input de texto y botones */}
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
              // Al salir, se detiene la conexión y se limpia el estado
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
