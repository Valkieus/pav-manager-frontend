import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { CalendarClock, Users, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Planning from './Planning';
import MonPlanning from './MonPlanning';
import PlanningKpiReport from './PlanningKpiReport';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TAB_META = {
  'mon-planning': { label: 'Mon planning', icon: CalendarClock, Component: MonPlanning },
  'equipe': { label: 'Planning générale', icon: Users, Component: Planning },
};
const DEFAULT_ORDER = ['mon-planning', 'equipe'];

// Point d'entrée de la section Planning : deux vues derrière un seul onglet
// de navigation.
//  - "Mon planning" : vue mensuelle réduite, mes jours de service.
//  - "Planning générale" : le planning mensuel équipe (vendredi/dimanche).
//    Les plannings événements ne sont plus un onglet séparé — ils se créent
//    et se gèrent depuis le bouton "Planning événement" à l'intérieur même
//    de Planning générale (cf. PlanningEvenementSection).
// Gestionnaire+ peut réorganiser la priorité d'affichage des deux onglets.
// Radix Tabs démonte les panneaux inactifs par défaut, donc <Planning />
// (export PNG, impression, etc.) ne tourne que quand son onglet est actif —
// zéro changement de comportement pour ce qui existait déjà.
export default function PlanningHub() {
  const { canManage } = useAuth();
  const [tabOrder, setTabOrder] = useState(DEFAULT_ORDER);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState(DEFAULT_ORDER);
  const [saving, setSaving] = useState(false);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/planning/meta`);
      const order = Array.isArray(res.data?.tab_order) && res.data.tab_order.length === 2
        ? res.data.tab_order
        : DEFAULT_ORDER;
      setTabOrder(order);
      setActiveTab((prev) => prev || order[0]);
    } catch (err) {
      setTabOrder(DEFAULT_ORDER);
      setActiveTab((prev) => prev || DEFAULT_ORDER[0]);
    } finally {
      setMetaLoaded(true);
    }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const visibleTabs = tabOrder;

  const openReorder = () => {
    setDraftOrder(tabOrder);
    setReorderOpen(true);
  };

  const moveTab = (index, delta) => {
    setDraftOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/planning/tab-order`, { order: draftOrder });
      setTabOrder(draftOrder);
      setActiveTab(draftOrder[0]);
      setReorderOpen(false);
    } catch (err) {
      // silencieux — l'utilisateur peut réessayer
    } finally {
      setSaving(false);
    }
  };

  if (!metaLoaded || !activeTab) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            {visibleTabs.map((key) => {
              const meta = TAB_META[key];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                  <Icon className="w-4 h-4" /> {meta.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {canManage() && (
            <div className="flex items-center gap-2">
              <PlanningKpiReport />
              <Button variant="outline" size="sm" onClick={openReorder} className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" /> Réorganiser les onglets
              </Button>
            </div>
          )}
        </div>

        {tabOrder.map((key) => {
          const meta = TAB_META[key];
          if (!meta) return null;
          const { Component } = meta;
          return (
            <TabsContent key={key} value={key} className="mt-4">
              <Component />
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réorganiser les onglets Planning</DialogTitle>
            <DialogDescription>
              Définis l'ordre de priorité d'affichage de "Mon planning" et "Planning générale". Le premier onglet devient l'onglet par défaut à l'ouverture.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {draftOrder.map((key, idx) => {
              const meta = TAB_META[key];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <div key={key} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => moveTab(idx, -1)}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={idx === draftOrder.length - 1} onClick={() => moveTab(idx, 1)}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReorderOpen(false)}>Annuler</Button>
            <Button onClick={saveOrder} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
