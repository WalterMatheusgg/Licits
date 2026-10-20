import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STATUS_COLORS = {
  ativo: '#22c55e',
  vencido: '#ef4444',
  encerrado: '#6b7280',
  suspenso: '#f59e0b',
  cancelado: '#dc2626',
  em_analise: '#3b82f6'
};

const STATUS_LABELS = {
  ativo: 'Ativo',
  vencido: 'Vencido',
  encerrado: 'Encerrado',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
  em_analise: 'Em Análise'
};

export default function ContractStatusChart({ contracts }) {
  const statusCount = contracts.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(statusCount).map(([key, value]) => ({
    name: STATUS_LABELS[key] || key,
    value,
    color: STATUS_COLORS[key] || '#6b7280'
  }));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Status dos Contratos</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Contratos']} />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        )}
      </CardContent>
    </Card>
  );
}
