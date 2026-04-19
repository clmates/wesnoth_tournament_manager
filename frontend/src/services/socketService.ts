import io, { Socket } from 'socket.io-client';
import { useNotificationStore } from '../stores/notificationStore';

let socket: Socket | null = null;

export const connectToNotifications = () => {
  if (socket && socket.connected) {
    console.log('🔌 Already connected to Socket.IO');
    return socket;
  }

  // Determine server URL
  let serverUrl = '';
  
  // Check if we're on localhost (dev environment)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = window.location.port || '5173';
    serverUrl = `http://localhost:7100`; // Connect to backend dev port
  } else {
    // Production: use same protocol and host (nginx reverse proxy handles socket.io)
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    serverUrl = `${protocol}://${host}${port}`;
  }

  console.log(`🔌 Connecting to Socket.IO at ${serverUrl}`);

  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
  });

  socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO server');

    // Authenticate with token
    const token = localStorage.getItem('token');
    if (token) {
      socket!.emit('auth', token);
    }
  });

  socket.on('auth:success', () => {
    console.log('✅ Authenticated with Socket.IO');
  });

  socket.on('auth:error', (error: string) => {
    console.error('❌ Socket.IO auth failed:', error);
  });

  socket.on('notification', (data) => {
    console.log('📬 Received notification:', data);
    const { addToast } = useNotificationStore.getState();
    addToast(data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from Socket.IO');
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket.IO connection error:', error);
  });

  return socket;
};

export const disconnectFromNotifications = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('📴 Disconnected from Socket.IO');
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const isConnected = (): boolean => {
  return socket ? socket.connected : false;
};
