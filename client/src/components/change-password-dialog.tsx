import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, KeyRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FormErrorAlert } from "@/components/form-error-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  emptyPasswordForm,
  passwordFormIsValid,
  passwordRequirements,
  type PasswordFormValue,
} from "@/lib/password";
import type { OperationError, OperationResult } from "@/types";

type ChangePasswordDialogProps = {
  open: boolean;
  targetName: string;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: PasswordFormValue) => Promise<OperationResult>;
};

export function ChangePasswordDialog({
  open,
  targetName,
  isLoading,
  onOpenChange,
  onSubmit,
}: ChangePasswordDialogProps) {
  const [value, setValue] = useState(emptyPasswordForm);
  const [error, setError] = useState<OperationError | null>(null);

  useEffect(() => {
    if (!open) {
      setValue(emptyPasswordForm);
      setError(null);
    }
  }, [open]);

  const canSubmit = passwordFormIsValid(value, true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    const result = await onSubmit(value);
    if (result.ok) onOpenChange(false);
    else setError(result.error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Şifremi değiştir</DialogTitle>
          <DialogDescription>
            {targetName} hesabı için mevcut şifrenizi doğrulayıp yeni bir şifre belirleyin.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FormErrorAlert message={error && !error.field ? error.message : undefined} />
          <PasswordFields
            value={value}
            requireCurrentPassword
            errors={error ? { [error.field ?? "form"]: error.message } : {}}
            onChange={(nextValue) => {
              setError(null);
              setValue(nextValue);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={isLoading || !canSubmit}>
              <KeyRound data-icon="inline-start" />
              Şifreyi değiştir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PasswordFields({
  value,
  requireCurrentPassword,
  errors = {},
  onChange,
}: {
  value: PasswordFormValue;
  requireCurrentPassword: boolean;
  errors?: Partial<Record<"currentPassword" | "newPassword", string>>;
  onChange: (value: PasswordFormValue) => void;
}) {
  const confirmationInvalid = Boolean(
    value.confirmPassword && value.newPassword !== value.confirmPassword,
  );

  return (
    <FieldGroup>
      {requireCurrentPassword && (
        <Field data-invalid={Boolean(errors.currentPassword) || undefined}>
          <FieldLabel htmlFor="current-password">Mevcut şifre</FieldLabel>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword) || undefined}
            value={value.currentPassword}
            onChange={(event) => onChange({ ...value, currentPassword: event.target.value })}
          />
          <FieldError>{errors.currentPassword}</FieldError>
        </Field>
      )}
      <Field data-invalid={Boolean(errors.newPassword) || undefined}>
        <FieldLabel htmlFor="new-password">Yeni şifre</FieldLabel>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.newPassword) || undefined}
          value={value.newPassword}
          onChange={(event) => onChange({ ...value, newPassword: event.target.value })}
        />
        <FieldError>{errors.newPassword}</FieldError>
        <div className="flex flex-wrap gap-1.5" aria-label="Şifre gereksinimleri">
          {passwordRequirements.map((requirement) => {
            const passes = requirement.test(value.newPassword);
            return (
              <Badge key={requirement.id} variant={passes ? "secondary" : "outline"}>
                {passes ? <Check /> : <X />}
                {requirement.label}
              </Badge>
            );
          })}
        </div>
      </Field>
      <Field data-invalid={confirmationInvalid || undefined}>
        <FieldLabel htmlFor="confirm-password">Yeni şifre tekrar</FieldLabel>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={confirmationInvalid || undefined}
          value={value.confirmPassword}
          onChange={(event) => onChange({ ...value, confirmPassword: event.target.value })}
        />
        <FieldError>
          {confirmationInvalid ? "Yeni şifreler birbiriyle eşleşmiyor." : undefined}
        </FieldError>
      </Field>
    </FieldGroup>
  );
}
