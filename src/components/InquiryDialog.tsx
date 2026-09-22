import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { MessageSquare, Phone, Mail, CheckCircle2, Loader2, Send, HelpCircle } from "lucide-react";
import { IshyuraClient, type InquiryPayload } from "../lib/ishyura-client";

interface InquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string;
}

export function InquiryDialog({ open, onOpenChange, defaultPhone = "" }: InquiryDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Merchant Support & Inquiries");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync default phone if available
  React.useEffect(() => {
    if (defaultPhone && !phone) {
      setPhone(defaultPhone);
    }
  }, [defaultPhone, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      setError("Please fill in your name, phone number, and message.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: InquiryPayload = {
        sender_name: name.trim(),
        sender_phone: phone.trim(),
        sender_email: email.trim() || undefined,
        subject,
        message: message.trim(),
      };

      await IshyuraClient.submitInquiry(payload);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send inquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setMessage("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="size-4 text-primary" />
            </div>
            <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
              Official Support
            </span>
          </div>
          <DialogTitle className="text-xl font-bold">Have an Inquiry or Need Help?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Reach out directly to the Ishyura team for merchant acrylic stands, custom integration,
            or payment inquiries in Rwanda.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Inquiry Received!</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Thank you, <strong className="text-foreground">{name}</strong>. Your message has
                been securely saved to our database. Our team will contact you via phone or WhatsApp
                at <strong className="text-foreground">{phone}</strong>.
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={handleReset} className="w-full">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inq-name" className="text-xs">
                  Your Full Name *
                </Label>
                <Input
                  id="inq-name"
                  placeholder="e.g. Marie Claire Uwase"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inq-phone" className="text-xs">
                  Phone / WhatsApp Number *
                </Label>
                <Input
                  id="inq-phone"
                  placeholder="0788 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inq-email" className="text-xs">
                  Email Address (Optional)
                </Label>
                <Input
                  id="inq-email"
                  type="email"
                  placeholder="merchant@example.rw"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inq-subject" className="text-xs">
                  Inquiry Topic
                </Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger id="inq-subject" className="text-sm">
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Merchant Support & Inquiries">
                      Merchant Support & Inquiries
                    </SelectItem>
                    <SelectItem value="Custom Printed Acrylic Stands">
                      Custom Printed Acrylic Stands
                    </SelectItem>
                    <SelectItem value="Bulk Shop Deployment">Bulk Shop Deployment</SelectItem>
                    <SelectItem value="Equity eKash / Bank Integration">
                      Equity eKash / Bank Integration
                    </SelectItem>
                    <SelectItem value="General Feedback">General Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inq-msg" className="text-xs">
                Your Message *
              </Label>
              <Textarea
                id="inq-msg"
                placeholder="Explain what you need assistance with or details of your shop/business in Rwanda..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                required
                className="text-sm resize-none"
              />
            </div>

            {/* Quick Contact Alternatives */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <HelpCircle className="size-3.5 text-primary" />
                Direct Kigali Support Channels
              </p>
              <div className="flex flex-wrap gap-4 pt-1 text-[11px]">
                <a
                  href="tel:+250788000000"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Phone className="size-3 text-primary" />
                  <span>+250 788 000 000</span>
                </a>
                <a
                  href="mailto:contact@ishyura.rw"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Mail className="size-3 text-primary" />
                  <span>contact@ishyura.rw</span>
                </a>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    <span>Submit Inquiry</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
