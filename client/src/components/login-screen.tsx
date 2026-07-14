import { useState, type FormEvent } from "react";
import { CircleAlert, Eye, EyeOff, KeyRound } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

type LoginScreenProps = {
  form: {
    username: string;
    password: string;
  };
  message: string;
  isLoading: boolean;
  onChange: (form: { username: string; password: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function LoginScreen({
  form,
  message,
  isLoading,
  onChange,
  onSubmit,
}: LoginScreenProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-5 md:p-12">
      <Card className="w-full max-w-[420px]">
        <CardHeader>
          <CardTitle>Sisteme giriş</CardTitle>
          <CardDescription>
            İlk kurulumdan sonra Süper Admin hesabıyla giriş yapın.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <FieldGroup className="gap-4">
              <Field data-disabled={isLoading || undefined}>
                <FieldLabel htmlFor="username">
                  Kullanıcı adı veya e-posta
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="username"
                    autoFocus
                    autoCapitalize="none"
                    autoComplete="username"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    disabled={isLoading}
                    value={form.username}
                    onChange={(event) =>
                      onChange({ ...form, username: event.target.value })
                    }
                  />
                </InputGroup>
              </Field>
              <Field data-disabled={isLoading || undefined}>
                <FieldLabel htmlFor="password">Şifre</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="password"
                    type={isPasswordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    value={form.password}
                    onChange={(event) =>
                      onChange({ ...form, password: event.target.value })
                    }
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        isPasswordVisible ? "Şifreyi gizle" : "Şifreyi göster"
                      }
                      aria-pressed={isPasswordVisible}
                      title={
                        isPasswordVisible ? "Şifreyi gizle" : "Şifreyi göster"
                      }
                      disabled={isLoading}
                      onClick={() =>
                        setIsPasswordVisible((visible) => !visible)
                      }
                    >
                      {isPasswordVisible ? <Eye /> : <EyeOff />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </FieldGroup>
            {message && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  <KeyRound data-icon="inline-start" />
                  Giriş yap
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
