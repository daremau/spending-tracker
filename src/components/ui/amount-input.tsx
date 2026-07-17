"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatWithThousands, parseAmountInput } from "@/lib/format";

export interface AmountInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue"> {
  /** Initial numeric value (number or string). Formatted on mount. */
  defaultValue?: number | string;
  /** Form field name — submitted value is written to a hidden input with this name. */
  name: string;
}

function toRawString(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (s === "") return "";
  return parseAmountInput(s);
}

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput(
    { className, defaultValue, name, onChange, onBlur, placeholder = "0.00", ...props },
    ref,
  ) {
    const initialRaw = toRawString(defaultValue);
    const [display, setDisplay] = React.useState(() => formatWithThousands(initialRaw));
    const [raw, setRaw] = React.useState(initialRaw);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const pendingCursorRef = React.useRef<number | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Apply the pending cursor position right after React updates the DOM value.
    React.useLayoutEffect(() => {
      const pos = pendingCursorRef.current;
      if (pos === null) return;
      pendingCursorRef.current = null;
      const node = inputRef.current;
      if (node && document.activeElement === node) {
        const clamped = Math.min(pos, node.value.length);
        node.setSelectionRange(clamped, clamped);
      }
    }, [display]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const el = e.target;
      const newValue = el.value;
      const cursor = el.selectionStart ?? newValue.length;

      const cleaned = parseAmountInput(newValue);

      // Reject keystrokes that produce an invalid value (e.g. a second dot or
      // non-numeric chars). Restore the previous display and bail out.
      if (cleaned === "" && newValue !== "" && !/^[.,\s]*$/.test(newValue)) {
        el.value = display;
        const restored = Math.min(cursor, display.length);
        el.setSelectionRange(restored, restored);
        return;
      }

      // Count "significant" characters (digits and dots) that appear before the
      // cursor in the NEW value. Commas are auto-inserted so we don't count them.
      let significantBefore = 0;
      for (let i = 0; i < cursor; i++) {
        const ch = newValue[i];
        if ((ch >= "0" && ch <= "9") || ch === ".") significantBefore++;
      }

      const formatted = formatWithThousands(cleaned);

      // Walk the formatted string and place the cursor right after the
      // significantBefore-th significant character (digit or dot).
      let newCursor = 0;
      let significantSeen = 0;
      if (significantBefore > 0) {
        for (let i = 0; i < formatted.length; i++) {
          const ch = formatted[i];
          if ((ch >= "0" && ch <= "9") || ch === ".") {
            significantSeen++;
            if (significantSeen === significantBefore) {
              newCursor = i + 1;
              break;
            }
          }
        }
        if (significantSeen < significantBefore) newCursor = formatted.length;
      }

      // The submitted value should never be a lone "." (parseFloat would be NaN).
      const submittedRaw = cleaned === "." ? "" : cleaned;

      setDisplay(formatted);
      setRaw(submittedRaw);
      pendingCursorRef.current = newCursor;

      if (onChange) onChange(e);
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      if (display.endsWith(".")) {
        const trimmed = display.slice(0, -1);
        setDisplay(trimmed);
        setRaw(raw.replace(/\.$/, ""));
      }
      if (onBlur) onBlur(e);
    }

    return (
      <>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          data-slot="input"
          className={cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className,
          )}
          value={display}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          {...props}
        />
        <input type="hidden" name={name} value={raw} />
      </>
    );
  },
);
