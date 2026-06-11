import mongoose from 'mongoose';

let connected = false;

// La partida en vivo funciona en memoria aunque mongo no esté disponible:
// auth y persistencia se degradan con mensaje claro en vez de tirar el proceso.
export function isDbConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[db] MONGODB_URI no definida: auth y persistencia deshabilitadas.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log('[db] Conectado a MongoDB.');
  } catch (err) {
    console.warn('[db] No se pudo conectar a MongoDB (la partida en vivo sigue funcionando):', (err as Error).message);
    // Reintento en segundo plano: mongoose reintenta solo tras la primera conexión,
    // pero si la primera falló, reintentamos nosotros.
    setTimeout(() => void connectDb(), 10000);
  }
}
