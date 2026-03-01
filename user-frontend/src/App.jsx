import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import logo from '../../assets/logo.png';

function App() {
  const [view, setView] = useState('home');
  const [chatData, setChatData] = useState(null);

  if (view === 'home') {
    return (
      <div className="user-home">
        <img src={logo} alt="ThreadNet" className="logo-main" />
        <div className="user-home-buttons">
          <button className="user-home-btn" onClick={() => setView('create')}>
            Create Room
          </button>
          <button className="user-home-btn" onClick={() => setView('join')}>
            Join Room
          </button>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <CreateRoomForm
        onCreated={(data) => {
          setChatData(data);
          setView('chat');
        }}
        onBack={() => setView('home')}
      />
    );
  }

  if (view === 'join') {
    return (
      <JoinRoomForm
        onJoined={(data) => {
          setChatData(data);
          setView('chat');
        }}
        onBack={() => setView('home')}
      />
    );
  }

  if (!chatData) return null;

  return (
    <ChatRoom
      roomName={chatData.roomName}
      isCreator={chatData.isCreator}
      roomId={chatData.roomId}
      userName={chatData.userName}
      onLeave={() => {
        setChatData(null);
        setView('home');
      }}
    />
  );
}

function CreateRoomForm({ onCreated, onBack }) {
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roomName.trim() || !roomId.trim() || !userName.trim()) {
      setError('Please fill all fields');
      return;
    }
    setError('');
    onCreated({ roomName: roomName.trim(), roomId: roomId.trim(), userName: userName.trim(), isCreator: true });
  };

  return (
    <div className="user-form-page">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2 className="form-title">Create Room</h2>
      <form onSubmit={handleSubmit} className="user-form">
        <label>
          Room name:
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g. General Chat"
          />
        </label>
        <label>
          Room ID:
          <span className="input-with-btn">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. room-1"
            />
            <button
              type="button"
              className="generate-btn"
              onClick={() => setRoomId(Math.random().toString(36).slice(2, 10))}
            >
              Generate
            </button>
          </span>
        </label>
        <label>
          Your name:
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="e.g. Alice"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="create-btn">Create</button>
      </form>
    </div>
  );
}

function JoinRoomForm({ onJoined, onBack }) {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roomId.trim() || !userName.trim()) {
      setError('Please fill all fields');
      return;
    }
    setError('');
    onJoined({
      roomId: roomId.trim(),
      userName: userName.trim(),
      isCreator: false,
    });
  };

  return (
    <div className="user-form-page">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2 className="form-title">Join Room</h2>
      <form onSubmit={handleSubmit} className="user-form">
        <label>
          Room ID:
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g. room-1"
          />
        </label>
        <label>
          Your name:
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="e.g. Bob"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="create-btn">Join</button>
      </form>
    </div>
  );
}

function ChatRoom({ roomName: initialRoomName, roomId, userName, isCreator, onLeave }) {
  const [displayRoomName, setDisplayRoomName] = useState(initialRoomName || `Room ${roomId}`);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('joined', (data) => {
      setError('');
      if (data.roomName) setDisplayRoomName(data.roomName);
    });
    socket.on('error', (e) => setError(e.message || 'Error'));
    socket.on('disconnected', () => {
      setMessages([]);
      onLeave();
    });
    socket.on('message', (m) => setMessages((prev) => [...prev, m]));

    socket.emit('join', { name: userName, room: roomId, roomName: initialRoomName });

    return () => {
      socket.emit('leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, userName, initialRoomName]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !socketRef.current) return;
    // Server only broadcasts to others, so show our own message immediately
    setMessages((prev) => [
      ...prev,
      { sender: userName, colorCode: 1, text },
    ]);
    socketRef.current.emit('send', text);
    setInput('');
  };

  const COLORS = ['#ef4444', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#06b6d4'];

  return (
    <div className="chat-room">
      <header className="chat-header">
        <div className="chat-header-left">
          <img src={logo} alt="ThreadNet" className="chat-logo" />
        </div>
        <div className="chat-header-left">
          <p className="chat-room-name">{displayRoomName}</p>
        </div>
        <button className="leave-btn" onClick={onLeave}>Leave</button>
      </header>
      {error && <p className="chat-error">{error}</p>}
      <div ref={listRef} className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className="chat-msg">
            {m.sender && m.sender !== '#NULL' ? (
              <span>
                <span style={{ color: COLORS[(m.colorCode || 0) % COLORS.length], fontWeight: 600 }}>
                  {m.sender}:
                </span>{' '}
                {m.text}
              </span>
            ) : (
              <span className="chat-msg-system">{m.text}</span>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="chat-input-form">
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="chat-input"
        />
        <button type="submit" className="send-btn">Send</button>
      </form>
    </div>
  );
}

export default App;
