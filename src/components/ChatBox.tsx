import React, { useState } from "react"; // Importa React y useState para manejar el estado del componente
import * as signalR from "@microsoft/signalr"; // Importa SignalR para manejar la comunicación en tiempo real
import './Chat.css'; // Importa estilos CSS para el chat

const ChatBox: React.FC = () => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null); // Estado para la conexión de SignalR
  const [messages, setMessages] = useState<string[]>([]); // Lista de mensajes en el chat
  const [username, setUsername] = useState(""); // Nombre del usuario
  const [message, setMessage] = useState(""); // Mensaje en curso
  const [isConnected, setIsConnected] = useState(false); // Bandera que indica si está conectado
  const [isConnecting, setIsConnecting] = useState(false); // Bandera para prevenir múltiples clics en "Entrar al chat"

  // Función para iniciar la conexión con el backend SignalR
  const startConnection = async () => {
    if (!username || connection || isConnecting) return; // Evita múltiples conexiones

    setIsConnecting(true); // Marca como "conectando"

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect()
      .build();

    newConnection.on("ReceiveMessage", (user, receivedMessage) => {
      setMessages((prev) => [...prev, `${user}: ${receivedMessage}`]); // Agrega nuevo mensaje recibido
    });

    try {
      await newConnection.start(); // Inicia la conexión
      setConnection(newConnection);
      setIsConnected(true); // Marca como conectado
    } catch (e) {
      console.error("Error al conectar con SignalR: ", e);
    } finally {
      setIsConnecting(false); // Finaliza la bandera de conexión
    }
  };

  // Función para enviar un mensaje al backend
  const sendMessage = async () => {
    if (connection && message) {
      try {
        await connection.invoke("SendMessage", username, message); // Envía el mensaje usando el hub
        setMessage(""); // Limpia el campo de entrada
      } catch (e) {
        console.error("Error al enviar mensaje: ", e);
      }
    }
  };

  return (
    <div className="chat-container">
      {/* Si el usuario aún no está conectado */}
      {!isConnected ? (
        <div className="chat-login">
          <img src="/logo_ulatina.png" alt="Logo de Universidad Latina" />
          <h1>Curso: Programación Web</h1>
          <p>20252-002-BISI05
            <br />Profesor: Jose Arturo Gracia Rodriguez
            <br />Proyecto Final - Aplicación de Chat v3.2
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
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escribe tu nombre..."
          />
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
        <>
          <h2>Bienvenido, {username}</h2>

          <div className="chat-box">
            {messages.map((msg, idx) => {
              const [meta, ...contentParts] = msg.split(":");
              const messageText = contentParts.join(":").trim();
              const userFromMsg = meta.trim();
              const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isSystem = userFromMsg === "Sistema";
              const isMe = userFromMsg === username;

              // Función que asigna un color único a cada usuario
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

          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
          />
          <button
            onClick={sendMessage}
            className="btn-chat btn-send"
          > Enviar
            <img src="/sent.png" alt="icono enviar" />
          </button>

          <br /><br />
          <button
            className="btn-chat btn-logout"
            onClick={async () => {
              // Finaliza la conexión y reinicia todos los estados
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
    </div>
  );
};

export default ChatBox;
