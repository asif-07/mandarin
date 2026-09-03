"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Download, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/shared/date-picker";
import { A4Preview } from "@/components/shared/a4-preview";
import { LeadCombobox } from "@/components/invoices/lead-combobox";
import { createInvoice, duplicateInvoice, updateInvoice } from "@/lib/actions/invoices";
import { invoiceSchema, computeTotals, round2, type InvoiceInput, type InvoiceValues } from "@/lib/validation/invoice";
import { amountInWords } from "@/lib/invoice/amount-in-words";
import { formValuesToTemplateData } from "@/lib/invoice/template-data";
import { renderInvoiceHtml } from "@/lib/pdf/invoice-template";
import { previewTemplateAssets } from "@/lib/pdf/preview-assets";
import { CURRENCIES, DEFAULT_TERMS, INVOICE_STATUSES, QUICK_ADD_ITEMS, type Currency } from "@/lib/constants";
import { formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const PREVIEW_ASSETS = previewTemplateAssets();

export function emptyInvoiceValues(): InvoiceInput {
  return {
    issue_date: todayISO(),
    due_date_label: "On Receipt",
    currency: "USD",
    bill_to_name: "",
    bill_to_phone: "",
    bill_to_email: "",
    bill_to_address: "",
    visa_reference: "",
    tax: 0,
    amount_in_words_override: "",
    terms: DEFAULT_TERMS,
    status: "issued",
    lead_id: null,
    customer_id: null,
    items: [{ title: "", description: "", reference: "", quantity: 1, rate: 0 }],
  };
}

type Props =
  | { mode: "create"; defaultValues?: Partial<InvoiceInput>; nextInvoiceNumber: string }
  | { mode: "edit"; invoiceId: string; invoiceNumber: string; defaultValues: InvoiceInput };

export function InvoiceForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"draft" | "download" | "save" | "duplicate" | null>(null);
  const [overrideWords, setOverrideWords] = useState(!!props.defaultValues?.amount_in_words_override);
  const [applyRefTo, setApplyRefTo] = useState<number>(0);

  const form = useForm<InvoiceInput, unknown, InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { ...emptyInvoiceValues(), ...props.defaultValues },
    mode: "onBlur",
  });
  const { control, register, setValue, getValues, handleSubmit, formState } = form;
  const { errors } = formState;
  const items = useFieldArray({ control, name: "items" });

  const watched = useWatch({ control });
  const invoiceNumber = props.mode === "edit" ? props.invoiceNumber : props.nextInvoiceNumber;

  const totals = useMemo(
    () =>
      computeTotals(
        (watched.items ?? []).map((it) => ({ quantity: Number(it?.quantity) || 0, rate: Number(it?.rate) || 0 })),
        Number(watched.tax) || 0,
      ),
    [watched.items, watched.tax],
  );
  const currency = (watched.currency ?? "USD") as Currency;
  const autoWords = useMemo(() => amountInWords(totals.total, currency), [totals.total, currency]);

  // Live preview: re-render the template at most every 150ms while typing.
  const [previewHtml, setPreviewHtml] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const data = formValuesToTemplateData(
        { ...watched, amount_in_words_override: overrideWords ? watched.amount_in_words_override : "" } as Partial<InvoiceInput>,
        invoiceNumber,
      );
      setPreviewHtml(renderInvoiceHtml(data, PREVIEW_ASSETS));
    }, 150);
    return () => clearTimeout(t);
  }, [watched, invoiceNumber, overrideWords]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.fields.findIndex((f) => f.id === active.id);
    const to = items.fields.findIndex((f) => f.id === over.id);
    if (from >= 0 && to >= 0) items.move(from, to);
  }

  function quickAdd(item: (typeof QUICK_ADD_ITEMS)[number]) {
    const current = getValues("items");
    const onlyBlank = current.length === 1 && !current[0]?.title && !Number(current[0]?.rate);
    const row = { title: item.title, description: item.description, reference: "", quantity: 1, rate: item.rate };
    if (onlyBlank) items.update(0, row);
    else items.append(row);
  }

  function applyVisaReference(ref: string, index: number) {
    if (getValues("items")[index]) setValue(`items.${index}.reference`, ref, { shouldDirty: true });
  }

  async function submit(values: InvoiceValues, action: "draft" | "download" | "save") {
    const payload: InvoiceInput = {
      ...values,
      status: action === "draft" ? "draft" : action === "download" && values.status === "draft" ? "issued" : values.status,
      amount_in_words_override: overrideWords ? values.amount_in_words_override : null,
    };
    setPendingAction(action);
    startTransition(async () => {
      const result =
        props.mode === "edit" ? await updateInvoice(props.invoiceId, payload) : await createInvoice(payload);
      setPendingAction(null);
      if (!result.ok) {
        toast.error(result.error);
        Object.entries(result.fieldErrors ?? {}).forEach(([k, msgs]) => {
          if (msgs?.[0]) form.setError(k as keyof InvoiceInput, { message: msgs[0] });
        });
        return;
      }
      const id = result.data.id;
      toast.success(props.mode === "edit" ? "Invoice updated" : `Invoice ${"invoice_number" in result.data ? result.data.invoice_number : ""} created`);
      if (action === "download") {
        window.location.assign(`/api/invoices/${id}/pdf`);
      }
      router.push(`/invoices/${id}`);
      router.refresh();
    });
  }

  function onDuplicate() {
    if (props.mode !== "edit") return;
    setPendingAction("duplicate");
    startTransition(async () => {
      const result = await duplicateInvoice(props.invoiceId);
      setPendingAction(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Duplicated as ${result.data.invoice_number}`);
      router.push(`/invoices/${result.data.id}/edit`);
    });
  }

  const onInvalid = () => toast.error("Please fix the highlighted fields");
  const busy = pending;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <form className="space-y-6" onSubmit={handleSubmit((v) => submit(v, "save"), onInvalid)} noValidate>
        <fieldset disabled={busy} className="space-y-6">
          {/* Header fields */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Invoice details</span>
                <span className="micro-label">{invoiceNumber}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="issue_date">Issue date</Label>
                <DatePicker
                  id="issue_date"
                  value={watched.issue_date}
                  onChange={(v) => setValue("issue_date", v ?? "", { shouldDirty: true, shouldValidate: true })}
                />
                <FieldError message={errors.issue_date?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due_date_label">Due date</Label>
                <Input id="due_date_label" {...register("due_date_label")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select value={watched.currency ?? "USD"} onValueChange={(v) => setValue("currency", v, { shouldDirty: true })}>
                  <SelectTrigger id="currency" className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={watched.status ?? "issued"} onValueChange={(v) => setValue("status", v, { shouldDirty: true })}>
                  <SelectTrigger id="status" className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bill to */}
          <Card>
            <CardHeader>
              <CardTitle>Bill to</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Pull from lead</Label>
                <LeadCombobox
                  value={watched.lead_id}
                  onSelect={(lead) => {
                    if (!lead) return;
                    setValue("lead_id", lead.id, { shouldDirty: true });
                    setValue("customer_id", lead.customer_id ?? null);
                    setValue("bill_to_name", lead.full_name, { shouldDirty: true, shouldValidate: true });
                    setValue("bill_to_phone", lead.phone, { shouldDirty: true });
                    setValue("bill_to_email", lead.email ?? "", { shouldDirty: true });
                    setValue("bill_to_address", [lead.city, lead.country].filter(Boolean).join(", "), { shouldDirty: true });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bill_to_name">Name</Label>
                <Input id="bill_to_name" aria-invalid={!!errors.bill_to_name} {...register("bill_to_name")} />
                <FieldError message={errors.bill_to_name?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bill_to_phone">Phone</Label>
                <Input id="bill_to_phone" inputMode="tel" {...register("bill_to_phone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bill_to_email">Email</Label>
                <Input id="bill_to_email" type="email" aria-invalid={!!errors.bill_to_email} {...register("bill_to_email")} />
                <FieldError message={errors.bill_to_email?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bill_to_address">Address</Label>
                <Input id="bill_to_address" {...register("bill_to_address")} />
              </div>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                {QUICK_ADD_ITEMS.map((q) => (
                  <Button key={q.title} type="button" variant="outline" size="sm" onClick={() => quickAdd(q)}>
                    <Plus /> {q.title}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <div className="space-y-1.5">
                  <Label htmlFor="visa_reference">Visa reference</Label>
                  <Input
                    id="visa_reference"
                    placeholder="MR144-Aug25-Aug30-05px-G01"
                    {...register("visa_reference", {
                      onChange: (e) => applyVisaReference(e.target.value, applyRefTo),
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apply_ref">Apply to line</Label>
                  <Select
                    value={String(applyRefTo)}
                    onValueChange={(v) => {
                      const idx = Number(v);
                      setApplyRefTo(idx);
                      applyVisaReference(getValues("visa_reference") ?? "", idx);
                    }}
                  >
                    <SelectTrigger id="apply_ref" className="w-full rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {items.fields.map((f, i) => (
                        <SelectItem key={f.id} value={String(i)}>
                          {String(i + 1).padStart(2, "0")} · {watched.items?.[i]?.title || "Untitled"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={items.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {items.fields.map((field, index) => (
                      <LineItemRow
                        key={field.id}
                        id={field.id}
                        index={index}
                        control={control}
                        register={register}
                        errors={errors}
                        currency={currency}
                        canRemove={items.fields.length > 1}
                        onRemove={() => items.remove(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <FieldError message={typeof errors.items?.message === "string" ? errors.items.message : undefined} />
              <Button
                type="button"
                variant="outline"
                onClick={() => items.append({ title: "", description: "", reference: "", quantity: 1, rate: 0 })}
              >
                <Plus /> Add line
              </Button>
            </CardContent>
          </Card>

          {/* Totals + words + terms */}
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tax">Tax ({currency})</Label>
                  <Input id="tax" type="number" step="0.01" min="0" inputMode="decimal" className="tnum" {...register("tax")} />
                  <FieldError message={errors.tax?.message} />
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-mr-body">Subtotal</dt>
                    <dd className="tnum">
                      {currency} {formatNumber(totals.subtotal)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-mr-body">Tax</dt>
                    <dd className="tnum">
                      {currency} {formatNumber(totals.tax)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-mr-line pt-2 text-base font-semibold">
                    <dt>Total due</dt>
                    <dd className="tnum">
                      {currency} {formatNumber(totals.total)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="words">Amount in words</Label>
                    <label className="flex items-center gap-2 text-xs text-mr-body">
                      <Switch checked={overrideWords} onCheckedChange={setOverrideWords} aria-label="Override amount in words" />
                      Override
                    </label>
                  </div>
                  {overrideWords ? (
                    <Textarea id="words" rows={2} placeholder={autoWords} {...register("amount_in_words_override")} />
                  ) : (
                    <p id="words" className="rounded-lg border border-mr-line bg-mr-surface px-3 py-2 text-sm italic text-mr-body">
                      {autoWords}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="terms">Terms &amp; conditions</Label>
                  <Textarea id="terms" rows={4} {...register("terms")} />
                </div>
              </div>
            </CardContent>
          </Card>
        </fieldset>

        {/* Actions */}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-mr-line bg-white/95 px-4 py-3 backdrop-blur md:static md:m-0 md:border-0 md:bg-transparent md:p-0">
          <Button type="button" variant="outline" disabled={busy} onClick={handleSubmit((v) => submit(v, "draft"), onInvalid)}>
            {pendingAction === "draft" ? <Loader2 className="animate-spin" /> : <Save />} Save draft
          </Button>
          <Button type="submit" variant="outline" disabled={busy}>
            {pendingAction === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
          <Button type="button" disabled={busy} onClick={handleSubmit((v) => submit(v, "download"), onInvalid)}>
            {pendingAction === "download" ? <Loader2 className="animate-spin" /> : <Download />} Save &amp; download PDF
          </Button>
          {props.mode === "edit" && (
            <Button type="button" variant="ghost" disabled={busy} onClick={onDuplicate} className="ml-auto">
              {pendingAction === "duplicate" ? <Loader2 className="animate-spin" /> : <Copy />} Duplicate
            </Button>
          )}
        </div>
      </form>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <p className="micro-label mb-3">Live preview</p>
        <A4Preview html={previewHtml} />
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-mr-red">{message}</p>;
}

type RowProps = {
  id: string;
  index: number;
  control: Control<InvoiceInput, unknown, InvoiceValues>;
  register: ReturnType<typeof useForm<InvoiceInput, unknown, InvoiceValues>>["register"];
  errors: ReturnType<typeof useForm<InvoiceInput, unknown, InvoiceValues>>["formState"]["errors"];
  currency: string;
  canRemove: boolean;
  onRemove: () => void;
};

function LineItemRow({ id, index, control, register, errors, currency, canRemove, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const row = useWatch({ control, name: `items.${index}` });
  const amount = round2((Number(row?.quantity) || 0) * (Number(row?.rate) || 0));
  const rowErrors = errors.items?.[index];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid gap-3 rounded-lg border border-mr-line p-3 sm:grid-cols-[24px_1fr_auto]",
        isDragging && "relative z-10 bg-white ring-1 ring-mr-ink",
      )}
    >
      <button
        type="button"
        className="hidden cursor-grab touch-none items-start justify-center pt-2 text-mr-muted hover:text-mr-ink sm:flex"
        aria-label={`Reorder line ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-xs text-mr-muted" htmlFor={`items.${index}.title`}>
            {String(index + 1).padStart(2, "0")} · Title
          </Label>
          <Input id={`items.${index}.title`} aria-invalid={!!rowErrors?.title} {...register(`items.${index}.title`)} />
          <FieldError message={rowErrors?.title?.message} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-xs text-mr-muted" htmlFor={`items.${index}.description`}>
            Description
          </Label>
          <Input id={`items.${index}.description`} {...register(`items.${index}.description`)} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-xs text-mr-muted" htmlFor={`items.${index}.reference`}>
            Reference
          </Label>
          <Input id={`items.${index}.reference`} placeholder="Visa ref (optional)" {...register(`items.${index}.reference`)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-mr-muted" htmlFor={`items.${index}.quantity`}>
            Qty
          </Label>
          <Input
            id={`items.${index}.quantity`}
            type="number"
            step="1"
            min="0"
            inputMode="decimal"
            className="tnum"
            aria-invalid={!!rowErrors?.quantity}
            {...register(`items.${index}.quantity`)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-mr-muted" htmlFor={`items.${index}.rate`}>
            Rate
          </Label>
          <Input
            id={`items.${index}.rate`}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="tnum"
            aria-invalid={!!rowErrors?.rate}
            {...register(`items.${index}.rate`)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-mr-muted">Amount</Label>
          <div className="tnum flex h-9 items-center justify-end rounded-lg bg-mr-surface px-3 text-sm font-medium">
            {currency} {formatNumber(amount)}
          </div>
        </div>
      </div>
      <div className="flex items-start justify-end">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={!canRemove} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
