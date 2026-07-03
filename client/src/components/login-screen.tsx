import type { FormEvent } from "react"
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
    <main className="login-shell">
      <section className="login-visual">
        <Badge variant="outline">Yönetim Paneli</Badge>
        <h1>Çağrı kayıt sistemi</h1>
        <p>
          Rol bazlı yetkilendirme, kullanıcı yönetimi ve sonraki fazlarda çağrı
          operasyonları için genişleyebilir yönetim yüzeyi.
        </p>
        <div className="login-highlights">
          <span><ShieldCheck /> Rol bazlı erişim</span>
          <span><KeyRound /> Güvenli oturum</span>
          <span><LayoutDashboard /> Modüler panel</span>
        </div>
      </section>

      <Card className="login-card">
        <CardHeader>
          <CardTitle>Sisteme giriş</CardTitle>
          <CardDescription>
            İlk kurulumdan sonra Süper Admin hesabıyla giriş yapın.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <Label htmlFor="username">Kullanıcı adı veya e-posta</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(event) => onChange({ ...form, username: event.target.value })}
              />
            </div>
            <div className="field">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
              />
            </div>
            {message && <p className="form-message">{message}</p>}
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
