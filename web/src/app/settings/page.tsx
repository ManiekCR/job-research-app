import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { saveLlmCredentials } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: credentials }, { data: usageRows }] = await Promise.all([
    supabase
      .from("llm_credentials")
      .select("provider, fast_model, quality_model, key_last4")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.from("llm_usage").select("call_type, tokens_in, tokens_out, estimated_cost_usd").eq("user_id", user!.id),
  ]);

  const CALL_TYPE_LABELS: Record<string, string> = {
    scoring: "Job scoring",
    cv_letter: "CV / letters",
    outreach_message: "LinkedIn messages",
    salary_estimate: "Salary estimates",
  };

  const totalsByType = new Map<string, { tokens: number; cost: number }>();
  let grandTotalTokens = 0;
  let grandTotalCost = 0;
  let anyCostMissing = false;

  for (const row of usageRows ?? []) {
    const tokens = row.tokens_in + row.tokens_out;
    grandTotalTokens += tokens;
    if (row.estimated_cost_usd !== null) {
      grandTotalCost += row.estimated_cost_usd;
    } else {
      anyCostMissing = true;
    }
    const current = totalsByType.get(row.call_type) ?? { tokens: 0, cost: 0 };
    current.tokens += tokens;
    current.cost += row.estimated_cost_usd ?? 0;
    totalsByType.set(row.call_type, current);
  }

  const PROVIDERS = [
    { value: "anthropic", label: "Anthropic" },
    { value: "openai", label: "OpenAI" },
    { value: "google", label: "Google" },
  ];
  const currentProvider = credentials?.provider ?? "anthropic";

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 md:px-10 md:pb-10 md:pt-8">
      <header className="flex flex-col gap-1">
        <h1 className="page-title">Settings</h1>
        <span className="text-[13px] text-text-3">
          Bring your own LLM key. It is the only variable cost in the app.
        </span>
      </header>

      {error && <p className="alert alert-bad">{error}</p>}
      {success && <p className="alert alert-good">Configuration saved and verified successfully.</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <form action={saveLlmCredentials} className="card flex flex-col gap-[22px] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="section-title !text-lg">LLM provider</h2>
              {credentials && (
                <span className="text-[13px] text-text-3">
                  Current: <span className="font-semibold capitalize text-text-2">{credentials.provider}</span>, key
                  ending in <span className="font-num text-text-2">…{credentials.key_last4}</span>
                </span>
              )}
            </div>
            {credentials && (
              <span className="chip chip-good">
                <Icon name="check" size={12} />
                Saved
              </span>
            )}
          </div>

          <fieldset className="m-0 grid grid-cols-1 gap-2.5 border-0 p-0 sm:grid-cols-3">
            <legend className="label mb-2 p-0">Provider</legend>
            {PROVIDERS.map((provider) => (
              <label
                key={provider.value}
                className="relative flex cursor-pointer items-center justify-between rounded-[10px] border border-line-strong bg-surface p-3.5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:shadow-[0_0_0_1px_var(--accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  type="radio"
                  name="provider"
                  value={provider.value}
                  defaultChecked={currentProvider === provider.value}
                  className="peer absolute opacity-0"
                />
                <span className="font-semibold">{provider.label}</span>
                <span className="box-border h-4 w-4 rounded-full border-[1.5px] border-line-strong peer-checked:border-[5px] peer-checked:border-accent" />
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="label">API key</span>
            <span className="relative flex">
              <Icon name="key" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
              <input
                name="apiKey"
                type="password"
                required
                placeholder="sk-..."
                autoComplete="off"
                className="field font-num !pl-9"
              />
            </span>
            <span className="caption">
              Encrypted with AES-256-GCM and never sent back to the browser, so re-paste it every time you save,
              even to change a model name.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="label">Fast model · scoring</span>
              <input
                name="fastModel"
                required
                defaultValue={credentials?.fast_model}
                placeholder="e.g. claude-haiku-4-5-20251001"
                className="field font-num !text-[13px]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Quality model · CV, letters, messages</span>
              <input
                name="qualityModel"
                required
                defaultValue={credentials?.quality_model}
                placeholder="e.g. claude-opus-5-5"
                className="field font-num !text-[13px]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-[18px]">
            <button type="submit" className="btn btn-primary">
              Test and save
            </button>
            <span className="caption">The key is checked with the provider before it is stored.</span>
          </div>
        </form>

        <div className="flex flex-col gap-5">
          <section className="card flex flex-col gap-3.5 p-5 md:p-6">
            <h2 className="section-title !text-lg">Usage</h2>
            {grandTotalTokens > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-[32px] font-semibold leading-9 tabular-nums">
                    {grandTotalTokens.toLocaleString("en-GB")}
                  </span>
                  <span className="text-[13px] text-text-3">
                    tokens{grandTotalCost > 0 && <> · <span className="font-num">~${grandTotalCost.toFixed(4)}</span></>}
                  </span>
                </div>
                {anyCostMissing && (
                  <span className="caption">
                    Partial: some calls (web-side) have no cost estimate yet, so they show “—”.
                  </span>
                )}
                <div className="flex flex-col text-[13px]">
                  <div className="grid grid-cols-[minmax(0,1fr)_110px_90px] border-b border-line py-2 text-text-3">
                    <span>Call type</span>
                    <span className="text-right">Tokens</span>
                    <span className="text-right">Cost</span>
                  </div>
                  {[...totalsByType.entries()].map(([type, totals]) => (
                    <div
                      key={type}
                      className="grid grid-cols-[minmax(0,1fr)_110px_90px] border-b border-line py-2.5 last:border-b-0"
                    >
                      <span>{CALL_TYPE_LABELS[type] ?? type}</span>
                      <span className="font-num text-right">{totals.tokens.toLocaleString("en-GB")}</span>
                      <span className={`font-num text-right ${totals.cost > 0 ? "" : "text-text-3"}`}>
                        {totals.cost > 0 ? `~$${totals.cost.toFixed(4)}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <span className="caption">Cumulative, all time.</span>
              </>
            ) : (
              <p className="m-0 text-sm text-text-3">No LLM calls yet.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
