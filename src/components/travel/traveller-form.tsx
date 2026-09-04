"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/shared/date-picker";
import { PhoneInput } from "@/components/shared/phone-input";
import { GroupCombobox } from "@/components/travel/group-combobox";
import type { GroupOption } from "@/lib/actions/travel-groups";
import { createTraveller, updateTraveller } from "@/lib/actions/travellers";
import { travellerSchema, type TravellerInput, type TravellerValues } from "@/lib/validation/travel";
import { TRAVELLER_STATUSES } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";

export function emptyTravellerValues(): TravellerInput {
  return {
    full_name: "",
    phone: "",
    email: "",
    passport_number: "",
    nationality: "",
    travel_start_date: todayISO(),
    travel_end_date: todayISO(),
    travel_group_id: null,
    visa_reference: "",
    status: "documents_pending",
    notes: "",
    lead_id: null,
    invoice_id: null,
    customer_id: null,
  };
}

type Props = {
  mode: "create" | "edit";
  travellerId?: string;
  defaultValues?: Partial<TravellerInput>;
  initialGroup?: GroupOption | null;
  linkedLead?: { lead_ref: string; full_name: string } | null;
  linkedInvoice?: { invoice_number: string } | null;
};

export function TravellerForm({ mode, travellerId, defaultValues, initialGroup, linkedLead, linkedInvoice }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<TravellerInput, unknown, TravellerValues>({
    resolver: zodResolver(travellerSchema),
    defaultValues: { ...emptyTravellerValues(), ...defaultValues },
    mode: "onBlur",
  });
  const { register, control, handleSubmit, setValue, formState } = form;
  const { errors, isDirty } = formState;

  function onSubmit(values: TravellerValues) {
    startTransition(async () => {
      const result = mode === "edit" && travellerId ? await updateTraveller(travellerId, values) : await createTraveller(values);
      if (!result.ok) {
        toast.error(result.error);
        Object.entries(result.fieldErrors ?? {}).forEach(([k, msgs]) => {
          if (msgs?.[0]) form.setError(k as keyof TravellerInput, { message: msgs[0] });
        });
        return;
      }
      if (mode === "edit") {
        toast.success("Traveller updated");
        form.reset(values as TravellerInput);
        router.refresh();
      } else {
        toast.success(`Traveller ${"traveller_ref" in result.data ? result.data.traveller_ref : ""} created. Upload their documents next.`);
        router.push(`/travel/travellers/${result.data.id}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields"))} noValidate>
      <fieldset disabled={pending} className="space-y-6">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t_full_name">
                Full name (as in passport) <span className="text-mr-red">*</span>
              </Label>
              <Input id="t_full_name" aria-invalid={!!errors.full_name} {...register("full_name")} />
              <FieldError message={errors.full_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_phone">Phone</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => <PhoneInput id="t_phone" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.phone} />}
              />
              <FieldError message={errors.phone?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_email">Email</Label>
              <Input id="t_email" type="email" aria-invalid={!!errors.email} {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_passport">Passport number</Label>
              <Input id="t_passport" className="uppercase" autoCapitalize="characters" {...register("passport_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_nationality">Nationality</Label>
              <Input id="t_nationality" placeholder="Indian" {...register("nationality")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_start">
                Travel start <span className="text-mr-red">*</span>
              </Label>
              <Controller
                control={control}
                name="travel_start_date"
                render={({ field }) => (
                  <DatePicker
                    id="t_start"
                    value={field.value}
                    onChange={(v) => {
                      setValue("travel_start_date", v ?? "", { shouldDirty: true, shouldValidate: true });
                      const end = form.getValues("travel_end_date");
                      if (v && (!end || end < v)) setValue("travel_end_date", v, { shouldDirty: true });
                    }}
                  />
                )}
              />
              <FieldError message={errors.travel_start_date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_end">
                Travel end <span className="text-mr-red">*</span>
              </Label>
              <Controller
                control={control}
                name="travel_end_date"
                render={({ field }) => (
                  <DatePicker id="t_end" value={field.value} onChange={(v) => setValue("travel_end_date", v ?? "", { shouldDirty: true, shouldValidate: true })} />
                )}
              />
              <FieldError message={errors.travel_end_date?.message} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t_group">Travel group</Label>
              <Controller
                control={control}
                name="travel_group_id"
                render={({ field }) => (
                  <GroupCombobox
                    id="t_group"
                    value={field.value}
                    initial={initialGroup}
                    onChange={(g) => {
                      setValue("travel_group_id", g?.id ?? null, { shouldDirty: true });
                      if (g) {
                        // The group's window becomes the traveller's dates; they stay editable.
                        setValue("travel_start_date", g.travel_date, { shouldDirty: true, shouldValidate: true });
                        setValue("travel_end_date", g.travel_end_date, { shouldDirty: true, shouldValidate: true });
                        toast.message(`Dates set to the group's window: ${formatDate(g.travel_date)} – ${formatDate(g.travel_end_date)}`);
                      }
                    }}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_visa">Visa reference</Label>
              <Input id="t_visa" placeholder="MR144-Aug25-Aug30-05px-G01" {...register("visa_reference")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t_status">Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="t_status" className="w-full rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAVELLER_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t_notes">Notes</Label>
              <Textarea id="t_notes" rows={3} {...register("notes")} />
            </div>
            {(linkedLead || linkedInvoice) && (
              <p className="text-xs text-mr-muted sm:col-span-2">
                Linked to {linkedLead ? `lead ${linkedLead.lead_ref} (${linkedLead.full_name})` : ""}
                {linkedLead && linkedInvoice ? " and " : ""}
                {linkedInvoice ? `invoice ${linkedInvoice.invoice_number}` : ""}.
              </p>
            )}
          </CardContent>
        </Card>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending || (mode === "edit" && !isDirty)}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {mode === "edit" ? "Save changes" : "Create traveller"}
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
