export interface LandingSectionProps {
  onGetStarted: (targetProduct?: "offline" | "online") => void;
  onOpenStore?: () => void;
  onOpenInquiry?: () => void;
}
