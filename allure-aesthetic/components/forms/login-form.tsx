"use client"

import { useActionState } from "react"
import { signIn, type LoginState } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandLogo } from "@/components/app/brand-logo"
import { AlertCircle } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "البريد الإلكتروني أو كلمة المرور غلط",
  account_inactive:    "الحساب موقوف — تواصل مع المشرف",
  unknown:             "حدث خطأ، حاول مرة تانية",
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState | undefined, FormData>(
    signIn,
    undefined
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">

        {/* Logo block */}
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo
            src="/brand/allure-logo.svg"
            alt="Allure Aesthetics"
            wordmark="Allure"
            imgClassName="h-12 w-auto object-contain"
            wordmarkClassName="text-2xl"
          />
          <p className="text-sm text-muted-foreground mt-3">مساعد الحجز لمراكز Allure</p>
        </div>

        {/* Form card */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-base font-bold text-foreground mb-5">تسجيل الدخول</h2>

          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@allure.com"
                className="text-left bg-background"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                كلمة المرور
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            {state?.error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{ERROR_MESSAGES[state.error] ?? ERROR_MESSAGES.unknown}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-semibold mt-1"
              loading={isPending}
            >
              {isPending ? "جاري الدخول..." : "دخول"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          للمشاكل التقنية تواصل مع المشرف
        </p>
      </div>
    </div>
  )
}
