import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { passwordResetRequestSchema, type PasswordResetRequestValues } from "../../schemas/auth";
import { authService } from "../../services/authService";

// ---------------------------------------------------------------------------
// Local schemas for steps 2 and 3
// ---------------------------------------------------------------------------
const codeSchema = z.object({
  code: z.string().length(6, "El código debe tener 6 dígitos."),
});
type CodeValues = z.infer<typeof codeSchema>;

const newPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, "Mínimo 8 caracteres.")
      .regex(/[A-Z]/, "Debe incluir al menos una mayúscula.")
      .regex(/[0-9]/, "Debe incluir al menos un número.")
      .regex(/[^A-Za-z0-9]/, "Debe incluir al menos un carácter especial."),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm_password"],
  });
type NewPasswordValues = z.infer<typeof newPasswordSchema>;

// ---------------------------------------------------------------------------
// Step 1 — email
// ---------------------------------------------------------------------------
interface Step1Props {
  onSuccess: (email: string) => void;
}
function Step1({ onSuccess }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
  });

  const onSubmit = async (data: PasswordResetRequestValues) => {
    // Backend always responds silently (anti-enumeration)
    await authService.requestPasswordReset({ email: data.email });
    onSuccess(data.email);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ingresa tu correo y te enviaremos un código de verificación de 6 dígitos.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register("email")}
        />
        {errors.email && (
          <p role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Enviando...
          </span>
        ) : (
          "Enviar código"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — 6-digit code
// ---------------------------------------------------------------------------
interface Step2Props {
  onSuccess: (code: string) => void;
  onBack: () => void;
}
function Step2({ onSuccess, onBack }: Step2Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) });

  const onSubmit = (data: CodeValues) => {
    onSuccess(data.code);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Revisa tu bandeja de entrada e ingresa el código de 6 dígitos.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="code" className="block text-sm font-medium">
          Código de verificación
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          aria-invalid={!!errors.code}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
          {...register("code")}
        />
        {errors.code && (
          <p role="alert" className="text-xs text-destructive">
            {errors.code.message}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Volver
        </button>
        <button
          type="submit"
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Continuar
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — new password
// ---------------------------------------------------------------------------
interface Step3Props {
  email: string;
  code: string;
  onBack: () => void;
}
function Step3({ email, code, onBack }: Step3Props) {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = async (data: NewPasswordValues) => {
    setApiError(null);
    try {
      await authService.confirmPasswordReset({
        email,
        code,
        new_password: data.new_password,
      });
      navigate("/login", { replace: true });
    } catch {
      setApiError("El código es inválido o ha expirado. Vuelve al paso anterior e intenta de nuevo.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Crea una nueva contraseña segura para tu cuenta.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="new_password" className="block text-sm font-medium">
          Nueva contraseña
        </label>
        <input
          id="new_password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.new_password}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register("new_password")}
        />
        {errors.new_password && (
          <p role="alert" className="text-xs text-destructive">
            {errors.new_password.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm_password" className="block text-sm font-medium">
          Confirmar contraseña
        </label>
        <input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm_password}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register("confirm_password")}
        />
        {errors.confirm_password && (
          <p role="alert" className="text-xs text-destructive">
            {errors.confirm_password.message}
          </p>
        )}
      </div>

      {apiError && (
        <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Guardando...
            </span>
          ) : (
            "Cambiar contraseña"
          )}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div
      className="mb-6 flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={3}
    >
      {([1, 2, 3] as const).map((n) => (
        <div
          key={n}
          className={`h-2 w-8 rounded-full transition-colors ${
            n <= current ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function PasswordRecoveryPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const stepTitles: Record<1 | 2 | 3, string> = {
    1: "Recuperar contraseña",
    2: "Verificar código",
    3: "Nueva contraseña",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <StepIndicator current={step} />

        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">{stepTitles[step]}</h1>
        </div>

        {step === 1 && (
          <Step1
            onSuccess={(e) => {
              setEmail(e);
              setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <Step2
            onSuccess={(c) => {
              setCode(c);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3 email={email} code={code} onBack={() => setStep(2)} />
        )}

        <p className="mt-5 text-center text-sm">
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}
