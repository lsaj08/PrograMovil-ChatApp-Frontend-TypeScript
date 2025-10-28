import React, { useState, useRef, useEffect } from "react";
import * as signalR from "@microsoft/signalr";
import "./Chat.css";
import ChatMessageItem from "./ChatMessageItem";

// ===== Tipos =====
interface ChatMessage {
  user: string;
  message: string;
  timestamp: string;
}

type HubConn = signalR.HubConnection | null;

type PublicKeyDTO = {
  username: string;
  algorithm: "EC-P256-RAW";
  publicKeyB64: string; // uncompressed point (65 bytes) en base64
};

type CipherDTO = {
  from: string;
  to: string | null; // aquí lo usamos por-peer, así que llevará el username destino
  iv: string;        // base64(12 bytes)
  cipher: string;    // base64( ct || tag )
};

// ===== util base64 <-> bytes =====
const b64ToBytes = (b64: string) =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const bytesToB64 = (buf: ArrayBuffer | Uint8Array) => {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
};

// ===== WebCrypto helpers =====
const ecAlgo = { name: "ECDH", namedCurve: "P-256" } as const;
const hkdfAlgo = (salt: Uint8Array, info: Uint8Array) => ({
  name: "HKDF",
  hash: "SHA-256",
  salt,
  info,
}) as const;

async function genKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ecAlgo, true, ["deriveBits", "deriveKey"]);
}

async function exportRawPublicKey(pub: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", pub); // 65 bytes uncompressed
  return bytesToB64(raw);
}

async function importRawPublicKey(b64: string): Promise<CryptoKey> {
  const raw = b64ToBytes(b64);
  return crypto.subtle.importKey("raw", raw, ecAlgo, true, []);
}

async function deriveAesKey(
  myPriv: CryptoKey,
  peerPub: CryptoKey
): Promise<CryptoKey> {
  // 1) ECDH -> 256 bits
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerPub },
    myPriv,
    256
  );
  // 2) HKDF(shared, salt=0s, info="chatapp-ecdh") -> AES-GCM 256
  const base = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, [
    "deriveKey",
  ]);
  const zeroSalt = new Uint8Array(32); // todo ceros
  const info = new TextEncoder().encode("chatapp-ecdh");
  return crypto.subtle.deriveKey(
    hkdfAlgo(zeroSalt, info),
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptAesGcm(
  key: CryptoKey,
  text: string,
  aad?: string
): Promise<{ ivB64: string; ctB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv,
    tagLength: 128,
    ...(aad ? { additionalData: enc.encode(aad) } : {}),
  };
  const ct = await crypto.subtle.encrypt(params, key, enc.encode(text));
  return { ivB64: bytesToB64(iv), ctB64: bytesToB64(ct) };
}

async function decryptAesGcm(
  key: CryptoKey,
  ivB64: string,
  ctB64: string,
  aad?: string
): Promise<string> {
  const dec = new TextDecoder();
  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv,
    tagLength: 128,
    ...(aad ? { additionalData: new TextEncoder().encode(aad) } : {}),
  };
  const pt = await crypto.subtle.decrypt(params, key, ct);
  return dec.decode(pt);
}

// ================================
// Componente principal del chat
// ================================
const ChatBox: React.FC = () => {
  const [connection, setConnection] = useState<HubConn>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // === E2EE: claves locales y por-peer ===
  const myKeysRef = useRef<CryptoKeyPair | null>(null);
  const myPubB64Ref = useRef<string>("");
  const sharedKeysRef = useRef<Map<string, CryptoKey>>(new Map()); // peer -> AES key

  // Scroll al final cuando cambian mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // === Conexión con SignalR (con handlers E2EE) ===
  const startConnection = async () => {
    if (!username || connection || isConnecting) return;
    setIsConnecting(true);

    try {
      // 1) Generar par de claves local
      const kp = await genKeyPair();
      myKeysRef.current = kp;
      myPubB64Ref.current = await exportRawPublicKey(kp.publicKey);

      // 2) Crear conexión
      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${process.env.REACT_APP_BACKEND_URL}/chat?username=${encodeURIComponent(username)}`)
        .withAutomaticReconnect()
        .build();

      // ---- Handlers "legados" (sistema/contador)
      newConnection.on("ReceiveMessage", (data: any) => {
        // Mantén sistema/bienvenida del backend
        const { user, message, fechaHoraCostaRica } = data || {};
        if (typeof message === "string") {
          setMessages((prev) => [
            ...prev,
            {
              user: user ?? "Sistema",
              message,
              timestamp: fechaHoraCostaRica ?? new Date().toISOString(),
            },
          ]);
        }
      });

      newConnection.on("UpdateUserCount", (count: number) => {
        setOnlineUsers(count ?? 0);
      });

      // ---- E2EE: recibir claves públicas
      newConnection.on("ReceivePublicKey", async (json: string) => {
        try {
          const dto: PublicKeyDTO = JSON.parse(json);
          if (dto.username === username) return; // ignora tu eco
          if (dto.algorithm !== "EC-P256-RAW") return;

          // Importar clave pública del peer y derivar AES
          const peerPub = await importRawPublicKey(dto.publicKeyB64);
          const myPriv = myKeysRef.current?.privateKey;
          if (!myPriv) return;

          const aesKey = await deriveAesKey(myPriv, peerPub);
          sharedKeysRef.current.set(dto.username, aesKey);
          // Opcional: notificar en UI que tienes canal seguro con X
          // console.log("🔐 Key ok con", dto.username);
        } catch (e) {
          console.error("Error en ReceivePublicKey:", e);
        }
      });

      // ---- E2EE: recibir ciphertext
      newConnection.on("ReceiveCipher", async (json: string) => {
        try {
          const payload: CipherDTO = JSON.parse(json);
          // Solo procesar si va dirigido a mí
          if (payload.to !== username) return;

          const key = sharedKeysRef.current.get(payload.from);
          if (!key) return; // aún sin handshake con emisor

          const plain = await decryptAesGcm(
            key,
            payload.iv,
            payload.cipher,
            payload.from // AAD opcional = nombre del emisor
          );

          setMessages((prev) => [
            ...prev,
            {
              user: payload.from,
              message: plain,
              timestamp: new Date().toISOString(),
            },
          ]);
        } catch (e) {
          console.error("Error al descifrar:", e);
        }
      });

      await newConnection.start();
      setConnection(newConnection);
      setIsConnected(true);

      // 3) Publicar mi clave pública a todos
      const pubDto: PublicKeyDTO = {
        username,
        algorithm: "EC-P256-RAW",
        publicKeyB64: myPubB64Ref.current,
      };
      await newConnection.invoke("SharePublicKey", JSON.stringify(pubDto));
    } catch (e) {
      console.error("Error al conectar con SignalR:", e);
    } finally {
      setIsConnecting(false);
    }

    // Ayuda para esperar hasta que una condición se cumpla
const waitFor = (cond: () => boolean, timeoutMs = 4000, poll = 100) =>
  new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const i = setInterval(() => {
      if (cond()) { clearInterval(i); resolve(); }
      else if (Date.now() - start > timeoutMs) { clearInterval(i); reject(new Error("timeout")); }
    }, poll);
  });

// Reenviar mi clave pública
async function shareMyPublicKey(conn: signalR.HubConnection, username: string) {
  await waitFor(() => !!myPubB64Ref.current, 4000).catch(() => {});
  if (!myPubB64Ref.current) {
    console.warn("⚠️ Aún no tengo mi clave pública lista para compartir.");
    return;
  }
  const pubDto: PublicKeyDTO = {
    username: username.trim(),
    algorithm: "EC-P256-RAW",
    publicKeyB64: myPubB64Ref.current,
  };
  console.log("📮 Enviando mi clave pública…");
  await conn.invoke("SharePublicKey", JSON.stringify(pubDto));
}

  };

  // === Enviar (E2EE): un payload por peer conocido ===
  const sendMessage = async () => {
    if (!connection || !message) return;

    const pairs = Array.from(sharedKeysRef.current.entries()); // [ [peer, key], ... ]
    if (pairs.length === 0) {
      // Aún sin claves con nadie
      setMessages((prev) => [
        ...prev,
        {
          user: "Sistema",
          message:
            "Aún no hay canal cifrado con otros usuarios. Espera a que recibas claves públicas.",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    try {
      for (const [peer, key] of pairs) {
        const { ivB64, ctB64 } = await encryptAesGcm(key, message, username);
        const payload: CipherDTO = {
          from: username,
          to: peer,
          iv: ivB64,
          cipher: ctB64,
        };
        await connection.invoke("SendCipher", JSON.stringify(payload));
      }
      setMessage("");
    } catch (e) {
      console.error("Error al enviar cifrado:", e);
    }
  };

  // === Render ===
  return (
    <div className="chat-container">
      {!isConnected ? (
        <div className="chat-login">
          <img src="/logo_ulatina.png" alt="Universidad Latina logo" className="logo-ulatina" />
          <h1>Curso: Programación Movil</h1>
          <p>
            20253-002-BISI10 <br />
            Profesor: Jose Arturo Gracia Rodriguez <br />
            Proyecto Final - Aplicación de Chat <br /><br />
            Nombre del App: Talkao v4.3<br /><br />
            .env variables<br /><br />
            <img src="/Talkao.png" alt="Talkao logo" className="logo-talkao" />
          </p>

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
            disabled={isConnecting || !username}
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
                <img src="/login.png" alt="icono login" className="icon-login" />
              </>
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
            <button
              onClick={sendMessage}
              className="btn-chat btn-send"
              type="button"
            >
              Enviar
              <img src="/send.png" alt="icono enviar" className="icon-send" />
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
                sharedKeysRef.current.clear();
                myKeysRef.current = null;
                myPubB64Ref.current = "";
              }}
              type="button"
            >
              <img src="/logout.png" alt="icono logout" className="icon-logout" />
              Salir del chat
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatBox;