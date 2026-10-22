import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import marker from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

// Fix leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker,
  shadowUrl: shadow,
});

const STATE_COORDS = {
  AC: [-9.97, -67.81], AL: [-9.57, -36.78], AP: [0.034, -51.07], AM: [-3.12, -60.02],
  BA: [-12.97, -38.51], CE: [-3.72, -38.53], DF: [-15.78, -47.93], ES: [-20.32, -40.34],
  GO: [-16.69, -49.25], MA: [-2.53, -44.28], MT: [-15.60, -56.10], MS: [-20.44, -54.65],
  MG: [-19.92, -43.94], PA: [-1.46, -48.50], PB: [-7.12, -34.84], PR: [-25.43, -49.27],
  PE: [-8.05, -34.87], PI: [-5.09, -42.80], RJ: [-22.91, -43.17], RN: [-5.79, -35.21],
  RS: [-30.03, -51.23], RO: [-8.76, -63.90], RR: [2.82, -60.67], SC: [-27.60, -48.55],
  SP: [-23.55, -46.63], SE: [-10.91, -37.07], TO: [-10.18, -48.33],
};

export default function MapBrazil() {
  const [stateFilter, setStateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list(),
    initialData: [],
  });
  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups-map'],
    queryFn: () => dataClient.entities.PriceRegistrationGroup.list(),
    initialData: [],
  });

  // Unify contracts + atas
  const allSuppliers = [
    ...contracts,
    ...priceGroups.map(g => ({ ...g, contract_number: g.arp_number, object: 'ARP', _isArp: true }))
  ];

  const filtered = allSuppliers.filter(c => {
    if (!STATE_COORDS[String(c.supplier_state || '').trim().toUpperCase()]) return false;
    if (stateFilter !== 'all' && c.supplier_state !== stateFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const stateStats = useMemo(() => {
    const stats = {};
    allSuppliers.forEach(c => {
      if (!c.supplier_state) return;
      if (!stats[c.supplier_state]) stats[c.supplier_state] = { count: 0, value: 0 };
      stats[c.supplier_state].count++;
      stats[c.supplier_state].value += c.total_value || 0;
    });
    return stats;
  }, [contracts, priceGroups]);

  const states = [...new Set(allSuppliers.map(c => c.supplier_state).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">Mapa de Fornecedores</h1>
        <p className="text-sm text-muted-foreground">Localização geográfica dos fornecedores</p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Estados</SelectItem>
            {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 xl:gap-6 relative z-0">
        <div className="xl:col-span-3">
          <Card className="border shadow-sm overflow-hidden relative z-0">
            <div className="h-[350px] sm:h-[500px] relative z-0">
              <MapContainer center={[-14.24, -51.93]} zoom={4} style={{ height: '100%', width: '100%' }} className="rounded-lg relative z-0">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap'
                />
                {filtered.map(c => {
                  const coords = STATE_COORDS[String(c.supplier_state || '').trim().toUpperCase()];
                  if (!coords) return null;
                  return (
                    <Marker key={c.id} position={coords}>
                      <Popup>
                       <div className="text-sm">
                         <p className="font-bold">{c.supplier_name}</p>
                         <p className="text-muted-foreground">{c.contract_number}{c._isArp ? ' (ARP)' : ''}</p>
                          <p>{c.supplier_city} - {c.supplier_state}</p>
                          <p className="font-medium mt-1">R$ {(c.total_value || 0).toLocaleString('pt-BR')}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Estatísticas por Estado</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {Object.entries(stateStats).sort(([,a],[,b]) => b.count - a.count).map(([state, data]) => (
                <div key={state} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] w-8 justify-center">{state}</Badge>
                    <span className="text-xs">{data.count} item(ns)</span>
                  </div>
                  <span className="text-xs font-medium">R$ {(data.value / 1000).toFixed(0)}k</span>
                </div>
              ))}
              {Object.keys(stateStats).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Cadastre contratos com UF para visualizar</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}