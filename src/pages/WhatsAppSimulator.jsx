import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Smartphone, MoreVertical, Search, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';

// URL do seu Backend no Cloud Run
const BACKEND_URL = "https://bruna-bot-SEU-PROJETO.us-central1.run.app"; 

export default function WhatsAppSimulator() {
  // Estado para gerenciar "Sessões" (Números falsos diferentes)
  const [sessions, setSessions] = useState([
    { id: 'TESTE_01', name: 'Cliente Teste 01', lastMsg: '', time: '' }
  ]);
  const [activeSessionId, setActiveSessionId] = useState('TESTE_01');
  
  // Estado do Chat
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollRef = useRef(null);

  // --- 1. Carregar mensagens e configurar Realtime ao trocar de sessão ---
  useEffect(() => {
    if (!activeSessionId) return;

    const fetchHistory = async () => {
      // Primeiro, descobre o ID interno da conversa no banco
      const { data: conv } = await supabase
        .table('conversations')
        .select('id')
        .eq('wa_id', activeSessionId)
        .single();

      if (conv) {
        const { data: msgs } = await supabase
          .table('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        
        if (msgs) setMessages(msgs);
      } else {
        setMessages([]); // Conversa nova
      }
    };

    fetchHistory();

    // Inscrever no Realtime para ouvir a resposta da Bruna
    // Nota: Ouvimos a tabela 'messages' filtrando onde o wa_id da conversa bate (precisa de join) 
    // OU para simplificar no simulador, ouvimos tudo e filtramos no client-side ou usamos o ID da conversa.
    // Simplificação robusta: Ouvir INSERT na tabela messages.
    const channel = supabase
      .channel('simulator-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        
        // Verifica se a mensagem nova pertence à sessão atual
        // Como o payload só traz o conversation_id, precisamos validar
        const { data: conv } = await supabase
          .table('conversations')
          .select('wa_id')
          .eq('id', payload.new.conversation_id)
          .single();

        if (conv && conv.wa_id === activeSessionId) {
          setMessages((prev) => [...prev, payload.new]);
          setIsTyping(false); // Se chegou msg, parou de digitar
          scrollToBottom();
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeSessionId]);

  // --- 2. Função de Enviar Mensagem ---
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const textToSend = inputText;
    setInputText('');
    scrollToBottom();
    setIsTyping(true); // Simula "esperando resposta"

    // Otimisticamente adiciona na tela (opcional, pois o realtime já traria)
    // Mas para UX instantânea é bom.
    
    try {
      const response = await fetch(`${BACKEND_URL}/simulator/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wa_id: activeSessionId,
          message: textToSend
        })
      });
      
      if (!response.ok) throw new Error('Falha ao enviar');
      
    } catch (error) {
      console.error("Erro no simulador:", error);
      setIsTyping(false);
      alert("Erro ao conectar com a Bruna. Verifique o console.");
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const createNewSession = () => {
    const randomId = Math.floor(Math.random() * 9000) + 1000;
    const newId = `55119${randomId}`; // Formato BR fake
    const newSession = { id: newId, name: `Novo Cliente (${randomId})`, lastMsg: '', time: 'Agora' };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newId);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      
      {/* --- SIDEBAR (Lista de Conversas) --- */}
      <div className="w-[30%] max-w-[400px] bg-white border-r border-gray-300 flex flex-col">
        {/* Header Sidebar */}
        <div className="bg-[#f0f2f5] p-4 flex justify-between items-center h-[60px] border-b border-gray-200">
          <div className="font-bold text-gray-600 flex items-center gap-2">
            <Smartphone size={20} /> Simulador WhatsApp
          </div>
          <div className="flex gap-4 text-gray-500">
            <button onClick={createNewSession} title="Nova Conversa Fake">
              <Plus className="hover:text-teal-600 transition" />
            </button>
            <MoreVertical size={20} />
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2 border-b border-gray-100 bg-white">
          <div className="bg-[#f0f2f5] rounded-lg px-4 py-2 flex items-center gap-3">
            <Search size={18} className="text-gray-500" />
            <input 
              type="text" 
              placeholder="Pesquisar ou começar nova conversa"
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>
        </div>

        {/* Lista de Sessões */}
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <div 
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-[#f5f6f6] transition ${activeSessionId === session.id ? 'bg-[#f0f2f5]' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-white overflow-hidden">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.id}`} alt="avatar" />
              </div>
              <div className="flex-1 border-b border-gray-100 pb-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">{session.name}</span>
                  <span className="text-xs text-gray-400">{session.time}</span>
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {session.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- CHAT AREA (Janela Principal) --- */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative">
        {/* Background Pattern (Opcional, estilo Zap) */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>

        {/* Header Chat */}
        <div className="bg-[#f0f2f5] px-4 py-3 flex justify-between items-center h-[60px] border-l border-gray-300 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeSessionId}`} alt="avatar" />
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {sessions.find(s => s.id === activeSessionId)?.name || activeSessionId}
              </div>
              <div className="text-xs text-gray-500">
                {isTyping ? 'digitando...' : 'online'}
              </div>
            </div>
          </div>
          <div className="text-gray-500">
             <Search size={20} />
          </div>
        </div>

        {/* Area de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10 custom-scrollbar">
          <AnimatePresence>
            {messages.map((msg, idx) => {
              const isMe = msg.direction === 'inbound'; // No simulador, Inbound sou EU (o cliente fake)
              return (
                <motion.div
                  key={msg.id || idx}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[65%] px-4 py-2 rounded-lg shadow-sm text-[14.2px] leading-5 relative
                    ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}
                  `}>
                    {/* "Triângulo" do balão */}
                    <div className={`absolute top-0 w-0 h-0 border-[6px] border-transparent 
                      ${isMe 
                        ? 'right-[-6px] border-t-[#d9fdd3] border-l-[#d9fdd3]' 
                        : 'left-[-6px] border-t-white border-r-white'}
                    `}></div>

                    <div className="text-gray-800 break-words whitespace-pre-wrap">
                      {msg.body}
                    </div>
                    
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
            />
            <button 
              onClick={handleSendMessage}
              className={`p-3 rounded-full transition ${inputText.trim() ? 'text-[#00a884] hover:bg-gray-200' : 'text-gray-400'}`}
            >
              <Send size={24} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}