import { LoginForm } from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = searchParams?.next ?? "/messages";

  return (
    <section>
      <h1>Admin Login</h1>
      <p>Sign in with a magic link to access the moderation dashboard.</p>
      <LoginForm next={next} />
    </section>
  );
}
