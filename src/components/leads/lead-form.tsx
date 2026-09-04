"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/shared/date-picker";
import { PhoneInput } from "@/components/shared/phone-input";
import { createLead, updateLead } from "@/lib/actions/leads";
import { leadSchema, type LeadInput, type LeadValues } from "@/lib/validation/lead";
import {
  CANTON_PHASES,
  COUNTRIES,
  CURRENCIES,
  ENQUIRY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PACKAGE_TIERS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ProfileOption = { id: string; display_name: string };

export function emptyLeadValues(): LeadInput {
  return {
    full_name: "",
    phone: "",
    email: "",
    country: "UAE",
    city: "",
    entry_city: "",
    enquiry_type: "144hr_visa",
    source: "whatsapp",
    status: "new",
    pax_count: 1,
    travel_month: "",
    canton_phase: null,
    package_tier: null,
    quoted_amount: "",
    quoted_currency: "USD",
    assigned_to: null,
    next_followup_date: null,
    notes: "",
  };
}

type Props = {
  mode: "create" | "edit";
  leadId?: string;
  defaultValues?: Partial<LeadInput>;
  profiles: ProfileOption[];
  currentUserId?: string;
  compact?: boolean;
  onSaved?: () => void;
};

export function LeadForm({ mode, leadId, defaultValues, profiles, currentUserId, compact, onSaved }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showMore, setShowMore] = useState(mode === "edit");

  const form = useForm<LeadInput, unknown, LeadValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { ...emptyLeadValues(), assigned_to: currentUserId ?? null, ...defaultValues },
    mode: "onBlur",
  });
  const { register, control, handleSubmit, setValue, formState } = form;
  const { errors, isDirty } = formState;
  const enquiryType = useWatch({ control, name: "enquiry_type" });
  const isVisa = enquiryType === "144hr_visa" || enquiryType === "china_business_visa";
  const isCanton = enquiryType === "canton_fair_package";
  const isPackage = enquiryType === "package";

  function onSubmit(values: LeadValues) {
    startTransition(async () => {
      const result = mode === "edit" && leadId ? await updateLead(leadId, values) : await createLead(values);
      if (!result.ok) {
        toast.error(result.error);
        Object.entries(result.fieldErrors ?? {}).forEach(([k, msgs]) => {
          if (msgs?.[0]) form.setError(k as keyof LeadInput, { message: msgs[0] });
        });
        return;
      }
      if (mode === "edit") {
        toast.success("Lead updated");
        form.reset(values as LeadInput);
        onSaved?.();
        router.refresh();
      } else {
        toast.success(`Lead ${"lead_ref" in result.data ? result.data.lead_ref : ""} added`);
        router.push(`/leads/${result.data.id}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields"))} noValidate>
      <fieldset disabled={pending} className="space-y-6">
        <Card>
          <CardContent className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">
                Name <span className="text-mr-red">*</span>
              </Label>
              <Input id="full_name" autoFocus={mode === "create"} aria-invalid={!!errors.full_name} {...register("full_name")} />
              <FieldError message={errors.full_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                Phone <span className="text-mr-red">*</span>
              </Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput id="phone" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.phone} />
                )}
              />
              <FieldError message={errors.phone?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enquiry_type">
                Enquiry type <span className="text-mr-red">*</span>
              </Label>
              <Controller
                control={control}
                name="enquiry_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="enquiry_type" className="w-full rounded-lg" aria-invalid={!!errors.enquiry_type}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENQUIRY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.enquiry_type?.message} />
            </div>

            {isCanton && (
              <div className="space-y-1.5">
                <Label htmlFor="canton_phase">Canton phase</Label>
                <Controller
                  control={control}
                  name="canton_phase"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="canton_phase" className="w-full rounded-lg">
                        <SelectValue placeholder="Choose phase" />
                      </SelectTrigger>
                      <SelectContent>
                        {CANTON_PHASES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            {isPackage && (
              <div className="space-y-1.5">
                <Label htmlFor="package_tier">
                  Package tier <span className="text-mr-red">*</span>
                </Label>
                <Controller
                  control={control}
                  name="package_tier"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="package_tier" className="w-full rounded-lg" aria-invalid={!!errors.package_tier}>
                        <SelectValue placeholder="3, 4 or 5 star" />
                      </SelectTrigger>
                      <SelectContent>
                        {PACKAGE_TIERS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.package_tier?.message} />
              </div>
            )}
            {isVisa && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="entry_city">Intended entry city</Label>
                  <Input id="entry_city" placeholder="Guangzhou" {...register("entry_city")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="travel_month">Travel window</Label>
                  <Input id="travel_month" placeholder="e.g. 25–30 Aug 2026" {...register("travel_month")} />
                </div>
              </>
            )}
            {!isVisa && (
              <div className="space-y-1.5">
                <Label htmlFor="travel_month">Travel month</Label>
                <Input id="travel_month" placeholder="e.g. Oct 2026" {...register("travel_month")} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Controller
                control={control}
                name="country"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="country" className="w-full rounded-lg">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="mr-1">{c.flag}</span> {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="source" className="w-full rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pax_count">Pax</Label>
              <Input id="pax_count" type="number" min={1} inputMode="numeric" className="tnum" {...register("pax_count")} />
            </div>

            {!showMore && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="button" variant="link" className="h-auto p-0 text-mr-body" onClick={() => setShowMore(true)}>
                  More fields: email, city, quote, owner, follow-up, notes
                </Button>
              </div>
            )}

            {showMore && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
                  <FieldError message={errors.email?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="Dubai" {...register("city")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="status" className="w-full rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quoted_amount">Quoted amount</Label>
                  <div className="flex gap-2">
                    <Controller
                      control={control}
                      name="quoted_currency"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-[92px] shrink-0 rounded-lg" aria-label="Quote currency">
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
                      )}
                    />
                    <Input id="quoted_amount" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" {...register("quoted_amount")} />
                  </div>
                  <FieldError message={errors.quoted_amount?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="assigned_to">Owner</Label>
                  <Controller
                    control={control}
                    name="assigned_to"
                    render={({ field }) => (
                      <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                        <SelectTrigger id="assigned_to" className="w-full rounded-lg">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="next_followup_date">Next follow-up</Label>
                  <Controller
                    control={control}
                    name="next_followup_date"
                    render={({ field }) => (
                      <DatePicker id="next_followup_date" value={field.value} onChange={(v) => setValue("next_followup_date", v, { shouldDirty: true })} clearable />
                    )}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={3} {...register("notes")} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending || (mode === "edit" && !isDirty)}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {mode === "edit" ? "Save changes" : "Add lead"}
          </Button>
          {mode === "edit" && isDirty && (
            <Button type="button" variant="ghost" onClick={() => form.reset()}>
              Discard
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-mr-red">{message}</p>;
}
