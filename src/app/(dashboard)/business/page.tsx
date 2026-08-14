import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatTile } from "@/components/dashboard/stat-tile";
import { DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { features } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getMonthToDateTotals() {
  const supabase = createServerSupabaseClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);

  const { data, error } = await supabase
    .from("business_metrics")
    .select("revenue, expenses, profit")
    .gte("metric_date", startOfMonth.toISOString().slice(0, 10));

  if (error) throw error;

  return data.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue),
      expenses: acc.expenses + Number(row.expenses),
      profit: acc.profit + Number(row.profit),
    }),
    { revenue: 0, expenses: 0, profit: 0 }
  );
}

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default async function BusinessPage() {
  const totals = features.database ? await getMonthToDateTotals() : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">Business Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Revenue, expenses, profit, and growth metrics — month to date.
        </p>
      </div>

      {totals ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatTile label="Revenue (MTD)" value={currency(totals.revenue)} icon={DollarSign} />
          <StatTile label="Expenses (MTD)" value={currency(totals.expenses)} icon={Wallet} />
          <StatTile
            label="Profit (MTD)"
            value={currency(totals.profit)}
            icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
          />
        </div>
      ) : (
        <EmptyState
          icon={LineChart}
          title="No business metrics yet"
          description="Connect Supabase (see /system) and start recording rows in business_metrics to populate revenue, expense, and profit totals here."
          phase="Phase 3"
        />
      )}
    </div>
  );
}
