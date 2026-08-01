"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { togglePublicShare } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PublicShareCard({
  initialIsPublic,
  initialSlug,
}: {
  initialIsPublic: boolean;
  initialSlug: string | null;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [slug, setSlug] = useState(initialSlug);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    slug && typeof window !== "undefined" ? `${window.location.origin}/s/${slug}` : "";

  async function handleToggle(next: boolean) {
    setPending(true);
    const result = await togglePublicShare(next);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setIsPublic(result.isPublic);
    setSlug(result.slug);
    toast.success(next ? "Public link enabled" : "Public link disabled");
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Public read-only link</CardTitle>
        <CardDescription>
          Share a view-only version of your dashboard with family or investors — no login
          required, no editing possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {isPublic ? "Public link is on" : "Public link is off"}
          </span>
          <Switch checked={isPublic} onCheckedChange={handleToggle} disabled={pending} />
        </div>
        {isPublic && shareUrl && (
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
