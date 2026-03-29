import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const registerSchema = z
  .object({
    full_name: z.string().min(1, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one digit"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

function passwordCriteria(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
  };
}

export default function Register() {
  const navigate = useNavigate();
  const { register: authRegister, isAuthenticated } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = watch("password") ?? "";

  const criteria = useMemo(
    () => passwordCriteria(passwordValue),
    [passwordValue]
  );

  const metCount = useMemo(() => {
    let n = 0;
    if (criteria.length) n++;
    if (criteria.upper) n++;
    if (criteria.lower) n++;
    if (criteria.digit) n++;
    return n;
  }, [criteria]);

  const strengthPercent = (metCount / 4) * 100;
  const strengthColor =
    metCount <= 1 ? "bg-red-500" : metCount === 2 ? "bg-yellow-500" : "bg-green-500";

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: RegisterForm) => {
    await authRegister(data.email, data.password, data.full_name);
    navigate("/");
  };

  const checklist = [
    { key: "length", label: "8+ characters", met: criteria.length },
    { key: "upper", label: "Uppercase letter", met: criteria.upper },
    { key: "lower", label: "Lowercase letter", met: criteria.lower },
    { key: "digit", label: "Digit", met: criteria.digit },
  ] as const;

  return (
    <div className="mx-auto mt-20 max-w-md px-4">
      <div
        className={cn(
          "rounded-xl border border-border bg-card p-8 shadow-sm",
          "dark:border-gray-800 dark:bg-gray-900/50"
        )}
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create Your Account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start discovering fundable innovation projects
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="register-full-name"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Full Name
            </label>
            <input
              id="register-full-name"
              type="text"
              autoComplete="name"
              {...register("full_name")}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                errors.full_name && "border-destructive"
              )}
            />
            {errors.full_name && (
              <p className="mt-1 text-sm text-destructive">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                errors.email && "border-destructive"
              )}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                errors.password && "border-destructive"
              )}
            />
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-300", strengthColor)}
                style={{ width: `${strengthPercent}%` }}
              />
            </div>
            <ul className="mt-3 space-y-2">
              {checklist.map((item) => (
                <li
                  key={item.key}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    item.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                  )}
                >
                  {item.met ? (
                    <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
                  ) : (
                    <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
            {errors.password && (
              <p className="mt-2 text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                errors.confirmPassword && "border-destructive"
              )}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-lg font-medium",
              "bg-primary text-primary-foreground",
              "transition-opacity hover:opacity-90",
              "disabled:pointer-events-none disabled:opacity-60"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                <span>Creating account…</span>
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
