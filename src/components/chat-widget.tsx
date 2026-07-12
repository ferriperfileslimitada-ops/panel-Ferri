import React, { useState, useEffect, useRef } from 'react';
import { useGetIdentity } from '@refinedev/core';
import { Send, Plus, Loader2, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabaseClient } from '@/providers/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  requires_confirmation?: boolean;
  action_details?: any;
};

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: identity } = useGetIdentity<{ id: string; name: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || (window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  const handleSend = async (text: string, confirmedAction?: any) => {
    if (!text.trim() && !confirmedAction) return;

    const newMessage: Message = { id: Date.now().toString(), role: 'user', content: text };
    
    if (!confirmedAction) {
      setMessages(prev => [...prev, newMessage]);
      setInput('');
    }

    setIsLoading(true);

    try {
      const { data: session } = await supabaseClient.auth.getSession();
      const token = session?.session?.access_token;

      const history = messages.map(m => ({ role: m.role, content: m.content })).filter(m => m.content);

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          history,
          conversation_id: conversationId,
          confirmed_action: confirmedAction
        })
      });

      if (!response.ok) {
        throw new Error('Error de conexión');
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        requires_confirmation: data.requires_confirmation,
        action_details: data.action_details
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (error) {
      console.error(error);
      toast.error('Error al conectar con el Asistente');
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Lo siento, hubo un problema de conexión.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAction = (actionDetails: any) => {
    handleSend('Acción confirmada', actionDetails);
  };

  const cancelAction = () => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: 'Acción cancelada.' }]);
    setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: 'Entendido, he cancelado la operación.' }]);
  };

  const suggestions = [
    "Muéstrame productos con existencias",
    "Busca el cliente por NIT",
    "Crea una cotización"
  ];

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-50 transition-transform hover:scale-105 ${isOpen ? 'hidden' : 'flex'}`}
        size="icon"
      >
        <span className="text-2xl">🤖</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-6 w-[400px] h-[600px] max-h-[80vh] bg-card border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/50 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="bg-primary/20 p-1.5 rounded-lg">
                  <span className="text-lg">🤖</span>
                </div>
                <div>
                  <h2 className="font-semibold text-sm">Asistente Ferriperfiles</h2>
                  <p className="text-[10px] text-muted-foreground">Conectado a Siigo MCP</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startNewConversation} title="Nueva conversación">
                  <Plus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="bg-muted p-4 rounded-full mb-1">
                    <span className="text-3xl">👋</span>
                  </div>
                  <h3 className="text-lg font-medium text-foreground">¡Hola, {identity?.name || 'equipo'}!</h3>
                  <p className="text-sm text-muted-foreground max-w-[250px]">
                    Soy tu asistente. Puedo consultar Siigo o ayudarte con cotizaciones.
                  </p>
                  <div className="flex flex-col gap-2 mt-4 w-full px-4">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s)}
                        className="px-3 py-2 bg-primary/5 hover:bg-primary/10 text-primary text-xs rounded-lg transition-colors border border-primary/10 text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted border rounded-tl-sm'}`}>
                      {m.content && (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      )}
                      
                      {m.requires_confirmation && m.action_details && (
                        <Card className="mt-2 p-3 bg-background border-warning shadow-sm">
                          <h4 className="font-medium text-warning mb-1 flex items-center gap-1 text-xs">
                            <span>⚠️</span> Requiere confirmación
                          </h4>
                          <p className="text-xs mb-2 text-muted-foreground">{m.action_details.summary}</p>
                          <div className="flex flex-col gap-1.5">
                            <Button size="sm" className="h-7 text-xs w-full" onClick={() => confirmAction(m.action_details)}>
                              Confirmar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={cancelAction}>
                              Cancelar
                            </Button>
                          </div>
                        </Card>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted border rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t bg-muted/30">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                className="flex items-center gap-2"
              >
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 rounded-full text-sm h-9 bg-background border-muted-foreground/20 focus-visible:ring-primary/50"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="rounded-full h-9 w-9 shrink-0"
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
