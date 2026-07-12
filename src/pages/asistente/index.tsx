import React, { useState, useEffect, useRef } from 'react';
import { useGetIdentity } from '@refinedev/core';
import { Send, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

import { supabaseClient } from '@/providers/supabase-client';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  requires_confirmation?: boolean;
  action_details?: any;
};

export const Asistente = () => {
  const { data: identity } = useGetIdentity<{ id: string; name: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    // scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

      // Extract only role and content for history
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
    "Busca el producto Perfil estructural",
    "Muéstrame productos con existencias",
    "Busca el cliente por NIT",
    "Crea una cotización"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-card border rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h2 className="font-semibold text-lg">Asistente Ferriperfiles</h2>
            <p className="text-xs text-muted-foreground">Conectado a Siigo MCP Orbit</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={startNewConversation}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Conversación
        </Button>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="bg-muted p-4 rounded-full mb-2">
              <span className="text-4xl">👋</span>
            </div>
            <h3 className="text-xl font-medium text-foreground">¡Hola, {identity?.name || 'equipo'}!</h3>
            <p className="text-muted-foreground max-w-sm">
              Soy tu asistente operativo. Puedo ayudarte a consultar productos, clientes y crear cotizaciones en Siigo.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-sm rounded-full transition-colors border border-primary/20"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border'}`}>
                {m.content && (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                )}
                
                {m.requires_confirmation && m.action_details && (
                  <Card className="mt-3 p-4 bg-background border-warning shadow-sm">
                    <h4 className="font-semibold text-warning mb-2 flex items-center gap-2">
                      <span>⚠️</span> Requiere confirmación
                    </h4>
                    <p className="text-sm mb-3">{m.action_details.summary}</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto mb-4 border text-muted-foreground">
                      {JSON.stringify(m.action_details.tool_args, null, 2)}
                    </pre>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirmAction(m.action_details)}>
                        Confirmar Acción
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelAction}>
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
            <div className="bg-muted border rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Procesando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-background">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="flex items-center gap-2 max-w-4xl mx-auto"
        >
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu consulta o instrucción para Siigo..."
            className="flex-1 rounded-full border-muted-foreground/30 focus-visible:ring-primary bg-muted/50"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full shrink-0"
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Asistente;
