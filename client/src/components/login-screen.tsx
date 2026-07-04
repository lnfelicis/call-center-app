import type { FormEvent, ReactNode } from "react"
import { KeyRound, LayoutDashboard, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginScreenProps = {
  form: {
    username: string
    password: string
  }
  message: string
  isLoading: boolean
  onChange: (form: { username: string; password: string }) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function LoginScreen({
  form,
  message,
  isLoading,
  onChange,
  onSubmit,
}: LoginScreenProps) {
  return (
    <main className="grid min-h-svh items-center gap-8 bg-background p-5 md:grid-cols-[minmax(0,1fr)_420px] md:p-12">
      <section className="max-w-3xl">
        <Badge variant="outline">Yönetim Paneli</Badge>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-none tracking-normal md:text-6xl">
          Çağrı kayıt sistemi
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          Rol bazlı yetkilendirme, kullanıcı yönetimi ve çağrı operasyonları için genişleyebilir yönetim yüzeyi.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Highlight icon={<ShieldCheck />} label="Rol bazlı erişim" />
          <Highlight icon={<KeyRound />} label="Güvenli oturum" />
          <Highlight icon={<LayoutDashboard />} label="Modüler panel" />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Sisteme giriş</CardTitle>
          <CardDescription>
            İlk kurulumdan sonra Süper Admin hesabıyla giriş yapın.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="username">Kullanıcı adı veya e-posta</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(event) => onChange({ ...form, username: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
              />
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" size="lg" disabled={isLoading}>
              <KeyRound />
              Giriş yap
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function Highlight({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm">
      <span className="[&_svg]:size-4">{icon}</span>
      {label}
    </span>
  )
}
