import React, { useState } from "react";
import * as signalR from "@microsoft/signalr";

const ChatBox: React.FC = () => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const startConnection = async () => {
    if (!username || connection) return;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://prograweb-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(username)}`)
      .withAutomaticReconnect()
      .build();

    newConnection.on("ReceiveMessage", (user, receivedMessage) => {
      setMessages((prev) => [...prev, `${user}: ${receivedMessage}`]);
    });

    try {
      await newConnection.start();
      setConnection(newConnection);
      setIsConnected(true);
    } catch (e) {
      console.error("SignalR connection error: ", e);
    }
  };

  const sendMessage = async () => {
    if (connection && message) {
      try {
        await connection.invoke("SendMessage", username, message);
        setMessage("");
      } catch (e) {
        console.error("Send failed: ", e);
      }
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {!isConnected ? (
        <div style={{ textAlign: "center" }}>
          
          <img
            src="/logo_ulatina.png"
            alt="Logo de Universidad Latina"
            style={{ width: "120px", marginBottom: "1rem" }}
          />
          <h1>Bienvenido a Chat PrograWeb</h1>

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
        <>
          <h2>Bienvenido, {username}</h2>

        <div style={{ border: "1px solid #ccc", padding: "1rem", height: "300px", overflowY: "scroll" }}>
          {messages.map((msg, idx) => (
            <div key={idx}>{msg}</div>
          ))}
        </div>

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
