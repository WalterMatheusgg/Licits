import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ConsumptionChart({ contracts }) {
  const data = contracts
    .filter(c => c.total_value > 0)
    .slice(0, 8)
    .map(c => ({
      name: c.contract_number?.length > 10 ? c.contract_number.slice(0, 10) + '…' : c.contract_number,
      total: c.total_value || 0,
      utilizado: c.used_value || 0,
      saldo: (c.total_value || 0) - (c.used_value || 0)
    }));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Consumo Contratual</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="utilizado" fill="hsl(var(--primary))" radius={[4,4,0,0]} name="Utilizado" />
              <Bar dataKey="saldo" fill="hsl(var(--accent))" radius={[4,4,0,0]} name="Saldo" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        )}
      </CardContent>
    </Card>
  );
}
