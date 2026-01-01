import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Smartphone, MoreVertical, Search, CheckCheck, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';

// URL do Backend (Cloud Run)
const BACKEND_URL = "https://bruna-bot-858321630792.us-central1.run.app"; 

export default function WhatsAppSimulator() {
  // --- ESTADOS ---
  const [sessions, setSessions] = useState([]); // Lista de contatos na lateral
  const [activeSession, setActiveSession] = useState(null); // Contato selecionado (Objeto inteiro)
  
  const [messages, setMessages] = useState([]); // Mensagens da conversa atual
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // Controle do Modal
  
  // Estados do Formulário de Novo Contato
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const scrollRef = useRef(null);

  // --- 1. Carregar mensagens quando troca de sessão ---
  useEffect(() => {
    if (!activeSession) {
        setMessages([]);
        return;
    }

    const fetchHistory = async () => {
      // Busca ID da conversa no banco
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
        setMessages([]); // Conversa nova (ainda não existe no banco)
      }
    };

    fetchHistory();
    // (Opcional) Aqui poderia ficar o Realtime, mas vamos confiar na resposta da API para ser mais rápido
  }, [activeSession]);

  // Scroll automático para o fim
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // --- 2. Criar Nova Sessão (Modal) ---
  const handleCreateSession = (e) => {
    e.preventDefault(); // Evita recarregar página
    if (!newClientName || !newClientPhone) return;

    const newSession = {
        name: newClientName,
        phone: newClientPhone, // O ID agora é o telefone que você digitou
        time: 'Agora'
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);
    
    // Limpa e fecha modal
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

    // --- ATUALIZAÇÃO OTIMISTA (Aparece na hora!) ---
    // Adicionamos a mensagem na tela localmente antes do servidor responder
    const optimisticMsg = {
        id: Date.now(), // ID temporário
        body: textToSend,
        direction: 'inbound', // No simulador, inbound é o "Eu/Cliente"
        created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // Envia para o Backend
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

      // --- RESPOSTA DA IA ---
      // Quando a Bruna responde, adicionamos o balão dela
      const aiMsg = {
        id: Date.now() + 1,
        body: data.reply,
        direction: 'outbound', // Outbound é a Bruna
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("Erro no simulador:", error);
      alert(`Erro: ${error.message}`);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {/* --- MODAL DE NOVA CONVERSA --- */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-xl shadow-2xl p-6 w-96"
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Nova Conversa</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-red-500">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleCreateSession} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Nome do Cliente</label>
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full p-2 border border-gray-300 rounded focus:border-teal-500 outline-none"
                            placeholder="Ex: João da Silva"
                            value={newClientName}
                            onChange={e => setNewClientName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Número (ID)</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-gray-300 rounded focus:border-teal-500 outline-none"
                            placeholder="Ex: 5511999999999"
                            value={newClientPhone}
                            onChange={e => setNewClientPhone(e.target.value)}
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={!newClientName || !newClientPhone}
                        className="w-full bg-teal-600 text-white py-2 rounded font-semibold hover:bg-teal-700 disabled:opacity-50 transition"
                    >
                        Iniciar Conversa
                    </button>
                </form>
            </motion.div>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <div className="w-[30%] max-w-[400px] bg-white border-r border-gray-300 flex flex-col">
        <div className="bg-[#f0f2f5] p-4 flex justify-between items-center h-[60px] border-b border-gray-200">
          <div className="font-bold text-gray-600 flex items-center gap-2">
            <Smartphone size={20} /> Simulador
          </div>
          <div className="flex gap-4 text-gray-500">
            <button onClick={() => setIsModalOpen(true)} title="Adicionar Número" className="bg-white p-1 rounded-full shadow hover:text-teal-600 transition">
              <Plus size={20} />
            </button>
            <MoreVertical size={20} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
              <div className="text-center mt-10 text-gray-400 p-4">
                  <p>Nenhuma conversa.</p>
                  <p className="text-sm">Clique no "+" para adicionar.</p>
              </div>
          ) : (
            sessions.map((session, idx) => (
                <div 
                key={idx}
                onClick={() => setActiveSession(session)}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-[#f5f6f6] transition ${activeSession?.phone === session.phone ? 'bg-[#f0f2f5]' : ''}`}
                >
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                    <User className="text-white" size={24} />
                </div>
                <div className="flex-1 border-b border-gray-100 pb-3">
                    <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{session.name}</span>
                    <span className="text-xs text-gray-400">{session.time}</span>
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

      {/* --- CHAT AREA --- */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>

        {activeSession ? (
            <>
                {/* Header Chat */}
                <div className="bg-[#f0f2f5] px-4 py-3 flex justify-between items-center h-[60px] border-l border-gray-300 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                        <User className="text-white" size={24} />
                    </div>
                    <div>
                    <div className="font-medium text-gray-900">{activeSession.name}</div>
                    <div className="text-xs text-gray-500">
                        {isTyping ? <span className="text-teal-600 font-bold">digitando...</span> : 'online'}
                    </div>
                    </div>
                </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="flex justify-center mt-10">
                            <span className="bg-[#ffeecd] text-gray-800 text-xs px-3 py-1 rounded shadow text-center">
                                Esta é uma simulação. As mensagens enviadas aqui <br/>serão processadas pela IA como se viessem deste número.
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
                                max-w-[65%] px-4 py-2 rounded-lg shadow-sm text-[14.2px] leading-5 relative
                                ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}
                            `}>
                                <div className={`absolute top-0 w-0 h-0 border-[6px] border-transparent 
                                ${isMe ? 'right-[-6px] border-t-[#d9fdd3] border-l-[#d9fdd3]' : 'left-[-6px] border-t-white border-r-white'}
                                `}></div>
                                <div className="text-gray-800 whitespace-pre-wrap">{msg.body}</div>
                                <div className="flex justify-end items-center gap-1 mt-1 -mb-1 opacity-60">
                                <span className="text-[11px]">
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
                <div className="bg-[#f0f2f5] px-4 py-3 z-10">
                <div className="flex items-center gap-2">
                    <input
                    type="text"
                    className="flex-1 py-3 px-4 rounded-lg border-none focus:ring-0 focus:outline-none bg-white text-gray-700 placeholder-gray-400"
                    placeholder="Digite uma mensagem"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    autoFocus
                    />
                    <button 
                    onClick={handleSendMessage}
                    className={`p-3 rounded-full transition ${inputText.trim() ? 'text-[#00a884] hover:bg-gray-200' : 'text-gray-400'}`}
                    >
                    <Send size={24} />
                    </button>
                </div>
                </div>
            </>
        ) : (
            // Placeholder quando não tem conversa selecionada
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-b-[6px] border-[#4ad978]">
                <Smartphone size={64} className="mb-4 text-gray-300" />
                <h1 className="text-2xl font-light text-gray-600 mb-2">Simulador WhatsApp</h1>
                <p className="text-sm text-center max-w-md">
                    Clique no botão <strong>+</strong> para iniciar uma nova conversa simulada com um cliente específico.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}