"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingDown, Sparkles, Pause, Play, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";

interface CampaignMetric {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  spendShare: number;
}

interface UnderperformingCampaign extends CampaignMetric {
  reasons: string[];
}

const currency = (n: number) => `$${n.toFixed(2)}`;

export function MetaAdsPanel() {
  const [metrics, setMetrics] = useState<CampaignMetric[] | null>(null);
  const [underperforming, setUnderperforming] = useState<UnderperformingCampaign[]>([]);
  const [recommendations, setRecommendations] = useState<string[] | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; nextStatus: "ACTIVE" | "PAUSED" } | null>(
    null
  );
  const [applying, setApplying] = useState(false);

  function load() {
    fetch("/api/meta/campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setMetrics(data.metrics ?? []);
        setUnderperforming(data.underperforming ?? []);
      })
      .catch(() => toast.error("Failed to load ad campaigns."));
  }

  useEffect(load, []);

  async function handleGenerateRecommendations() {
    setLoadingRecs(true);
    try {
      const res = await fetch("/api/meta/recommendations");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecommendations(data.recommendations ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate recommendations.");
    } finally {
      setLoadingRecs(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!confirmTarget) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/meta/campaigns/${confirmTarget.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: confirmTarget.nextStatus, confirm: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Campaign ${confirmTarget.nextStatus === "PAUSED" ? "paused" : "resumed"}.`);
      setConfirmTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update campaign.");
    } finally {
      setApplying(false);
    }
  }

  if (metrics === null) {
    return (
      <div className="glass-panel flex items-center justify-center gap-2 rounded-xl py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading ad performance…
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No campaigns found"
        description="Your Meta ad account is connected but has no campaigns yet."
        phase="Meta Ads"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Meta Ads — last 30 days</h3>
        <Button size="sm" variant="secondary" disabled={loadingRecs} onClick={() => void handleGenerateRecommendations()} className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {loadingRecs ? "Analyzing…" : "Generate recommendations"}
        </Button>
      </div>

      {recommendations && recommendations.length > 0 && (
        <div className="glass-panel rounded-xl p-4">
          <p className="mb-2 text-sm font-medium">Recommendations</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-orion-cyan">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="glass-panel divide-y divide-glass-border rounded-xl">
        {metrics.map((c) => {
          const flagged = underperforming.find((u) => u.id === c.id);
          const isActive = c.status === "ACTIVE";
          return (
            <li key={c.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <Badge variant="secondary" className={cn("text-[10px]", isActive ? "bg-orion-success/15 text-orion-success" : "bg-muted text-muted-foreground")}>
                      {c.status}
                    </Badge>
                    {flagged && (
                      <Badge variant="secondary" className="gap-1 bg-orion-danger/15 text-[10px] text-orion-danger">
                        <TrendingDown className="h-3 w-3" />
                        Underperforming
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-6">
                    <span>Spend: {currency(c.spend)}</span>
                    <span>Impr: {c.impressions.toLocaleString()}</span>
                    <span>Clicks: {c.clicks.toLocaleString()}</span>
                    <span>CTR: {c.ctr.toFixed(2)}%</span>
                    <span>CPC: {currency(c.cpc)}</span>
                    <span>Conv: {c.conversions}</span>
                  </div>
                  {flagged && (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-orion-danger">
                      {flagged.reasons.map((r, i) => (
                        <li key={i}>— {r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={isActive ? "Pause campaign" : "Resume campaign"}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setConfirmTarget({ id: c.id, name: c.name, nextStatus: isActive ? "PAUSED" : "ACTIVE" })
                  }
                >
                  {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={confirmTarget !== null} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTarget?.nextStatus === "PAUSED" ? "Pause campaign?" : "Resume campaign?"}</DialogTitle>
            <DialogDescription>
              {confirmTarget?.nextStatus === "PAUSED"
                ? `"${confirmTarget?.name}" will stop spending immediately.`
                : `"${confirmTarget?.name}" will start spending again immediately.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button disabled={applying} onClick={() => void handleConfirmStatusChange()} className="bg-orion-cyan text-orion-cyan-foreground hover:bg-orion-cyan/90">
              {applying ? "Applying…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
