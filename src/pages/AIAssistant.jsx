import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Loader2, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { fiscalAnswer } from '@/lib/fiscalInsights';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o assistente IA do Licits. Posso ajudar com informações sobre contratos, saldos, vencimentos, documentos e mais. Como posso ajudar?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
    initialData: [],
  });

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const contractContext = contracts.slice(0, 100).map(c => ({
      numero: c.contract_number,
      objeto: c.object,
      empresa: c.supplier_name,
      cnpj: c.supplier_cnpj,
      status: c.status,
      estado: c.supplier_state,
      vigencia_fim: c.end_date,
      valor_total: c.total_value,
      valor_usado: c.used_value,
      fiscal: c.fiscal_status,
      prorrogacao: c.can_extend,
      prorrogacoes: c.extensions_done,
    }));

    try {
    const local = fiscalAnswer(userMsg, contracts);
    if (local) {
      setMessages(prev => [...prev, {role: 'assistant', content: local}]);
      return;
    }
    const response = await dataClient.integrations.Core.InvokeLLM({
      prompt: `Você é o assistente IA do sistema NexoFiscal - gestão inteligente de contratos. 
Responda de forma clara, objetiva e em português brasileiro. Não invente contratos nem valores. Identifique claramente dados ausentes. Para consultas sobre saldo e risco, calcule sobre os registros informados; não afirme que a lista é exaustiva se houver mais registros que o limite. Nunca autorize gastos ou altere contratos.
Use dados reais dos contratos quando disponíveis.

Contratos cadastrados no sistema:
${JSON.stringify(contractContext, null, 2)}

Data atual: ${new Date().toISOString().split('T')[0]}

Pergunta do usuário: ${userMsg}`,
    });

    setMessages(prev => [...prev, { role: 'assistant', content: typeof response === 'string' ? response : JSON.stringify(response) }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Não foi possível consultar a IA externa. Você ainda pode perguntar sobre saldo, risco de teto, vencimentos, fiscalização ou o número de um contrato. Detalhes: ' + error.message }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Quais contratos vencem este mês?',
    'Qual o resumo geral dos contratos?',
    'Quais contratos estão com baixa fiscalização?',
    'Qual o saldo total dos contratos ativos?',
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Assistente IA
        </h1>
        <p className="text-sm text-muted-foreground">Pergunte sobre contratos, saldos, vencimentos e mais</p>
      </motion.div>

      <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-220px)]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </motion.div>
          )}
          <div ref={messagesEnd} />
        </div>

        {messages.length === 1 && (
          <div className="px-6 pb-3">
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => { setInput(s); }} className="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-full transition-colors">{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t">
          <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || loading} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}