import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Smartphone, MoreVertical, Search, CheckCheck, User, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';

// URL do Backend (Cloud Run)
const BACKEND_URL = "https://bruna-bot-858321630792.us-central1.run.app"; 

export default function WhatsAppSimulator() {
  // --- ESTADOS ---
  const [sessions, setSessions] = useState([]); 
  const [activeSession, setActiveSession] = useState(null); 
  
  const [messages, setMessages] = useState([]); 
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); 
  
  // Estados do Formulário
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const scrollRef = useRef(null);

  // --- 1. Carregar mensagens ---
  useEffect(() => {
    if (!activeSession) {
        setMessages([]);
        return;
    }

    const fetchHistory = async () => {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('wa_id', activeSession.phone)
        .maybeSingle();

      if (conv) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        
        if (msgs) setMessages(msgs);
      } else {
        setMessages([]);
      }
    };

    fetchHistory();
  }, [activeSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeSession]); // Scroll também quando abrir a conversa

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // --- 2. Criar Nova Sessão ---
  const handleCreateSession = (e) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) return;

    const newSession = {
        name: newClientName,
        phone: newClientPhone,
        time: 'Agora'
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession); // Já abre o chat direto no mobile também
    
    setNewClientName('');
    setNewClientPhone('');
    setIsModalOpen(false);
  };

  // --- 3. Enviar Mensagem ---
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSession) return;
    
    const textToSend = inputText;
    const currentPhone = activeSession.phone;

    setInputText('');
    setIsTyping(true);

    const optimisticMsg = {
        id: Date.now(),
        body: textToSend,
        direction: 'inbound',
        created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const response = await fetch(`${BACKEND_URL}/simulator/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wa_id: currentPhone,
          name: activeSession.name,
          message: textToSend
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Erro ao enviar');

      const aiMsg = {
        id: Date.now() + 1,
        body: data.reply,
        direction: 'outbound',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("Erro:", error);
      alert(`Erro: ${error.message}`);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* --- MODAL (Responsivo) --- */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Nova Conversa</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-red-500">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleCreateSession} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Nome</label>
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full p-3 border border-gray-300 rounded focus:border-teal-500 outline-none text-base"
                            placeholder="Ex: Cliente João"
                            value={newClientName}
                            onChange={e => setNewClientName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Telefone (ID)</label>
                        <input 
                            type="tel" 
                            className="w-full p-3 border border-gray-300 rounded focus:border-teal-500 outline-none text-base"
                            placeholder="Ex: 5511999999999"
                            value={newClientPhone}
                            onChange={e => setNewClientPhone(e.target.value)}
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={!newClientName || !newClientPhone}
                        className="w-full bg-teal-600 text-white py-3 rounded font-semibold hover:bg-teal-700 disabled:opacity-50 transition active:scale-95"
                    >
                        Iniciar Conversa
                    </button>
                </form>
            </motion.div>
        </div>
      )}

      {/* --- SIDEBAR (Lista) --- 
          Lógica Mobile: Se tem activeSession, esconde a sidebar (hidden). 
          No Desktop (md:flex), sempre mostra.
      */}
      <div className={`
          flex-col bg-white border-r border-gray-300 
          w-full md:w-[30%] md:max-w-[400px] 
          ${activeSession ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Header Sidebar */}
        <div className="bg-[#f0f2f5] p-4 flex justify-between items-center h-[60px] border-b border-gray-200 shrink-0">
          <div className="font-bold text-gray-600 flex items-center gap-2">
            <Smartphone size={20} /> <span className="hidden sm:inline">Simulador</span>
          </div>
          <div className="flex gap-4 text-gray-500">
            <button onClick={() => setIsModalOpen(true)} className="bg-white p-2 rounded-full shadow hover:text-teal-600 transition active:scale-90">
              <Plus size={20} />
            </button>
            <MoreVertical size={20} />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
              <div className="text-center mt-20 text-gray-400 p-6">
                  <p className="mb-2">Nenhuma conversa ativa.</p>
                  <button onClick={() => setIsModalOpen(true)} className="text-teal-600 font-medium hover:underline">
                      Criar nova conversa
                  </button>
              </div>
          ) : (
            sessions.map((session, idx) => (
                <div 
                key={idx}
                onClick={() => setActiveSession(session)}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-[#f5f6f6] transition border-b border-gray-100 ${activeSession?.phone === session.phone ? 'bg-[#f0f2f5]' : ''}`}
                >
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden shrink-0">
                    <User className="text-white" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-900 truncate">{session.name}</span>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{session.time}</span>
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                    {session.phone}
                    </div>
                </div>
                </div>
            ))
          )}
        </div>
      </div>

      {/* --- CHAT AREA --- 
          Lógica Mobile: Se NÃO tem activeSession, esconde o chat (hidden).
          No Desktop (md:flex), sempre mostra se tiver activeSession, ou placeholder.
      */}
      <div className={`
          flex-col bg-[#efeae2] relative w-full md:flex-1
          ${!activeSession ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>

        {activeSession ? (
            <>
                {/* Header Chat */}
                <div className="bg-[#f0f2f5] px-4 py-2 flex justify-between items-center h-[60px] border-l border-gray-300 z-10 shadow-sm shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    {/* Botão Voltar (SÓ NO MOBILE) */}
                    <button 
                        onClick={() => setActiveSession(null)} 
                        className="md:hidden text-gray-600 hover:bg-gray-200 p-1 rounded-full mr-1"
                    >
                        <ArrowLeft size={24} />
                    </button>

                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden shrink-0">
                        <User className="text-white" size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{activeSession.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                            {isTyping ? <span className="text-teal-600 font-bold">digitando...</span> : 'online'}
                        </div>
                    </div>
                </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="flex justify-center mt-10 px-6">
                            <span className="bg-[#ffeecd] text-gray-800 text-xs px-3 py-2 rounded shadow text-center leading-relaxed">
                                🔒 Esta é uma simulação. Mensagens enviadas aqui interagem diretamente com a Bruna.
                            </span>
                        </div>
                    )}
                    
                    <AnimatePresence>
                        {messages.map((msg, idx) => {
                        const isMe = msg.direction === 'inbound';
                        return (
                            <motion.div
                            key={msg.id || idx}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                            <div className={`
                                max-w-[85%] md:max-w-[65%] px-3 py-2 rounded-lg shadow-sm text-[15px] leading-snug relative break-words
                                ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}
                            `}>
                                <div className={`absolute top-0 w-0 h-0 border-[6px] border-transparent 
                                ${isMe ? 'right-[-6px] border-t-[#d9fdd3] border-l-[#d9fdd3]' : 'left-[-6px] border-t-white border-r-white'}
                                `}></div>
                                <div className="text-gray-800 whitespace-pre-wrap">{msg.body}</div>
                                <div className="flex justify-end items-center gap-1 mt-1 -mb-1 opacity-60">
                                <span className="text-[11px] min-w-[50px] text-right">
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                {isMe && <CheckCheck size={14} className="text-blue-500" />}
                                </div>
                            </div>
                            </motion.div>
                        );
                        })}
                    </AnimatePresence>
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <div className="bg-[#f0f2f5] px-2 py-2 md:px-4 md:py-3 z-10 shrink-0">
                <div className="flex items-end gap-2 max-w-full">
                    <div className="bg-white flex-1 rounded-2xl border border-gray-100 flex items-center px-4 py-2 shadow-sm">
                        <input
                        type="text"
                        className="flex-1 border-none focus:ring-0 focus:outline-none bg-transparent text-gray-700 placeholder-gray-400 max-h-32 overflow-y-auto"
                        placeholder="Mensagem"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        enterKeyHint="send" // Melhora o teclado no celular
                        />
                    </div>
                    <button 
                    onClick={handleSendMessage}
                    className={`p-3 rounded-full transition shadow-sm mb-0.5 ${inputText.trim() ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-gray-200 text-gray-400'}`}
                    >
                    <Send size={20} />
                    </button>
                </div>
                </div>
            </>
        ) : (
            // Placeholder Desktop
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-500 border-b-[6px] border-[#4ad978] h-full">
                <Smartphone size={64} className="mb-4 text-gray-300" />
                <h1 className="text-2xl font-light text-gray-600 mb-2">Simulador Mobile</h1>
                <p className="text-sm text-center max-w-md px-4">
                    Agora otimizado para celulares! <br/>
                    Selecione ou crie uma conversa para começar.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}
