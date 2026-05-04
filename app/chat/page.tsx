'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  transaction_id?: string | null;
  created_at?: string;
}

interface SavedTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function TimeLabel({ dateStr }: { dateStr?: string }) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return <span className="chat-time">{hh}:{mm}</span>;
}

const QUICK_PROMPTS = [
  '💰 /saldo',
  '📊 /laporan',
  '🍜 Makan siang 25rb',
  '⛽ Bensin 50rb',
  '🛒 Belanja 150rb',
  '💵 Terima gaji',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [savedTx, setSavedTx] = useState<SavedTransaction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load chat history
  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          // Welcome message
          setMessages([{
            role: 'assistant',
            content: '👋 Halo! Saya **CuanBot**, asisten keuangan kamu!\n\nKamu bisa ketik transaksi keuangan secara natural, contoh:\n• "makan siang 35rb di warteg"\n• "terima gaji 5jt"\n• "bayar listrik 250rb"\n\nAtau ketik `/saldo` untuk lihat ringkasan keuangan bulan ini 💰',
            created_at: new Date().toISOString(),
          }]);
        }
      })
      .catch(() => {
        setMessages([{
          role: 'assistant',
          content: '👋 Halo! Saya **CuanBot**. Ketik transaksi atau `/saldo` untuk mulai!',
          created_at: new Date().toISOString(),
        }]);
      })
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText && !imageFile) return;
    if (loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: imageFile ? (messageText || '📷 [Gambar struk/nota]') : messageText,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSavedTx(null);

    // Typing indicator
    const typingMsg: ChatMessage = {
      id: '__typing__',
      role: 'assistant',
      content: '__typing__',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, typingMsg]);
    setLoading(true);

    try {
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;

      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(imageFile);
        });
        imageMimeType = imageFile.type;
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, imageBase64, imageMimeType }),
      });

      const data = await res.json();

      // Hapus typing indicator, tambah reply
      setMessages(prev => [
        ...prev.filter(m => m.id !== '__typing__'),
        {
          role: 'assistant',
          content: data.reply || '❌ Tidak ada balasan dari AI.',
          created_at: new Date().toISOString(),
        }
      ]);

      if (data.transaction) {
        setSavedTx(data.transaction);
        setTimeout(() => setSavedTx(null), 5000);
      }
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== '__typing__'),
        {
          role: 'assistant',
          content: '❌ Gagal terhubung ke server. Cek koneksi internet kamu.',
          created_at: new Date().toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Render markdown-like bold text
  const renderContent = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-avatar">🤖</div>
        <div className="chat-header-info">
          <div className="chat-header-name">CuanBot</div>
          <div className="chat-header-status">
            {loading ? (
              <span className="status-typing">mengetik...</span>
            ) : (
              <span className="status-online">● Online</span>
            )}
          </div>
        </div>
        <div className="chat-header-actions">
          <Link href="/" className="chat-header-btn" title="Dashboard">📊</Link>
          <Link href="/transactions" className="chat-header-btn" title="Transaksi">💳</Link>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="chat-quick-prompts">
        {QUICK_PROMPTS.map((p, i) => (
          <button
            key={i}
            className="quick-prompt-btn"
            onClick={() => sendMessage(p.replace(/^[^\s]+\s/, ''))}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages" id="chat-messages">
        {loadingHistory ? (
          <div className="chat-loading">
            <div className="spinner" />
            Memuat riwayat chat...
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message-wrap ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chat-avatar">🤖</div>
                )}
                <div className={`chat-bubble ${msg.role}`}>
                  {msg.content === '__typing__' ? (
                    <div className="typing-indicator">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <>
                      <div className="chat-bubble-text">
                        {msg.content.split('\n').map((line, i) => (
                          <p key={i} style={{ margin: i > 0 ? '4px 0 0' : '0' }}>
                            {renderContent(line)}
                          </p>
                        ))}
                      </div>
                      <TimeLabel dateStr={msg.created_at} />
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Transaction saved toast */}
            {savedTx && (
              <div className="chat-tx-saved">
                <div className="tx-saved-icon">{savedTx.type === 'income' ? '💚' : '❤️'}</div>
                <div className="tx-saved-info">
                  <div className="tx-saved-desc">{savedTx.description}</div>
                  <div className={`tx-saved-amount ${savedTx.type}`}>
                    {savedTx.type === 'income' ? '+' : '-'}{formatRupiah(savedTx.amount)}
                  </div>
                </div>
                <div className="tx-saved-badge">✓ Tersimpan</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="chat-image-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
          <button className="remove-image-btn" onClick={removeImage}>✕</button>
        </div>
      )}

      {/* Input bar */}
      <div className="chat-input-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          id="chat-file-input"
          onChange={handleImageChange}
        />
        <button
          className="chat-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Lampirkan foto struk"
          id="btn-attach-image"
        >
          📷
        </button>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik transaksi atau tanya keuangan..."
          rows={1}
          disabled={loading}
          id="chat-input"
        />
        <button
          className={`chat-send-btn ${(!input.trim() && !imageFile) || loading ? 'disabled' : ''}`}
          onClick={() => sendMessage()}
          disabled={(!input.trim() && !imageFile) || loading}
          id="btn-send-message"
        >
          {loading ? <span className="spinner" style={{ width: 18, height: 18, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : '➤'}
        </button>
      </div>
    </div>
  );
}
