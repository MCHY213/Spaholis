import PhoneInput, { isValidPhoneNumber, isPossiblePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

// Re-export validators so forms can gate on them.
export { isValidPhoneNumber, isPossiblePhoneNumber };

interface PhoneFieldProps {
  /** E.164 value, e.g. "+50688887777" (or "" when empty). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Adds a red border when the current value is present but not a valid number. */
  invalid?: boolean;
}

/**
 * Phone input with a country-code dropdown (flags + dial codes) and E.164
 * validation, styled to match the site's inputs. Defaults to Costa Rica.
 * Used across the booking forms so every reservation collects a valid number.
 */
export function PhoneField({ value, onChange, placeholder, className, id, invalid }: PhoneFieldProps) {
  return (
    <PhoneInput
      id={id}
      international
      defaultCountry="CR"
      countryCallingCodeEditable={false}
      value={value || undefined}
      onChange={(v) => onChange(v || "")}
      placeholder={placeholder}
      className={cn("holis-phone-input", invalid && "holis-phone-input--invalid", className)}
    />
  );
}
