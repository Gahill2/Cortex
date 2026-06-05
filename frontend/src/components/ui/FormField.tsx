import { Children, cloneElement, isValidElement, useId, type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * Reusable form field wrapper.
 *
 * - Renders a label above, the child input, and either an error message
 *   (red) or hint text (muted) below.
 * - Injects `aria-invalid`, `aria-describedby`, and `id` onto the direct
 *   child element so screen readers can associate the description.
 */
export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  const id = useId();
  const descId = `${id}-desc`;
  const hasDesc = !!(error ?? hint);

  // Inject accessibility props into the first valid child (the input/select/textarea)
  const child = Children.only(children);
  const enhancedChild = isValidElement<Record<string, unknown>>(child)
    ? cloneElement(child, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hasDesc ? descId : undefined,
        "aria-required": required || undefined,
      } as Record<string, unknown>)
    : child;

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
        {required && (
          <span className="form-field__required" aria-hidden="true">
            {" "}*
          </span>
        )}
      </label>

      {enhancedChild}

      {hasDesc && (
        <p
          id={descId}
          className={error ? "form-field__error" : "form-field__hint"}
          role={error ? "alert" : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
