export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-surface px-4 py-10">
      <div className="mx-auto w-full max-w-[380px]">{children}</div>
    </div>
  );
}
