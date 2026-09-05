"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type Errors = Record<string, string[] | undefined> | undefined;

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string[] | string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {msg ? <p className="text-xs text-mr-red">{msg}</p> : hint ? <p className="text-xs text-mr-muted">{hint}</p> : null}
    </div>
  );
}

export function CurrencySelect({ value, onChange, disabled, id }: { value: string; onChange: (v: string) => void; disabled?: boolean; id?: string }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full rounded-lg">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MethodSelect({ value, onChange, disabled, id }: { value: string; onChange: (v: string) => void; disabled?: boolean; id?: string }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full rounded-lg">
        <SelectValue placeholder="How was it paid?" />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_METHODS.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const NONE = "__none__";

/** Select with an explicit "none" row, mapping "" <-> null cleanly. */
export function OptionSelect({
  value,
  onChange,
  options,
  placeholder,
  noneLabel = "None",
  disabled,
  id,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: readonly { id: string; label: string; hint?: string }[];
  placeholder: string;
  noneLabel?: string | null;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value ?? (noneLabel === null ? "" : NONE)} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full rounded-lg">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel !== null && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
            {o.hint && <span className="ml-2 text-xs text-mr-muted">{o.hint}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
