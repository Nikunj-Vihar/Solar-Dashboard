import { AlertOctagon } from "lucide-react";
import { getPendingAccountAction } from "@/lib/data/site";
import { ConfirmActionButton } from "./ConfirmActionButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Confirm — Solar Dashboard",
};

const COPY = {
  wipe_data: {
    title: "Delete all data?",
    description:
      "Every inverter, every logged reading, every alert will be permanently removed. Your login stays intact — you'll land back on setup, like a brand-new account.",
  },
  delete_account: {
    title: "Delete your account?",
    description:
      "Your data and your login will both be permanently removed. This can't be undone, and you'll be signed out immediately after.",
  },
} as const;

export default async function ConfirmActionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const pending = token ? await getPendingAccountAction(token) : null;

  if (!token || !pending || new Date(pending.expiresAt) < new Date()) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertOctagon className="size-4 text-destructive" />
              Link expired or already used
            </CardTitle>
            <CardDescription>
              This confirmation link is no longer valid. Go back to Settings and request a new one
              if you still want to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const copy = COPY[pending.action];

  return (
    <div className="mx-auto max-w-md">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertOctagon className="size-4 text-destructive" />
            {copy.title}
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmActionButton token={token} action={pending.action} />
        </CardContent>
      </Card>
    </div>
  );
}
