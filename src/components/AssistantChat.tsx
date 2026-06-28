import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Bot, User as UserIcon, Plus, MessageSquare, Search, Star, 
  MoreVertical, Trash2, Edit2, Download, Share2, ThumbsUp, ThumbsDown, 
  Copy, RefreshCw, StopCircle, Paperclip, Mic, MicOff, Image as ImageIcon, 
  FileText, Activity, Map, Sparkles, Sprout, Cloud, TrendingUp, AlertTriangle, 
  Check, PanelLeftClose, PanelLeftOpen, Loader2, X, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User } from '../types';
import { fetch } from '../utils/api';

interface AssistantChatProps {
  user: User;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrl?: string; // data URL for attached images
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  isPinned: boolean;
  updatedAt: string;
}

const SUGGESTED_PROMPTS = [
  { icon: AlertTriangle, text: "Diagnose yellowing leaves on my tomato plants" },
  { icon: Cloud, text: "How will next week's rain impact my harvest?" },
  { icon: TrendingUp, text: "Estimate yield for 50 acres of corn" },
  { icon: Sprout, text: "Recommend organic fertilizer for clay soil" }
];

type MicStatus = 'ready' | 'listening' | 'processing' | 'unsupported';

// Check if browser supports speech recognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function AssistantChat({ user }: AssistantChatProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Voice input state
  const [micStatus, setMicStatus] = useState<MicStatus>(SpeechRecognition ? 'ready' : 'unsupported');
  const recognitionRef = useRef<any>(null);

  // Image attachment state
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; base64: string; mimeType: string; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error toast
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    // Clear any potentially cached states from localStorage
    localStorage.removeItem('twin_chats');
    localStorage.removeItem('twin_chat_history');
    localStorage.removeItem('chats');
    localStorage.removeItem('activeChatId');

    // Create empty default chat
    const initialChat: ChatSession = {
      id: `chat-${Date.now()}`,
      title: 'New Conversation',
      messages: [{
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Hello ${user.name}, I am your Enterprise AI Agronomist. How can I assist you with your farming operations today?`,
        timestamp: new Date().toISOString()
      }],
      isPinned: false,
      updatedAt: new Date().toISOString()
    };
    setChats([initialChat]);
    setActiveChatId(initialChat.id);
  }, [user.name]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, isGenerating]);

  const showError = useCallback((msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  }, []);

  // Handle Input resize
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px';
    }
  };

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: `chat-${Date.now()}`,
      title: 'New Conversation',
      messages: [{
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Hello ${user.name}, how can I help you today?`,
        timestamp: new Date().toISOString()
      }],
      isPinned: false,
      updatedAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setAttachedImage(null);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const togglePin = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c));
  };

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newChats = chats.filter(c => c.id !== chatId);
    setChats(newChats);
    if (activeChatId === chatId) {
      setActiveChatId(newChats.length > 0 ? newChats[0].id : null);
    }
  };

  // ========================
  // VOICE INPUT (Web Speech API)
  // ========================
  const toggleVoiceInput = useCallback(() => {
    if (!SpeechRecognition) {
      showError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (micStatus === 'listening') {
      // Stop recording
      recognitionRef.current?.stop();
      setMicStatus('processing');
      return;
    }

    // Start recording
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setMicStatus('listening');
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      // Append to existing input
      setInput(prev => {
        const trimmed = prev.trim();
        return trimmed ? trimmed + ' ' + transcript : transcript;
      });
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice Input Error]:', event.error);
      if (event.error === 'not-allowed') {
        showError('Microphone access denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        showError('No speech detected. Please try again.');
      } else {
        showError(`Voice input error: ${event.error}`);
      }
      setMicStatus('ready');
    };

    recognition.onend = () => {
      setMicStatus('ready');
      recognitionRef.current = null;
      // Auto-focus the textarea
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [micStatus, showError]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // ========================
  // IMAGE ATTACHMENT
  // ========================
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError('Invalid file type. Please upload JPG, PNG, or WEBP images only.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('Image too large. Maximum file size is 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract base64 portion (remove data:image/...;base64, prefix)
      const base64 = dataUrl.split(',')[1];
      setAttachedImage({
        dataUrl,
        base64,
        mimeType: file.type,
        fileName: file.name
      });
    };
    reader.onerror = () => {
      showError('Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);

    // Reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [showError]);

  const removeAttachedImage = useCallback(() => {
    setAttachedImage(null);
  }, []);

  // ========================
  // SEND MESSAGE
  // ========================
  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    const hasContent = trimmed.length > 0;
    const hasImage = !!attachedImage;

    if ((!hasContent && !hasImage) || isGenerating || !activeChatId) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed || (hasImage ? `[Attached image: ${attachedImage!.fileName}]` : ''),
      timestamp: new Date().toISOString(),
      imageUrl: attachedImage?.dataUrl
    };

    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        // Auto-rename chat if it's the first user message
        const isFirstMessage = c.messages.filter(m => m.role === 'user').length === 0;
        const newTitle = isFirstMessage
          ? (hasImage && !hasContent ? '📷 Image Analysis' : trimmed.substring(0, 30) + '...')
          : c.title;
        return {
          ...c,
          title: newTitle,
          messages: [...c.messages, userMessage],
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    }));

    // Capture image data before clearing
    const imageToSend = attachedImage;

    setInput('');
    setAttachedImage(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsGenerating(true);

    try {
      const payload: any = { userId: user.id, message: trimmed };
      if (imageToSend) {
        payload.base64Image = imageToSend.base64;
        payload.mimeType = imageToSend.mimeType;
      }
      console.log("[Frontend Request Payload]:", JSON.stringify({ ...payload, base64Image: payload.base64Image ? '[BASE64_DATA]' : undefined }));

      abortControllerRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      console.log("[Frontend API Response]:", JSON.stringify(data).substring(0, 500));
      
      if (data.success) {
        const assistantMessage: Message = {
          id: `msg-${Date.now()+1}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString()
        };
        console.log("[Frontend Rendered Message]:", assistantMessage.content.substring(0, 100));
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage] } : c));
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Cancelled
      const errorContent = err.message || "Failed to connect to backend.";
      showError(errorContent);
      const errorMessage: Message = {
        id: `msg-${Date.now()+1}`,
        role: 'assistant',
        content: `⚠️ **AI Assistant Error**\n\n${errorContent}\n\nPlease try again or check your connection.`,
        timestamp: new Date().toISOString()
      };
      console.error("[Frontend Error Rendering]:", errorMessage.content);
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, errorMessage] } : c));
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportChat = () => {
    if (!activeChat) return;
    const content = activeChat.messages.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chat_Export_${activeChat.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredChats = chats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const pinnedChats = filteredChats.filter(c => c.isPinned);
  const unpinnedChats = filteredChats.filter(c => !c.isPinned);

  // Determine if send button should be enabled
  const canSend = (input.trim().length > 0 || !!attachedImage) && !isGenerating && !!activeChatId;

  return (
    <div className="bg-[#121024] rounded-3xl border border-white/10 flex overflow-hidden h-[calc(100vh-120px)] min-h-[600px] shadow-2xl relative">
      
      {/* Error Toast */}
      <AnimatePresence>
        {errorToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 z-[100] px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border backdrop-blur-xl bg-red-500/20 border-red-500/50 text-red-200"
          >
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-bold">{errorToast}</span>
            <button onClick={() => setErrorToast(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input for image upload */}
      <input 
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-white/10 bg-white/5 backdrop-blur-xl flex flex-col z-20 absolute lg:relative h-full shrink-0"
          >
            <div className="p-4 space-y-4">
              <button 
                onClick={createNewChat}
                className="w-full py-3 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:opacity-90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#9333EA]/20 focus:outline-none"
              >
                <Plus className="h-4 w-4" /> New Conversation
              </button>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search history..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#9333EA] transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
              {pinnedChats.length > 0 && (
                <div className="mb-6">
                  <h4 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Star className="h-3 w-3" /> Pinned
                  </h4>
                  <div className="space-y-1">
                    {pinnedChats.map(chat => (
                      <div 
                        key={chat.id}
                        onClick={() => { setActiveChatId(chat.id); if(window.innerWidth < 1024) setSidebarOpen(false); }}
                        className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${activeChatId === chat.id ? 'bg-[#9333EA]/20 border border-[#9333EA]/30' : 'hover:bg-white/5 border border-transparent'}`}
                      >
                        <MessageSquare className={`h-4 w-4 shrink-0 ${activeChatId === chat.id ? 'text-[#D946EF]' : 'text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${activeChatId === chat.id ? 'text-white' : 'text-gray-300'}`}>{chat.title}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button onClick={(e) => togglePin(chat.id, e)} className="p-1.5 text-yellow-500 hover:bg-yellow-500/20 rounded-lg"><Star className="h-3.5 w-3.5 fill-current" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recent</h4>
                {unpinnedChats.length === 0 ? (
                  <p className="px-3 text-sm text-gray-500 italic">No conversations found.</p>
                ) : (
                  <div className="space-y-1">
                    {unpinnedChats.map(chat => (
                      <div 
                        key={chat.id}
                        onClick={() => { setActiveChatId(chat.id); if(window.innerWidth < 1024) setSidebarOpen(false); }}
                        className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${activeChatId === chat.id ? 'bg-[#9333EA]/20 border border-[#9333EA]/30' : 'hover:bg-white/5 border border-transparent'}`}
                      >
                        <MessageSquare className={`h-4 w-4 shrink-0 ${activeChatId === chat.id ? 'text-[#D946EF]' : 'text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${activeChatId === chat.id ? 'text-white' : 'text-gray-300'}`}>{chat.title}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity bg-[#1a1736] pl-2 absolute right-2">
                          <button onClick={(e) => togglePin(chat.id, e)} className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white"><Star className="h-3.5 w-3.5" /></button>
                          <button onClick={(e) => deleteChat(chat.id, e)} className="p-1 hover:bg-red-500/20 rounded-md text-gray-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Live Mode Enabled */}
            <div className="p-4 border-t border-white/10 text-center">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Live Model Connected</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        
        {/* Header */}
        <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors focus:outline-none">
              {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </button>
            <h2 className="text-base font-bold text-white truncate max-w-[200px] md:max-w-md">{activeChat?.title || 'No Conversation Selected'}</h2>
          </div>
          
          {activeChat && (
            <div className="flex items-center gap-2">
              <button onClick={exportChat} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Export Chat">
                <Download className="h-4 w-4" />
              </button>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Share Chat">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
          {activeChat ? (
            <div className="max-w-4xl mx-auto space-y-8 pb-4">
              
              {/* Welcome Screen for empty chat */}
              {activeChat.messages.length <= 1 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-10">
                  <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#9333EA] to-[#C026D3] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#9333EA]/30">
                      <Bot className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">Enterprise AI Agronomist</h1>
                    <p className="text-[#E9D5FF] max-w-md mx-auto">Your dedicated intelligent assistant for crop management, disease diagnostics, and yield optimization.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {SUGGESTED_PROMPTS.map((prompt, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSend(prompt.text)}
                        className="p-4 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#9333EA]/50 rounded-2xl text-left transition-all group focus:outline-none"
                      >
                        <prompt.icon className="h-5 w-5 text-[#D946EF] mb-3 opacity-80 group-hover:opacity-100" />
                        <p className="text-sm font-medium text-gray-300 group-hover:text-white">{prompt.text}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-black/40 border border-white/5 hover:border-white/20 rounded-xl text-xs font-bold text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> Attach Image
                    </button>
                    <button 
                      onClick={toggleVoiceInput}
                      disabled={micStatus === 'unsupported'}
                      className="px-4 py-2 bg-black/40 border border-white/5 hover:border-white/20 rounded-xl text-xs font-bold text-gray-400 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-30"
                    >
                      <Mic className="h-3.5 w-3.5" /> Voice Input
                    </button>
                    <button className="px-4 py-2 bg-black/40 border border-white/5 hover:border-white/20 rounded-xl text-xs font-bold text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
                      <Activity className="h-3.5 w-3.5" /> Disease Scan
                    </button>
                    <button className="px-4 py-2 bg-black/40 border border-white/5 hover:border-white/20 rounded-xl text-xs font-bold text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
                      <Map className="h-3.5 w-3.5" /> Farm Data
                    </button>
                  </div>
                </motion.div>
              )}

              {activeChat.messages.map((msg, idx) => (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9333EA] to-[#C026D3] flex items-center justify-center shrink-0 shadow-lg shadow-[#9333EA]/20 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  
                  <div className={`group relative max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div className={`px-5 py-4 rounded-3xl text-sm leading-relaxed shadow-lg ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-white rounded-tr-sm' 
                        : 'bg-black/40 border border-[#9333EA]/20 text-gray-200 rounded-tl-sm markdown-body'
                    }`}>
                      {/* Show attached image in user messages */}
                      {msg.imageUrl && (
                        <div className="mb-3">
                          <img 
                            src={msg.imageUrl} 
                            alt="Attached" 
                            className="max-w-full max-h-64 rounded-xl border border-white/10 object-contain"
                          />
                        </div>
                      )}
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    
                    {/* Message Actions */}
                    {msg.role === 'assistant' && (
                      <div className="absolute -bottom-8 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button onClick={() => handleCopy(msg.content, msg.id)} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors">
                          {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-[#9333EA] hover:bg-[#9333EA]/10 rounded-md transition-colors"><ThumbsUp className="h-3.5 w-3.5" /></button>
                        <button className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"><ThumbsDown className="h-3.5 w-3.5" /></button>
                        {idx === activeChat.messages.length - 1 && (
                          <button className="p-1.5 text-gray-400 hover:text-[#D946EF] hover:bg-[#D946EF]/10 rounded-md transition-colors ml-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                            <RefreshCw className="h-3 w-3" /> Regenerate
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 mt-1 order-2">
                      <UserIcon className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isGenerating && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9333EA] to-[#C026D3] flex items-center justify-center shrink-0 shadow-lg shadow-[#9333EA]/20 mt-1">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="px-5 py-4 rounded-3xl bg-black/40 border border-[#9333EA]/20 rounded-tl-sm flex items-center gap-2 h-[52px]">
                    <span className="w-2 h-2 bg-[#D946EF] rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-[#D946EF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-[#D946EF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    <span className="text-xs text-[#E9D5FF] ml-2 font-medium">Analyzing parameters...</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} className="h-8" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 flex-col gap-4">
              <MessageSquare className="h-12 w-12 opacity-20" />
              <p>Select a conversation or start a new one.</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-[#121024] via-[#121024] to-transparent shrink-0">
          <div className="max-w-4xl mx-auto relative">
            
            {isGenerating && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <button onClick={handleStop} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-100 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md transition-colors shadow-lg">
                  <StopCircle className="h-4 w-4" /> Stop Generation
                </button>
              </div>
            )}

            {/* Image Preview */}
            <AnimatePresence>
              {attachedImage && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-3 flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl"
                >
                  <div className="relative group">
                    <img 
                      src={attachedImage.dataUrl} 
                      alt="Preview" 
                      className="w-20 h-20 rounded-xl object-cover border border-white/20"
                    />
                    <button 
                      onClick={removeAttachedImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{attachedImage.fileName}</p>
                    <p className="text-xs text-gray-400 mt-1">Ready to analyze with Gemini Vision</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Eye className="h-3 w-3 text-[#D946EF]" />
                      <span className="text-[10px] text-[#D946EF] font-bold uppercase tracking-wider">Vision Analysis Enabled</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-black/60 border border-white/20 rounded-3xl p-2 pr-4 flex items-end gap-2 shadow-2xl backdrop-blur-xl focus-within:border-[#9333EA] transition-colors">
              {/* Attach Image Button */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-[#D946EF] hover:bg-white/5 rounded-xl transition-colors shrink-0 focus:outline-none"
                title="Attach image (JPG, PNG, WEBP)"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Message AI Agronomist... (Shift+Enter for new line)"
                className="w-full bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none max-h-[150px] min-h-[44px] py-3 leading-relaxed"
                rows={1}
                disabled={isGenerating}
              />
              
              <div className="flex items-center gap-2 shrink-0 pb-1">
                {/* Voice Input Button */}
                <button 
                  onClick={toggleVoiceInput}
                  disabled={micStatus === 'unsupported' || micStatus === 'processing'}
                  className={`relative p-2 rounded-xl transition-all focus:outline-none ${
                    micStatus === 'listening' 
                      ? 'text-red-400 bg-red-500/20 border border-red-500/40 animate-pulse' 
                      : micStatus === 'processing'
                        ? 'text-yellow-400 bg-yellow-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                  } disabled:opacity-30`}
                  title={
                    micStatus === 'unsupported' ? 'Speech recognition not supported' :
                    micStatus === 'listening' ? 'Click to stop recording' :
                    micStatus === 'processing' ? 'Processing speech...' :
                    'Click to start voice input'
                  }
                >
                  {micStatus === 'listening' ? (
                    <MicOff className="h-5 w-5" />
                  ) : micStatus === 'processing' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                  {micStatus === 'listening' && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  )}
                </button>

                {/* Send Button */}
                <button
                  onClick={() => handleSend(input)}
                  disabled={!canSend}
                  className="p-3 bg-gradient-to-r from-[#9333EA] to-[#C026D3] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:grayscale focus:outline-none shadow-lg shadow-[#9333EA]/30"
                  title={isGenerating ? 'AI is generating...' : 'Send message'}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-3">
                {micStatus === 'listening' && (
                  <motion.span 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Listening...
                  </motion.span>
                )}
                {micStatus === 'processing' && (
                  <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing...
                  </span>
                )}
                {attachedImage && (
                  <span className="text-[10px] text-[#D946EF] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3" />
                    1 image attached
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-500 font-medium">Enterprise AI Agronomist can make mistakes. Verify critical farming decisions.</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
