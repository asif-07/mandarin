"use client";

import { useEffect, useMemo, useState } from "react";
import { AsYouType, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PHONE_COUNTRIES: { code: CountryCode; label: string; flag: string }[] = [
  { code: "AE", label: "UAE", flag: "🇦🇪" },
  { code: "IN", label: "India", flag: "🇮🇳" },
  { code: "SA", label: "Saudi Arabia", flag: "🇸🇦" },
  { code: "QA", label: "Qatar", flag: "🇶🇦" },
  { code: "OM", label: "Oman", flag: "🇴🇲" },
  { code: "KW", label: "Kuwait", flag: "🇰🇼" },
  { code: "BH", label: "Bahrain", flag: "🇧🇭" },
  { code: "CN", label: "China", flag: "🇨🇳" },
  { code: "PK", label: "Pakistan", flag: "🇵🇰" },
  { code: "BD", label: "Bangladesh", flag: "🇧🇩" },
  { code: "LK", label: "Sri Lanka", flag: "🇱🇰" },
  { code: "PH", label: "Philippines", flag: "🇵🇭" },
  { code: "EG", label: "Egypt", flag: "🇪🇬" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "US", label: "United States", flag: "🇺🇸" },
];

/**
 * Country-code selector + national number. `value` is always E.164 (or "")
 * so the form stores exactly what goes to the database.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  defaultCountry = "AE",
  className,
}: {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  defaultCountry?: CountryCode;
  className?: string;
}) {
  const parsed = useMemo(() => (value ? parsePhoneNumberFromString(value) : undefined), [value]);
  const [country, setCountry] = useState<CountryCode>(parsed?.country ?? defaultCountry);
  const [national, setNational] = useState(parsed?.nationalNumber ?? "");

  // Keep local state in sync when the outer value is replaced (e.g. prefill).
  useEffect(() => {
    if (!value) return;
    const p = parsePhoneNumberFromString(value);
    if (p && p.country && p.country !== country) setCountry(p.country);
    if (p && p.nationalNumber !== national.replace(/\D/g, "")) setNational(p.nationalNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(nextCountry: CountryCode, nextNational: string) {
    const digits = nextNational.replace(/\D/g, "");
    if (!digits) return onChange("");
    const p = parsePhoneNumberFromString(digits, nextCountry);
    onChange(p ? p.number : `+${getCountryCallingCode(nextCountry)}${digits}`);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={country}
        onValueChange={(c) => {
          setCountry(c as CountryCode);
          emit(c as CountryCode, national);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px] shrink-0 rounded-lg" aria-label="Country code">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="mr-1">{c.flag}</span>+{getCountryCallingCode(c.code)}
              <span className="ml-1 text-mr-muted">{c.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="55 472 0259"
        value={national}
        disabled={disabled}
        aria-invalid={invalid}
        onBlur={onBlur}
        onChange={(e) => {
          const raw = e.target.value;
          // If the user pastes a full international number, adopt its country.
          if (raw.trim().startsWith("+")) {
            const p = parsePhoneNumberFromString(raw);
            if (p?.country) {
              setCountry(p.country);
              setNational(p.nationalNumber);
              onChange(p.number);
              return;
            }
          }
          const formatted = new AsYouType(country).input(raw);
          setNational(formatted);
          emit(country, formatted);
        }}
      />
    </div>
  );
}
