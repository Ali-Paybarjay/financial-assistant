import { requireViewer } from "@/lib/auth";
import { RiskQuiz } from "./risk-quiz";

export default async function RiskPage() {
  await requireViewer();
  return <RiskQuiz />;
}
