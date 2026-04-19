"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAccessCode } from "@/app/actions/admin";

export function CreateCodeForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createAccessCode(formData);
    if (result.success) {
      toast.success("Access code created");
      e.currentTarget.reset();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="label" className="text-xs">
              Label
            </Label>
            <Input
              id="label"
              name="label"
              placeholder="For Uncle Karim..."
              className="h-9 w-48 border-border bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxUses" className="text-xs">
              Max Uses
            </Label>
            <Input
              id="maxUses"
              name="maxUses"
              type="number"
              min={1}
              defaultValue={1}
              className="h-9 w-20 border-border bg-secondary/30 text-sm"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="h-9 bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Code
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
