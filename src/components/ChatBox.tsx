// src/components/ChatBox.tsx
import React, { useState, useRef, useEffect } from "react";
import * as signalR from "@microsoft/signalr";
import "./Chat.css";
import ChatMessageItem from "./ChatMessageItem";

/* ============================
   🔐 E2EE helpers (WebCrypto)
   ============================ */
const te = new TextEncoder();
const td = new TextDecoder();

const buf2b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const b642buf = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

async function generateMyKeys() {
  const kp = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const spki = await window.crypto.subtle.exportKey("spki", kp.publicKey);
  const publicKeyB64 = buf2b64(spki);
  return { privateKey: kp.privateKey, publicKeyB64 };
}

async function importPeerPublicKey(spkiB64: string): Promise<CryptoKey> {
  const spki = b642buf(spkiB64);
  return window.crypto.subtle.importKey(
    "spki",
    spki,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

async function deriveAesKey(
  myPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return window.crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptGcm(
  key: CryptoKey,
  plain: string
): Promise<{ ivB64: string; cipherB64: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    te.encode(plain)
  );
  return { ivB64: buf2b64(iv.buffer), cipherB64: buf2b64(ct) };
}

async function decryptGcm(
  key: CryptoKey,
  ivB64: string,
  cipherB64: string
): Promise<string> {
  const iv = new Uint8Array(b642buf(ivB64));
  const ct = b642buf(cipherB64);
  const pt = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );
  return td.decode(pt);
}

/* ============================
   DTOs que viajan por el hub
   ============================ */
type PublicKeyDTO = {
  username: string;
  algorithm: "EC-P256";
  publicKeyB64: string;
};

type EncryptedMessageDTO = {
  from: string;
  to: string | null; // dirigido a 'to'. Si es null => broadcast (no recomendable E2EE)
  iv: string;
  cipher: string;
};

/* ============================
   Tipos para UI
   ============================ */
interface ChatMessage {
  user: string;
  message: string;
  timestamp: string;
}

/* ============================
   Componente principal
   ============================ */
const ChatBox: React.FC = () => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);

  // Estado E2EE (solo en memoria)
  const myPrivateKeyRef = useRef<CryptoKey | null>(null);
  const sessionKeys = useRef<Map<string, CryptoKey>>(new Map()); // peer -> AES key

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ============================
  // Conexión y handshake E2EE
  // ============================
  const startConnection = async () => {
    if (!username || connection || isConnecting) return;
    setIsConnecting(true);

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(
        `https://programovil-chatapp-backend-net9.azurewebsites.net/chat?username=${encodeURIComponent(
          username
        )}`
      )
      .withAutomaticReconnect()
      .build();

    // Texto plano (fallback / compat)
    newConnection.on("ReceiveMessage", (data: any) => {
      const { user, message, fechaHoraCostaRica } = data || {};
      if (!user || typeof message !== "string") return;
      setMessages((prev) => [
        ...prev,
        {
          user,
          message,
          timestamp: fechaHoraCostaRica ?? new Date().toISOString(),
        },
      ]);
    });

    newConnection.on("UpdateUserCount", (count: number) => setOnlineUsers(count));

    // Intercambio de claves públicas
    newConnection.on("ReceivePublicKey", async (payloadJson: string) => {
      try {
        const payload = JSON.parse(payloadJson) as PublicKeyDTO;
        if (payload.username === username) return; // ignora tu eco
        if (payload.algorithm !== "EC-P256") return;

        const peerPub = await importPeerPublicKey(payload.publicKeyB64);
        const myPriv = myPrivateKeyRef.current;
        if (!myPriv) return;
        const aesKey = await deriveAesKey(myPriv, peerPub);
        sessionKeys.current.set(payload.username, aesKey);
        // silencioso en UI (solo consola para debug)
        console.info(`[E2EE] Canal con ${payload.username} listo`);
      } catch (e) {
        console.warn("ReceivePublicKey error:", e);
      }
    });

    // Mensajes cifrados
    newConnection.on("ReceiveCipher", async (payloadJson: string) => {
      try {
        const payload = JSON.parse(payloadJson) as EncryptedMessageDTO;
        const { from, to, iv, cipher } = payload;

        // Si viene dirigido a otra persona, no lo muestres
        if (to && to !== username) return;

        const key = sessionKeys.current.get(from);
        if (!key) {
          // sin clave para ese emisor → silenciar
          console.info(`[E2EE] Cipher de ${from} ignorado (sin clave aún).`);
          return;
        }
        const plain = await decryptGcm(key, iv, cipher);
        setMessages((prev) => [
          ...prev,
          { user: from, message: plain, timestamp: new Date().toISOString() },
        ]);
      } catch (e) {
        console.warn("ReceiveCipher error:", e);
      }
    });

    try {
      await newConnection.start();
      setConnection(newConnection);
      setIsConnected(true);
    } catch (e) {
      console.error("Error al conectar con SignalR:", e);
      setIsConnecting(false);
      return;
    }

    // Generar par local y publicar clave (silencioso si el método no existe)
    try {
      const { privateKey, publicKeyB64 } = await generateMyKeys();
      myPrivateKeyRef.current = privateKey;
      const pubPayload: PublicKeyDTO = {
        username,
        algorithm: "EC-P256",
        publicKeyB64,
      };
      await newConnection.invoke("SharePublicKey", JSON.stringify(pubPayload));
      console.info("[E2EE] Clave pública publicada.");
    } catch (e: any) {
      const msg =
        e && typeof e === "object" && "message" in e ? (e as any).message : String(e);
      if (msg?.includes("Method does not exist")) {
        console.info("[E2EE] SharePublicKey no disponible; usando fallback.");
      } else {
        console.warn("SharePublicKey invoke failed:", msg);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // ============================
  // Envío con fallback
  // ============================
  const sendMessage = async () => {
    if (!connection) return;
    const text = message.trim();
    if (!text) return;

    try {
      const peers = Array.from(sessionKeys.current.entries());

      if (peers.length === 0) {
        // ➜ No hay claves: enviar en claro (el servidor lo mostrará a todos, incluido tú)
        await connection.invoke("SendMessage", username, text);
      } else {
        // ➜ Hay claves: cifrar 1 a 1 por peer
        for (const [peer, key] of peers) {
          const { ivB64, cipherB64 } = await encryptGcm(key, text);
          const payload: EncryptedMessageDTO = {
            from: username,
            to: peer,
            iv: ivB64,
            cipher: cipherB64,
          };
          await connection.invoke("SendCipher", JSON.stringify(payload));
        }
        // Eco local SOLO para E2EE (tu propio claro)
        setMessages((prev) => [
          ...prev,
          { user: username, message: text, timestamp: new Date().toISOString() },
        ]);
      }

      setMessage("");
    } catch (e) {
      console.error("Error al enviar mensaje:", e);
    }
  };

  // ============================
  // UI
  // ============================
  return (
    <div className="chat-container">
      {!isConnected ? (
        <div className="chat-login">
          <img src="/logo_ulatina.png" alt="Universidad Latina logo" className="logo-ulatina" />
          <h1>Curso: Programación Móvil</h1>

          <ul>
            <h3>Integrantes:</h3>
            <li>Leiner Arce Jimenez</li>
            <li>Diego Campos Borbon</li>
            <li>Victor Esteban Mena Mora</li>
            <li>Tracy Michelle Ramos Villegas</li>
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
              <>Conectando…<span className="spinner" /></>
            ) : (
              <>Entrar al chat <img src="/login.png" alt="login" className="icon-login" /></>
            )}
          </button>
        </div>
      ) : (
        <>
          <h1>Bienvenido, {username}</h1>
          <h3>Usuarios en línea: {onlineUsers}</h3>

          <div className="chat-box">
            {messages.map((msg, idx) => (
              <ChatMessageItem key={idx} msg={msg} username={username} />
            ))}
            <div ref={messagesEndRef} />
          </div>

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
            <button onClick={sendMessage} className="btn-chat btn-send" type="button">
              Enviar <img src="/send.png" alt="enviar" className="icon-send" />
            </button>
          </div>

          <div className="logout-wrapper">
            <button
              className="btn-chat btn-logout"
              onClick={async () => {
                await connection?.stop();
                setConnection(null);
                setUsername("");
                setIsConnected(false);
                setMessages([]);
                sessionKeys.current.clear();
                myPrivateKeyRef.current = null;
              }}
              type="button"
            >
              <img src="/logout.png" alt="logout" className="icon-logout" />
              Salir del chat
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatBox;
