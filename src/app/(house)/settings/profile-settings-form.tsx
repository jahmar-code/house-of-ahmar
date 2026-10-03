"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "@/app/actions/members";
import {
  AVATAR_BUCKET,
  IMAGE_MIME_TYPES,
  MAX_AVATAR_BYTES,
  avatarStoragePath,
  uploadFile,
  validateUpload,
} from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";

interface ProfileSettingsFormProps {
  memberId: string;
  displayName: string;
  fullName: string | null;
  bio: string | null;
  birthday: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

const BIO_MAX = 500;

type FieldErrors = {
  displayName?: string;
  birthday?: string;
  bio?: string;
  avatar?: string;
};

/** Today as 'YYYY-MM-DD' in the reader's own calendar — never a UTC round-trip. */
function todayAsInputValue(): string {
  const now = new Date();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mo}-${d}`;
}

export function ProfileSettingsForm({
  memberId,
  displayName: initialDisplayName,
  fullName: initialFullName,
  bio: initialBio,
  birthday: initialBirthday,
  phone: initialPhone,
  avatarUrl: initialAvatarUrl,
}: ProfileSettingsFormProps) {
  const router = useRouter();

  // Every field is CONTROLLED on purpose: React resets an uncontrolled
  // `<form action={fn}>` the moment the action resolves, so a rejected save
  // would otherwise wipe everything the relative just typed.
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [birthday, setBirthday] = useState(initialBirthday ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Release the object URL when it is replaced or the page goes away.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const initials = displayName.trim().charAt(0).toUpperCase() || "?";
  const shownAvatar = previewUrl ?? avatarUrl ?? undefined;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a failure
    if (!file) return;

    const invalid = validateUpload(file, { maxBytes: MAX_AVATAR_BYTES });
    if (invalid) {
      setFieldErrors((prev) => ({ ...prev, avatar: invalid }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, avatar: undefined }));
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    try {
      const result = await uploadFile(
        AVATAR_BUCKET,
        avatarStoragePath(memberId, file.name),
        file,
        { maxBytes: MAX_AVATAR_BYTES }
      );

      if (!result.success) {
        setPreviewUrl(null);
        setFieldErrors((prev) => ({
          ...prev,
          avatar: `That photo didn't upload: ${result.error}`,
        }));
        return;
      }
      setAvatarUrl(result.url);
      setPreviewUrl(null);
    } catch {
      setPreviewUrl(null);
      setFieldErrors((prev) => ({ ...prev, avatar: "Couldn't upload that photo. Check your connection and try again." }));
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePhoto() {
    setPreviewUrl(null);
    setAvatarUrl(null);
    setFieldErrors((prev) => ({ ...prev, avatar: undefined }));
  }

  /** Catch the obvious problems on the phone, before a round-trip. */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      errors.displayName = "Name must be at least 2 characters";
    } else if (trimmed.length > 50) {
      errors.displayName = "Name is too long";
    }
    if (birthday && birthday > todayAsInputValue()) {
      errors.birthday = "That birthday hasn't happened yet";
    }
    if (bio.length > BIO_MAX) {
      errors.bio = `Keep it under ${BIO_MAX} characters`;
    }
    return errors;
  }

  async function handleSubmit(formData: FormData) {
    if (saving || uploading) return;
    setFormError(null);

    const errors = validate();
    setFieldErrors((prev) => ({ ...errors, avatar: prev.avatar }));
    if (Object.keys(errors).length > 0) return;

    // Always send the field: absent means "leave the photo alone", empty means
    // "take it down".
    formData.set("avatarUrl", avatarUrl ?? "");

    setSaving(true);
    try {
      const result = await updateProfile(formData);
      if (result.success) {
        toast.success("Saved");
        router.refresh();
      } else {
        setFormError(result.error);
      }
    } catch {
      setFormError("That didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 sm:p-6">
        <form action={handleSubmit} className="space-y-6">
          <HydratedFieldset aria-label="Profile details" className="space-y-6">
          {/* Photo */}
          <div className="space-y-2">
            <p className="text-sm leading-none font-medium">Photo</p>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-20 w-20">
                {shownAvatar && (
                  <AvatarImage src={shownAvatar} alt="Your profile photo" />
                )}
                <AvatarFallback className="bg-secondary text-xl text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="avatar"
                  type="file"
                  accept={IMAGE_MIME_TYPES.join(",")}
                  onChange={handlePhotoChange}
                  disabled={uploading || saving}
                  className="peer sr-only"
                  aria-describedby="avatar-hint avatar-error"
                />
                <Label
                  htmlFor="avatar"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-11 cursor-pointer px-4 peer-focus-visible:border-ring peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50"
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {uploading
                    ? "Uploading…"
                    : shownAvatar
                      ? "Change photo"
                      : "Add a photo"}
                </Label>

                {shownAvatar && !uploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemovePhoto}
                    disabled={saving}
                    className="h-11 px-4 text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <p id="avatar-hint" className="text-xs text-muted-foreground">
              A JPG, PNG or WEBP, up to 5 MB.
            </p>
            <p
              id="avatar-error"
              role="alert"
              className="min-h-5 text-sm text-destructive"
            >
              {fieldErrors.avatar ?? ""}
            </p>
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">
              Name the House sees{" "}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
              <span className="sr-only">(required)</span>
            </Label>
            <Input
              id="displayName"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={50}
              autoComplete="nickname"
              aria-describedby="displayName-error"
              aria-invalid={fieldErrors.displayName ? true : undefined}
              className="h-11 border-border bg-card"
            />
            <p
              id="displayName-error"
              role="alert"
              className="min-h-5 text-sm text-destructive"
            >
              {fieldErrors.displayName ?? ""}
            </p>
          </div>

          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              autoComplete="name"
              placeholder="Optional"
              className="h-11 border-border bg-card"
            />
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <Label htmlFor="birthday">Birthday</Label>
            <Input
              id="birthday"
              name="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              max={todayAsInputValue()}
              min="1900-01-01"
              autoComplete="bday"
              aria-describedby="birthday-hint birthday-error"
              aria-invalid={fieldErrors.birthday ? true : undefined}
              className="h-11 border-border bg-card"
            />
            <p id="birthday-hint" className="text-xs text-muted-foreground">
              The Great Hall uses this to remind everyone. Only the day and month
              are ever shown.
            </p>
            <p
              id="birthday-error"
              role="alert"
              className="min-h-5 text-sm text-destructive"
            >
              {fieldErrors.birthday ?? ""}
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              autoComplete="tel"
              placeholder="Optional"
              aria-describedby="phone-hint"
              className="h-11 border-border bg-card"
            />
            <p id="phone-hint" className="text-xs text-muted-foreground">
              Shown to the family on your profile. Leave it blank if you would
              rather not.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">About you</Label>
            <Textarea
              id="bio"
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={BIO_MAX}
              placeholder="A line or two — where you are, what you're up to."
              aria-describedby="bio-count bio-error"
              aria-invalid={fieldErrors.bio ? true : undefined}
              className="resize-none border-border bg-card"
            />
            <p id="bio-count" className="text-xs text-muted-foreground">
              {bio.length} of {BIO_MAX} characters
            </p>
            <p
              id="bio-error"
              role="alert"
              className="min-h-5 text-sm text-destructive"
            >
              {fieldErrors.bio ?? ""}
            </p>
          </div>

          <div className="space-y-3">
            <p role="alert" className="min-h-5 text-sm text-destructive">
              {formError ?? ""}
            </p>
            <Button
              type="submit"
              disabled={saving || uploading}
              className="h-11 w-full sm:w-auto sm:px-8"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          </HydratedFieldset>
        </form>
      </CardContent>
    </Card>
  );
}
