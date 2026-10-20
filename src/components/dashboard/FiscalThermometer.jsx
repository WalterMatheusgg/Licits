import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Flame, Snowflake, Thermometer } from 'lucide-react';

export default function FiscalThermometer({ contracts }) {
  const total = contracts.length;
  if (total === 0) return null;

  const adequada = contracts.filter(c => c.fiscal_status === 'adequada').length;
  const regular = contracts.filter(c => c.fiscal_status === 'regular').length;
  const baixa = contracts.filter(c => c.fiscal_status === 'baixa').length;

  // Score: adequada=100, regular=50, baixa=0
  const score = total > 0 ? Math.round(((adequada * 100) + (regular * 50)) / total) : 0;

  const getLabel = () => {
    if (score >= 75) return { text: 'Fiscalização Ativa', color: 'text-red-500', bg: 'from-orange-400 to-red-500', emoji: '🔥' };
    if (score >= 40) return { text: 'Fiscalização Regular', color: 'text-amber-500', bg: 'from-yellow-400 to-amber-500', emoji: '🌡️' };
    return { text: 'Fiscalização Baixa', color: 'text-blue-500', bg: 'from-blue-400 to-blue-600', emoji: '❄️' };
  };

  const info = getLabel();
  const fillHeight = Math.max(5, score); // percentage of thermometer fill

  const heatMapCells = contracts.slice(0, 30).map(c => ({
    id: c.id,
    label: c.contract_number,
    status: c.fiscal_status,
  }));

  const cellColor = (s) => {
    if (s === 'adequada') return 'bg-red-400';
    if (s === 'regular') return 'bg-amber-400';
    return 'bg-blue-300';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
    >
      <Card className="p-5 border-0 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Thermometer className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Temperatura da Fiscalização</h3>
        </div>

        <div className="flex gap-6 items-center">
          {/* Thermometer */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <motion.div animate={{ scale: score >= 75 ? [1, 1.1, 1] : 1 }} transition={{ repeat: Infinity, duration: 2 }}>
              {score >= 75 ? <Flame className="w-6 h-6 text-red-500" /> : <Snowflake className="w-6 h-6 text-blue-400" />}
            </motion.div>
            <div className="relative w-8 h-36 bg-gray-100 rounded-full border-2 border-gray-200 overflow-hidden flex flex-col justify-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${fillHeight}%` }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
                className={`w-full rounded-full bg-gradient-to-t ${info.bg}`}
              />
              {/* Tick marks */}
              {[25, 50, 75].map(tick => (
                <div key={tick} style={{ bottom: `${tick}%` }} className="absolute w-full flex items-center">
                  <div className="w-2 h-px bg-gray-300 ml-auto mr-1" />
                </div>
              ))}
            </div>
            <div className={`text-xl font-extrabold ${info.color}`}>{score}°</div>
            <p className="text-[10px] text-muted-foreground text-center leading-tight max-w-[60px]">{info.text}</p>
          </div>

          {/* Heat map grid */}
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Mapa de Calor — Contratos</p>
            <div className="flex flex-wrap gap-1.5">
              {heatMapCells.map((cell, i) => (
                <motion.div
                  key={cell.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i }}
                  whileHover={{ scale: 1.4, zIndex: 10 }}
                  className={`w-5 h-5 rounded-sm cursor-pointer ${cellColor(cell.status)} relative group`}
                  title={`${cell.label} — ${cell.status}`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                    {cell.label}: {cell.status}
                  </div>
                </motion.div>
              ))}
              {total > 30 && (
                <div className="w-5 h-5 rounded-sm bg-muted flex items-center justify-center text-[8px] text-muted-foreground font-bold">
                  +{total - 30}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-red-400" /><span>Adequada ({adequada})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-amber-400" /><span>Regular ({regular})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-blue-300" /><span>Baixa ({baixa})</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
