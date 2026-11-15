import { useDisclaimer } from '@/disclaimer';
import { DisclaimerScreen } from '@/screens/DisclaimerScreen';

export default function Disclaimer() {
  const { accept } = useDisclaimer();
  return <DisclaimerScreen onAccept={accept} />;
}
